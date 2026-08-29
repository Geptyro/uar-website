/**
 * A thread under something, for a page to load and act on: what players
 * say under a guide or on a class page. The same rules in both places: a
 * comment answers the subject or another comment; readers vote each one up
 * or down so the best answer rises at every level; anyone signed in may say
 * something; the comment's author may take it back (a comment with answers
 * under it leaves a stump, so the answers keep their place); the maintainer
 * may hide it (it stays, for its author and the maintainer, so the person
 * who wrote it knows what happened) or delete it. The words go through the
 * guide renderer, so a comment gets the same chips and pictures a guide does.
 *
 * A page gives `threadActions` the way to find its subject (a `ThreadScope`)
 * and gets the four actions back; `loadThread` is its loader's half.
 */
import { fail, type RequestEvent } from '@sveltejs/kit';
import { rateLimiter } from 'sveltekit-commons/rate-limit';
import { getAvatarsByToon, getNamesByToon, invalidateCache } from './db';
import {
	addComment,
	commentVotesFor,
	deleteComment,
	getComment,
	hideComment,
	imagesOwnedBy,
	listComments,
	voteComment,
	type CommentHost
} from './builds';
import { authorOf } from './buildForm';
import type { Session } from './session';
import { notify, pingedAccounts, threadSeenAt, touchThreadSeen, type CommentSubject } from './notifications';
import { reactedIds, reactorsOn, toggleReaction } from './reactions';
import { playerCards } from './playerCards';
import { isReaction, reactionViews } from '$lib/reactions';
import { renderBuildMarkdown } from '$lib/buildMarkdown';
import { refResolver } from '$lib/buildRefs';
import {
	COMMENT_DEPTH_MAX,
	commentRecipients,
	excerptOf,
	playerRefsIn,
	replyDepth,
	threadComments,
	validateComment,
	type CommentView,
	type Thread
} from '$lib/builds';

export interface ThreadScope {
	host: CommentHost;
	/** The class the chips resolve against; null on a subject with no class (an entity). */
	mos: string | null;
	session: Session | null;
	admin: boolean;
	/** Comments and votes are taken (a guide that is out; a class page always). */
	open: boolean;
	/** The subject's author, whose comments carry the OP mark; none for a class page. */
	op?: string;
	/** What the thread is under, for the notifications it sends. */
	subject: CommentSubject;
	/** Who is told of a new comment on the subject (a guide's author). */
	owner?: string;
}

/** Comments per account and hour: a conversation, not a script. */
const posts = rateLimiter({ limit: 20, windowMs: 60 * 60 * 1000 });
/** Votes per account and hour: a reader, not a loop. */
const votes = rateLimiter({ limit: 200, windowMs: 60 * 60 * 1000 });
/** Faces per account and minute. */
const reacts = rateLimiter({ limit: 60, windowMs: 60 * 1000 });
/** How often a reader's "last seen" on a thread is rewritten while they keep reading it. */
const SEEN_EVERY_MS = 60 * 1000;

export interface ThreadData {
	threads: Thread<CommentView>[];
	canPost: boolean;
	/** The comment whose answer box is open, from the link that opened it (works without scripts). */
	replyTo: string | null;
}

