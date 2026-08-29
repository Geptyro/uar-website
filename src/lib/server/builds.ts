/**
 * The store behind community guides ($lib/builds): three small collections on
 * the same cluster as everything else.
 *
 * - builds: one doc per build (BuildDoc), a random id, (mos, slug) unique.
 * - buildVotes: one doc per account that voted a guide up or down. The
 *   counts are written onto the guide, never aggregated on read (see db.ts
 *   on why every read here has to be narrow).
 * - buildImages: one doc per uploaded picture, keyed by the id in its URL,
 *   with the account that sent it. What the sweep reads to drop the pictures
 *   no build shows any more.
 * - buildComments: one doc per comment, under its build. The count is
 *   written onto the guide, like the score.
 *
 * Reads go through the same cache as the rest of the site (`cached` in
 * db.ts), and every write here drops the keys it could have changed, so a
 * list never shows a guide its author just unpublished.
 */

import { randomBytes } from 'node:crypto';
import { MongoServerError } from 'mongodb';
import {
	cached,
	db,
	dbConfigured,
	getAccount,
	getPlayerSummary,
	invalidateCache
} from './db.ts';
import { bucketConfigured, deleteObject } from './replay/s3.ts';
import type { Session } from './session.ts';
// relative and node-loadable, like the rest of this file's imports: the
// image sweep is also run from a plain node script, where `$lib` is no path
import rawMos from '../data/mos.json' with { type: 'json' };
import { mosTracks, type RankKey } from '../ranks.ts';
import { dropReactions } from './reactions.ts';
import {
	blocksFromSections,
	imageRefs,
	slugify,
	summarize,
	type BuildAuthor,
	type BuildDoc,
	type BuildInput,
	type BuildListing,
	type BuildSection,
	type BuildStatus
} from '../builds.ts';

export interface BuildImageDoc {
	/** 16 hex digits: the id in the picture's URL and its bucket key. */
	_id: string;
	/** Who uploaded it. Only their builds may show it. */
	sub: string;
	bytes: number;
	width: number;
	height: number;
	createdAt: string;
}

export interface BuildCommentDoc {
	_id: string;
	build: string;
	author: BuildAuthor;
	/** The comment this one answers, for a thread; absent at the top level. */
	parent?: string;
	/** Markdown, the guide's own (see validateComment). Empty once deleted. */
	text: string;
	/** The pictures the text shows, for the sweep that drops the ones nothing shows. */
	images: string[];
	/** Up minus down, written with each vote (see voteComment), never counted on read. */
	score: number;
	createdAt: string;
	/** Reworded by its author since; the thread says so under the name. */
	editedAt?: string;
	/** Set by the maintainer; a hidden comment stays for its author and the maintainer. */
	hiddenAt?: string;
	/** Faces by count, written with every reaction (see $lib/server/reactions). */
	reactions?: Record<string, number>;
	/**
	 * Taken back by its author while answers stood under it: the doc stays as
	 * the stump the answers hang from, with no text and no name on it. A
	 * comment nobody answered is deleted outright instead.
	 */
	deletedAt?: string;
}

export interface BuildCommentVoteDoc {
	_id: string; // `${comment}:${sub}`
	comment: string;
	build: string;
	sub: string;
	/** 1 up, -1 down. Taking a vote back deletes the doc. */
	dir: 1 | -1;
	at: string;
}

export interface BuildVoteDoc {
	_id: string; // `${build}:${sub}`
	build: string;
	sub: string;
	/** 1 up, -1 down; absent on a vote from before there was a down, which counted as up. */
	dir?: 1 | -1;
	at: string;
}

export interface BuildTally {
	score: number;
	ups: number;
	downs: number;
}

/** Where a picture's bytes live in the bucket. */
export const imageKey = (id: string) => `builds/${id}.webp`;

/** How long an upload that no build shows is kept: an editor left open overnight keeps its pictures. */
const IMAGE_GRACE_MS = 24 * 60 * 60_000;

const newId = () => randomBytes(8).toString('hex');

const isDuplicateKey = (e: unknown) => e instanceof MongoServerError && e.code === 11000;

