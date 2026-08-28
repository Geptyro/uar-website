/**
 * The chat's messages: the newest page (or the one before `before`), and
 * where a new one is posted. A post lands on the stream for everyone; the
 * response carries the same view, so the sender needs no round trip.
 */
import { error, json } from '@sveltejs/kit';
import { rateLimiter } from 'sveltekit-commons/rate-limit';
import { dbConfigured } from '$lib/server/db';
import { CHAT_PAGE, listChat, postChat } from '$lib/server/chat';
import { chatViews } from '$lib/server/chatView';
import { authorOf } from '$lib/server/buildForm';
import { playerRefsIn, validateChat } from '$lib/builds';
import { excerptOf } from '$lib/builds';
import { notify, pingedAccounts } from '$lib/server/notifications';
import type { RequestHandler } from './$types';

export const prerender = false;

/** Messages per account and minute: a conversation, not a flood. */
const posts = rateLimiter({ limit: 20, windowMs: 60 * 1000 });

export const GET: RequestHandler = async ({ url, locals, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	if (!dbConfigured()) error(404, 'Not available here.');
	const before = url.searchParams.get('before');
	const docs = await listChat(before && /^\d{4}-\d{2}-\d{2}T/.test(before) ? before : null);
	return json({ messages: await chatViews(docs, locals.session?.sub ?? null), more: docs.length === CHAT_PAGE });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!dbConfigured()) error(404, 'Not available here.');
	const session = locals.session;
	if (!session) error(401, 'Sign in with Battle.net to chat.');
	const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
	const v = validateChat(typeof body?.text === 'string' ? body.text : '');
	if (!v.ok) error(400, v.error);
	if (!posts.hit(session.sub)) error(429, 'That is a lot of messages for one minute.');
	const doc = await postChat(authorOf(session), v.text);
	// a player named by handle is told, when that player has an account
	const pinged = await pingedAccounts(playerRefsIn(v.text), [session.sub]);
	await notify(
		pinged.map((sub) => ({
			sub,
			kind: 'mention' as const,
			comment: doc._id,
			host: 'chat',
			subject: { kind: 'chat' as const, title: 'the chat', href: '/chat' },
			by: authorOf(session),
			excerpt: excerptOf(v.text)
		}))
	);
	const [view] = await chatViews([doc], session.sub);
	return json(view, { status: 201 });
};