export async function loadThread(scope: ThreadScope, url: URL): Promise<ThreadData> {
	const { host, session, admin } = scope;
	const all = await listComments(host.id);
	const [names, avatars, mine, seen, faces, players] = await Promise.all([
		getNamesByToon(),
		getAvatarsByToon(),
		session ? commentVotesFor(host.id, session.sub) : Promise.resolve({} as Record<string, 1 | -1>),
		session ? threadSeenAt(session.sub, host.id) : Promise.resolve(null),
		reactorsOn('comment', reactedIds(all), session?.sub ?? null),
		playerCards(all.flatMap((c) => playerRefsIn(c.text)))
	]);
	const resolve = refResolver(scope.mos, { avatars, players });
	const items: CommentView[] = all.map((c) => {
		const deleted = Boolean(c.deletedAt);
		return {
			id: c._id,
			parent: c.parent ?? null,
			createdAt: c.createdAt,
			score: c.score ?? 0,
			hidden: Boolean(c.hiddenAt),
			deleted,
			mine: !deleted && session !== null && c.author.sub === session.sub,
			op: !deleted && scope.op !== undefined && c.author.sub === scope.op,
			// the author as the site names players, never the account id
			name: deleted ? '' : (c.author.toon && names[c.author.toon]) || c.author.battletag.replace(/#\d+$/, ''),
			toon: deleted ? null : (c.author.toon ?? null),
			avatar: (!deleted && c.author.toon && avatars[c.author.toon]) || null,
			vote: mine[c._id] ?? 0,
			html: deleted ? '' : renderBuildMarkdown(c.text, resolve),
			// new since the reader was last here; a first visit marks nothing
			unseen: seen !== null && !deleted && c.author.sub !== session?.sub && c.createdAt > seen,
			reactions: deleted ? [] : reactionViews(c.reactions, faces.get(c._id)?.mine, faces.get(c._id)?.who)
		};
	});
	// the reader has the thread in front of them now: written when there was
	// something new to clear, or once a minute otherwise, so a thread read many
	// times over is not a write for every read
	if (session && (seen === null || items.some((c) => c.unseen) || Date.now() - Date.parse(seen) > SEEN_EVERY_MS))
		await touchThreadSeen(session.sub, host.id);
	return {
		threads: threadComments(items, (c) => !c.hidden || admin || c.mine),
		canPost: session !== null,
		replyTo: url.searchParams.get('reply')
	};
}

/**
 * The four actions of a thread, over whatever `scopeOf` finds the subject
 * to be. The event type is the page's own (its params are typed), and the
 * actions are handed the same.
 */
export function threadActions<E extends Pick<RequestEvent, 'request'>>(scopeOf: (event: E) => Promise<ThreadScope>) {
	return {
		post: async (event: E) => {
			const scope = await scopeOf(event);
			const { host, session, admin, open } = scope;
			if (!session) return fail(401, { error: 'Sign in with Battle.net to comment.' });
			if (!open) return fail(400, { error: 'Not open for comments.' });
			const form = await event.request.formData();
			const raw = String(form.get('text') ?? '');
			const parent = String(form.get('parent') ?? '') || null;
			const v = validateComment(raw);
			if (!v.ok) return fail(400, { error: v.error, text: raw, parent });
			if (parent) {
				const p = await getComment(parent);
				if (!p || p.build !== host.id || p.deletedAt || (p.hiddenAt && !admin))
					return fail(404, { error: 'The comment you are answering is gone.', text: v.text, parent });
				const all = (await listComments(host.id)).map((c) => ({ id: c._id, parent: c.parent ?? null }));
				if (replyDepth(all, parent) > COMMENT_DEPTH_MAX)
					return fail(400, { error: 'This thread is deep enough; answer higher up.', text: v.text, parent });
			}
			if (v.images.length) {
				const mine = await imagesOwnedBy(session.sub, v.images);
				if (v.images.some((id) => !mine.has(id)))
					return fail(400, { error: 'One of the pictures is not one you uploaded.', text: v.text, parent });
			}
			if (!posts.hit(session.sub))
				return fail(429, { error: 'That is a lot of comments for one hour.', text: v.text, parent });
			const c = await addComment(host, authorOf(session), v.text, v.images, parent);
			// who this is news to: the one answered, and the guide's author
			const parentAuthor = parent ? (await getComment(parent))?.author.sub : null;
			const told = commentRecipients({ commenter: session.sub, owner: scope.owner, parentAuthor });
			// and whoever the words ping by handle, when that player has an account
			const pinged = await pingedAccounts(playerRefsIn(v.text), [session.sub, ...told.map((r) => r.sub)]);
			const base = { comment: c._id, host: host.id, subject: scope.subject, by: authorOf(session), excerpt: excerptOf(v.text) };
			await notify([
				...told.map((r) => ({ ...base, sub: r.sub, kind: r.kind })),
				...pinged.map((sub) => ({ ...base, sub, kind: 'mention' as const }))
			]);
			return { posted: c._id };
		},

		vote: async (event: E) => {
			const { host, session, open } = await scopeOf(event);
			if (!session) return fail(401, { error: 'Sign in with Battle.net to vote.' });
			if (!open) return fail(400, { error: 'Not open for comments.' });
			const form = await event.request.formData();
			const id = String(form.get('id') ?? '');
			const dir = Number(form.get('dir'));
			if (dir !== 1 && dir !== -1 && dir !== 0) return fail(400, { error: 'Up, down, or neither.' });
			const c = await getComment(id);
			if (!c || c.build !== host.id || c.deletedAt) return fail(404, { error: 'No such comment.' });
			if (c.author.sub === session.sub) return fail(400, { error: 'Your own comment. It is a good one, we know.' });
			if (!votes.hit(session.sub)) return fail(429, { error: 'That is a lot of votes for one hour.' });
			const score = await voteComment(host, id, session.sub, dir);
			return { voted: id, score };
		},

		react: async (event: E) => {
			const { host, session, open } = await scopeOf(event);
			if (!session) return fail(401, { error: 'Sign in with Battle.net to react.' });
			if (!open) return fail(400, { error: 'Not open for comments.' });
			const form = await event.request.formData();
			const id = String(form.get('id') ?? '');
			const emoji = String(form.get('emoji') ?? '');
			if (!isReaction(emoji)) return fail(400, { error: 'Not one of the faces.' });
			const c = await getComment(id);
			if (!c || c.build !== host.id || c.deletedAt) return fail(404, { error: 'No such comment.' });
			if (!reacts.hit(session.sub)) return fail(429, { error: 'That is a lot of faces for one minute.' });
			const counts = await toggleReaction('comment', id, session.sub, emoji);
			invalidateCache(`comments:${host.id}`);
			return { reacted: id, counts };
		},

		delete: async (event: E) => {
			const { host, session, admin } = await scopeOf(event);
			const form = await event.request.formData();
			const id = String(form.get('id') ?? '');
			const c = await getComment(id);
			if (!c || c.build !== host.id || c.deletedAt) return fail(404, { error: 'No such comment.' });
			if (!admin && !(session && c.author.sub === session.sub)) return fail(403, { error: 'Not yours.' });
			await deleteComment(host, id);
			return { deleted: true };
		},

		hide: async (event: E) => {
			const { host, admin } = await scopeOf(event);
			if (!admin) return fail(403, { error: 'Maintainer only.' });
			const form = await event.request.formData();
			const id = String(form.get('id') ?? '');
			const c = await getComment(id);
			if (!c || c.build !== host.id || c.deletedAt) return fail(404, { error: 'No such comment.' });
			await hideComment(host, id, !c.hiddenAt);
			return { hidden: !c.hiddenAt };
		}
	};
}