export async function ensureBuildIndexes(): Promise<void> {
	if (!dbConfigured()) return;
	const d = await db();
	await Promise.all([
		// the URL of a guide, and what makes a slug unique within its class
		d.collection('builds').createIndex({ mos: 1, slug: 1 }, { name: 'mos_slug', unique: true }),
		// a class's list, best first
		d.collection('builds').createIndex({ mos: 1, status: 1, score: -1 }, { name: 'mos_status_score' }),
		// an author's own list, drafts included
		d.collection('builds').createIndex({ 'author.sub': 1 }, { name: 'author' }),
		// the guides that moved last, across classes: the home page's feed
		d.collection('builds').createIndex({ status: 1, updatedAt: -1 }, { name: 'status_updatedAt' }),
		// the sweep's question: which builds show this picture? (multikey)
		d.collection('builds').createIndex({ images: 1 }, { name: 'images' }),
		d.collection('buildVotes').createIndex({ build: 1 }, { name: 'build' }),
		// a guide's comments, oldest first
		d.collection('buildComments').createIndex({ build: 1, createdAt: 1 }, { name: 'build_createdAt' }),
		// one reader's votes across a guide's comments, for the arrows they lit
		d.collection('buildCommentVotes').createIndex({ build: 1, sub: 1 }, { name: 'build_sub' }),
		// which comments show a picture (multikey), for the sweep
		d.collection('buildComments').createIndex({ images: 1 }, { name: 'images' }),
		// the newest comments across every thread, for the activity list
		d.collection('buildComments').createIndex({ createdAt: -1 }, { name: 'createdAt' }),
		// a comment's votes, for its score and for dropping them with it
		d.collection('buildCommentVotes').createIndex({ comment: 1 }, { name: 'comment' }),
		d.collection('buildImages').createIndex({ createdAt: 1 }, { name: 'createdAt' }),
		d.collection('buildImages').createIndex({ sub: 1, createdAt: 1 }, { name: 'sub_createdAt' })
	]);
}

function invalidateBuild(b: Pick<BuildDoc, '_id' | 'mos' | 'slug' | 'author'>): void {
	invalidateCache(
		`builds:${b.mos}`,
		'builds:recent',
		'activity:recent',
		`build:${b.mos}:${b.slug}`,
		`buildsBy:${b.author.sub}`,
		`comments:${b._id}`
	);
}

/* ---------- reads ---------- */

/** What a document held before blocks: read as blocks, never written back as such. */
type StoredBuild = BuildDoc & { sections?: BuildSection[] };

/**
 * A stored build in today's shape. Documents saved before the block tree
 * carry `sections`; they are converted on read, and the next save writes
 * blocks. Nothing rewrites a document a reader merely opened.
 */
/** The rank tracks a class can be played on, from its unlock in mos.json. */
function openTracksOf(mosId: string): RankKey[] {
	const m = (rawMos as { id: string; unlock?: Partial<Record<RankKey, unknown>> | null }[]).find((x) => x.id === mosId);
	return mosTracks(m?.unlock);
}

function normalizeBuild(doc: StoredBuild | null): BuildDoc | null {
	if (!doc) return null;
	const { sections, ...rest } = doc;
	// a class open to one rank track is played on it: a guide saved before ranks existed says so too
	const open = openTracksOf(rest.mos);
	const ranks = rest.ranks?.length ? rest.ranks : open.length === 1 ? open : [];
	const withSis = { ...rest, sis: rest.sis ?? [], ranks };
	if (withSis.blocks) return withSis;
	return { ...withSis, blocks: blocksFromSections(sections ?? []) };
}

const LISTING_PROJECTION = { blocks: 0, sections: 0 } as const;

/** The published guides of a class, most helpful first. */
export async function listBuilds(mos: string): Promise<BuildListing[]> {
	return cached(`builds:${mos}`, async () => {
		const d = await db();
		return d
			.collection<BuildDoc>('builds')
			.find({ mos, status: 'published' }, { projection: LISTING_PROJECTION })
			.sort({ score: -1, publishedAt: -1 })
			.limit(100)
			.toArray() as Promise<BuildListing[]>;
	});
}

/** The published guides that moved last, across every class: the home page's handful. */
export async function listRecentBuilds(n: number): Promise<BuildListing[]> {
	return cached('builds:recent', async () => {
		const d = await db();
		return d
			.collection<BuildDoc>('builds')
			.find({ status: 'published' }, { projection: LISTING_PROJECTION })
			.sort({ updatedAt: -1 })
			.limit(n)
			.toArray() as Promise<BuildListing[]>;
	});
}

