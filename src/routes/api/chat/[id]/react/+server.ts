/** A face on a message, or off again; the message lands on the stream with its new counts. */
import { error, json } from '@sveltejs/kit';
import { rateLimiter } from 'sveltekit-commons/rate-limit';
import { dbConfigured } from '$lib/server/db';
import { getChat, reactChat } from '$lib/server/chat';
import { chatViews } from '$lib/server/chatView';
import { isReaction } from '$lib/reactions';
import type { RequestHandler } from './$types';

export const prerender = false;

const reacts = rateLimiter({ limit: 60, windowMs: 60 * 1000 });

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!dbConfigured()) error(404, 'Not available here.');
	const session = locals.session;
	if (!session) error(401, 'Sign in with Battle.net to react.');
	const doc = await getChat(params.id);
	if (!doc) error(404, 'No such message.');
	const body = (await request.json().catch(() => null)) as { emoji?: unknown } | null;
	if (!isReaction(body?.emoji)) error(400, 'Not one of the faces.');
	if (!reacts.hit(session.sub)) error(429, 'That is a lot of faces for one minute.');
	const next = await reactChat(doc, session.sub, body.emoji);
	const [view] = await chatViews([next], session.sub);
	return json(view);
};