/** Everything one account has written for a class, drafts and hidden included, newest first. */
export async function listBuildsBy(sub: string, mos: string): Promise<BuildListing[]> {
	return cached(`buildsBy:${sub}:${mos}`, async () => {
		const d = await db();
		return d
			.collection<BuildDoc>('builds')
			.find({ mos, 'author.sub': sub }, { projection: LISTING_PROJECTION })
			.sort({ updatedAt: -1 })
			.toArray() as Promise<BuildListing[]>;
	});
}

export async function getBuild(mos: string, slug: string): Promise<BuildDoc | null> {
	return cached(`build:${mos}:${slug}`, async () => {
		const d = await db();
		return normalizeBuild(await d.collection<StoredBuild>('builds').findOne({ mos, slug }));
	});
}

/** One reader's vote on a guide: 1, -1, or 0 for none. */
export async function myBuildVote(build: string, sub: string): Promise<1 | -1 | 0> {
	const d = await db();
	const v = await d.collection<BuildVoteDoc>('buildVotes').findOne({ _id: `${build}:${sub}` }, { projection: { dir: 1 } });
	return v ? (v.dir ?? 1) : 0;
}

/* ---------- who may do what ---------- */

/**
 * Whether an account may publish: one of its linked profiles has been seen in
 * an uploaded replay. Anyone can sign in with Battle.net; only players have
 * replays, which is the whole of the spam filter and costs nothing to run.
 */
export async function canPublish(session: Session): Promise<boolean> {
	return cached(`canPublish:${session.sub}`, async () => {
		const account = await getAccount(session.sub);
		for (const toon of account?.toons ?? []) if (await getPlayerSummary(toon)) return true;
		return false;
	});
}

/* ---------- writes ---------- */

function fromInput(input: BuildInput) {
	return {
		title: input.title,
		modes: input.modes,
		ranks: input.ranks,
		skills: input.skills,
		sis: input.sis,
		blocks: input.blocks,
		summary: summarize(input.blocks),
		images: imageRefs(input.blocks)
	};
}

/**
 * A new build. The slug is the title's, with a counter when the class already
 * has one by that name; the unique index is what decides, so two saves racing
 * for the same title cannot both win it.
 */
export async function createBuild(
	mos: string,
	input: BuildInput,
	author: BuildAuthor,
	now: Date = new Date()
): Promise<BuildDoc> {
	const d = await db();
	const iso = now.toISOString();
	const base = slugify(input.title);
	const doc: BuildDoc = {
		_id: newId(),
		mos,
		slug: base,
		author,
		...fromInput(input),
		status: input.publish ? 'published' : 'draft',
		score: 0,
		createdAt: iso,
		updatedAt: iso,
		...(input.publish ? { publishedAt: iso } : {})
	};
	for (let n = 1; ; n++) {
		doc.slug = n === 1 ? base : `${base}-${n}`;
		try {
			await d.collection<BuildDoc>('builds').insertOne(doc);
			break;
		} catch (e) {
			if (!isDuplicateKey(e) || n >= 50) throw e;
		}
	}
	invalidateBuild(doc);
	return doc;
}

/**
 * A save of an existing build. Slug, author, score and dates of record stay;
 * the state moves only forward from the editor (a draft may publish, a
 * published build stays published, a hidden one stays hidden until the
 * maintainer says otherwise). Unpublishing is its own action on the page.
 */
export async function updateBuild(
	build: BuildDoc,
	input: BuildInput,
	now: Date = new Date()
): Promise<BuildDoc> {
	const d = await db();
	const iso = now.toISOString();
	const publishing = build.status === 'draft' && input.publish;
	const status: BuildStatus = publishing ? 'published' : build.status;
	const set = {
		...fromInput(input),
		status,
		updatedAt: iso,
		...(publishing ? { publishedAt: iso } : {})
	};
	await d
		.collection<BuildDoc>('builds')
		.updateOne({ _id: build._id }, { $set: set, $unset: { sections: '' } });
	invalidateBuild(build);
	return { ...build, ...set };
}

export async function setBuildStatus(
	build: BuildDoc,
	status: BuildStatus,
	now: Date = new Date()
): Promise<void> {
	const d = await db();
	const iso = now.toISOString();
	const set: Partial<BuildDoc> = { status };
	if (status === 'published' && !build.publishedAt) set.publishedAt = iso;
	if (status === 'hidden') set.hiddenAt = iso;
	await d.collection<BuildDoc>('builds').updateOne({ _id: build._id }, { $set: set });
	invalidateBuild(build);
}

/** Gone for good: the doc, its votes, its comments, and the pictures only it showed. */
export async function deleteBuild(build: BuildDoc): Promise<void> {
	const d = await db();
	await d.collection<BuildDoc>('builds').deleteOne({ _id: build._id });
	await d.collection<BuildVoteDoc>('buildVotes').deleteMany({ build: build._id });
	await d.collection<BuildCommentDoc>('buildComments').deleteMany({ build: build._id });
	await d.collection<BuildCommentVoteDoc>('buildCommentVotes').deleteMany({ build: build._id });
	invalidateBuild(build);
	// what it showed may be on another of the author's builds: the sweep,
	// which asks that question properly, is what drops the rest
}

/** Vote a guide up (1), down (-1), or take the vote back (0). Returns the new tally. */
export async function voteBuild(
	build: BuildDoc,
	sub: string,
	dir: 1 | -1 | 0,
	now: Date = new Date()
): Promise<BuildTally> {
	const d = await db();
	const votes = d.collection<BuildVoteDoc>('buildVotes');
	const _id = `${build._id}:${sub}`;
	if (dir === 0) await votes.deleteOne({ _id });
	else
		await votes.updateOne(
			{ _id },
			{ $set: { dir, at: now.toISOString() }, $setOnInsert: { build: build._id, sub } },
			{ upsert: true }
		);
	const [t] = await votes
		.aggregate<{ ups: number; downs: number }>([
			{ $match: { build: build._id } },
			{
				$group: {
					_id: null,
					ups: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$dir', 1] }, 1] }, 1, 0] } },
					downs: { $sum: { $cond: [{ $eq: ['$dir', -1] }, 1, 0] } }
				}
			}
		])
		.toArray();
	const tally: BuildTally = { ups: t?.ups ?? 0, downs: t?.downs ?? 0, score: (t?.ups ?? 0) - (t?.downs ?? 0) };
	await d.collection<BuildDoc>('builds').updateOne({ _id: build._id }, { $set: tally });
	invalidateBuild(build);
	return tally;
}

/* ---------- comments ---------- */

/**
 * What a thread hangs from: a guide, or a class page. `id` is the value the
 * comment docs carry in `build` (the field kept its name from when only
 * guides had threads); `touched` runs after any change, for whatever counts
 * or caches the subject keeps.
 */
export interface CommentHost {
	id: string;
	touched: () => Promise<void>;
}

/** A guide's thread: the count on the guide is rewritten with every change. */
export const buildHost = (build: BuildDoc): CommentHost => ({
	id: build._id,
	touched: () => recountComments(build)
});

/** A class page's thread, keyed `mos:<id>`; nothing to count, only the cache to drop. */
export const mosHost = (mosId: string): CommentHost => ({
	id: `mos:${mosId}`,
	touched: async () => invalidateCache(`comments:mos:${mosId}`)
});

/** An entity page's thread, keyed `entity:<id>`, the same way. */
export const entityHost = (unitId: string): CommentHost => ({
	id: `entity:${unitId}`,
	touched: async () => invalidateCache(`comments:entity:${unitId}`)
});

/** The newest comments across every thread that stand (not hidden, not taken back): the activity list. */
export async function listRecentComments(n: number): Promise<BuildCommentDoc[]> {
	return cached('comments:recent', async () => {
		const d = await db();
		return d
			.collection<BuildCommentDoc>('buildComments')
			.find({ hiddenAt: { $exists: false }, deletedAt: { $exists: false } })
			.sort({ createdAt: -1 })
			.limit(n)
			.toArray();
	});
}

/** Several guides by id, as listings; what the activity list names its guide threads with. */
export async function getBuildsByIds(ids: string[]): Promise<BuildListing[]> {
	if (!ids.length) return [];
	const d = await db();
	return d
		.collection<BuildDoc>('builds')
		.find({ _id: { $in: ids } }, { projection: LISTING_PROJECTION })
		.toArray() as Promise<BuildListing[]>;
}

/** A subject's comments, oldest first, hidden ones included: the page decides who sees those. */
export async function listComments(build: string): Promise<BuildCommentDoc[]> {
	return cached(`comments:${build}`, async () => {
		const d = await db();
		return d
			.collection<BuildCommentDoc>('buildComments')
			.find({ build })
			.sort({ createdAt: 1 })
			.limit(500)
			.toArray();
	});
}

/** The count a guide carries: comments that stand, neither hidden nor taken back. */
async function recountComments(build: BuildDoc): Promise<void> {
	const d = await db();
	const comments = await d
		.collection<BuildCommentDoc>('buildComments')
		.countDocuments({ build: build._id, hiddenAt: { $exists: false }, deletedAt: { $exists: false } });
	await d.collection<BuildDoc>('builds').updateOne({ _id: build._id }, { $set: { comments } });
	invalidateBuild(build);
}

/** A comment, at the top or under `parent` (a comment of the same build; the page checks). */
export async function addComment(
	host: CommentHost,
	author: BuildAuthor,
	text: string,
	images: string[],
	parent: string | null = null,
	now: Date = new Date()
): Promise<BuildCommentDoc> {
	const d = await db();
	const doc: BuildCommentDoc = {
		_id: newId(),
		build: host.id,
		author,
		...(parent ? { parent } : {}),
		text,
		images,
		score: 0,
		createdAt: now.toISOString()
	};
	await d.collection<BuildCommentDoc>('buildComments').insertOne(doc);
	invalidateCache('comments:recent', 'activity:recent');
	await host.touched();
	return doc;
}

export async function getComment(id: string): Promise<BuildCommentDoc | null> {
	const d = await db();
	return d.collection<BuildCommentDoc>('buildComments').findOne({ _id: id });
}

/**
 * Reword a comment. Its author's only, and only while it stands: a stump has
 * no words to change and no author to change them. The pictures it shows are
 * rewritten with the words, so one dropped from the text stops being one this
 * comment holds on to (see the image sweep).
 */
export async function editComment(
	host: CommentHost,
	id: string,
	text: string,
	images: string[],
	now: Date = new Date()
): Promise<string> {
	const d = await db();
	const editedAt = now.toISOString();
	await d
		.collection<BuildCommentDoc>('buildComments')
		.updateOne({ _id: id, build: host.id }, { $set: { text, images, editedAt } });
	invalidateCache(`comments:${host.id}`, 'comments:recent', 'activity:recent');
	await host.touched();
	return editedAt;
}

/**
 * Take a comment back. One with answers under it is left as a stump (no
 * text, no author) so the answers keep their place; one without is gone.
 */
export async function deleteComment(host: CommentHost, id: string, now: Date = new Date()): Promise<void> {
	const d = await db();
	const comments = d.collection<BuildCommentDoc>('buildComments');
	const answered = (await comments.countDocuments({ build: host.id, parent: id }, { limit: 1 })) > 0;
	if (answered) {
		await comments.updateOne(
			{ _id: id, build: host.id },
			{ $set: { text: '', images: [], author: { sub: '', battletag: '' }, deletedAt: now.toISOString() } }
		);
	} else {
		const gone = await comments.findOneAndDelete({ _id: id, build: host.id });
		// the stumps above it that held nothing but this go with it
		for (let p = gone?.parent; p; ) {
			const stump = await comments.findOne({ _id: p, build: host.id });
			if (!stump?.deletedAt || (await comments.countDocuments({ build: host.id, parent: p }, { limit: 1 }))) break;
			await comments.deleteOne({ _id: p });
			p = stump.parent;
		}
	}
	await d.collection<BuildCommentVoteDoc>('buildCommentVotes').deleteMany({ comment: id });
	await dropReactions('comment', id);
	invalidateCache('comments:recent', 'activity:recent');
	await host.touched();
}

/** Vote a comment up (1), down (-1), or take the vote back (0). Returns the new score. */
export async function voteComment(
	host: CommentHost,
	id: string,
	sub: string,
	dir: 1 | -1 | 0,
	now: Date = new Date()
): Promise<number> {
	const d = await db();
	const votes = d.collection<BuildCommentVoteDoc>('buildCommentVotes');
	const _id = `${id}:${sub}`;
	if (dir === 0) await votes.deleteOne({ _id });
	else
		await votes.updateOne(
			{ _id },
			{ $set: { dir, at: now.toISOString() }, $setOnInsert: { comment: id, build: host.id, sub } },
			{ upsert: true }
		);
	const [sum] = await votes
		.aggregate<{ score: number }>([{ $match: { comment: id } }, { $group: { _id: null, score: { $sum: '$dir' } } }])
		.toArray();
	const score = sum?.score ?? 0;
	await d.collection<BuildCommentDoc>('buildComments').updateOne({ _id: id, build: host.id }, { $set: { score } });
	invalidateCache(`comments:${host.id}`);
	invalidateCache('comments:recent', 'activity:recent');
	await host.touched();
	return score;
}

/** One reader's votes on a guide's comments: comment id -> direction. */
export async function commentVotesFor(build: string, sub: string): Promise<Record<string, 1 | -1>> {
	const d = await db();
	const docs = await d
		.collection<BuildCommentVoteDoc>('buildCommentVotes')
		.find({ build, sub }, { projection: { comment: 1, dir: 1 } })
		.toArray();
	return Object.fromEntries(docs.map((v) => [v.comment, v.dir]));
}

export async function hideComment(host: CommentHost, id: string, hidden: boolean, now: Date = new Date()): Promise<void> {
	const d = await db();
	await d
		.collection<BuildCommentDoc>('buildComments')
		.updateOne({ _id: id, build: host.id }, hidden ? { $set: { hiddenAt: now.toISOString() } } : { $unset: { hiddenAt: '' } });
	invalidateCache('comments:recent', 'activity:recent');
	await host.touched();
}

/* ---------- pictures ---------- */

export async function recordImage(doc: BuildImageDoc): Promise<void> {
	const d = await db();
	await d.collection<BuildImageDoc>('buildImages').insertOne(doc);
}

/** How many pictures an account has sent since `since` (ISO): the upload limit's counter. */
export async function countImagesSince(sub: string, since: string): Promise<number> {
	const d = await db();
	return d.collection<BuildImageDoc>('buildImages').countDocuments({ sub, createdAt: { $gte: since } });
}

/** Which of these ids are pictures this account uploaded. */
export async function imagesOwnedBy(sub: string, ids: string[]): Promise<Set<string>> {
	if (!ids.length) return new Set();
	const d = await db();
	const docs = await d
		.collection<BuildImageDoc>('buildImages')
		.find({ _id: { $in: ids }, sub }, { projection: { _id: 1 } })
		.toArray();
	return new Set(docs.map((x) => x._id));
}

/**
 * Drop the pictures nothing shows: uploaded and never saved into a guide, or
 * edited out of one, or left behind by a deleted build. A day's grace, so an
 * editor left open overnight keeps its uploads. Run from the clock in
 * hooks.server.ts, never in dev, for the reasons the replay sweep gives.
 *
 * Two narrow reads: the pictures old enough to ask about, and the guides
 * (or comments) whose `images` name any of them (multikey index). Everything else is a
 * delete.
 */
export async function sweepBuildImages(now: Date = new Date()): Promise<number> {
	if (!dbConfigured() || !bucketConfigured()) return 0;
	const d = await db();
	const images = d.collection<BuildImageDoc>('buildImages');
	const since = new Date(now.getTime() - IMAGE_GRACE_MS).toISOString();
	const old = await images
		.find({ createdAt: { $lt: since } }, { projection: { _id: 1 } })
		.limit(500)
		.toArray();
	if (!old.length) return 0;
	const ids = old.map((i) => i._id);
	const [inBuilds, inComments] = await Promise.all([
		d
			.collection<BuildDoc>('builds')
			.find({ images: { $in: ids } }, { projection: { images: 1 } })
			.toArray(),
		d
			.collection<BuildCommentDoc>('buildComments')
			.find({ images: { $in: ids } }, { projection: { images: 1 } })
			.toArray()
	]);
	const shown = new Set([...inBuilds, ...inComments].flatMap((b) => b.images));
	let dropped = 0;
	for (const id of ids) {
		if (shown.has(id)) continue;
		await deleteObject(imageKey(id));
		await images.deleteOne({ _id: id });
		dropped++;
	}
	return dropped;
}
