/**
 * One message: its author may reword it (PATCH) or take it back (DELETE);
 * the maintainer may take any back. Both land on the stream for everyone.
 */
import { error, json } from '@sveltejs/kit';
import { dbConfigured } from '$lib/server/db';
import { deleteChat, editChat, getChat } from '$lib/server/chat';
import { chatViews } from '$lib/server/chatView';
import { isAdmin } from '$lib/server/admins';
import { validateChat } from '$lib/builds';
import type { RequestHandler } from './$types';

export const prerender = false;

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!dbConfigured()) error(404, 'Not available here.');
	const session = locals.session;
	if (!session) error(401, 'Sign in with Battle.net to chat.');
	const doc = await getChat(params.id);
	if (!doc) error(404, 'No such message.');
	if (doc.author.sub !== session.sub) error(403, 'Not yours.');
	const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
	const v = validateChat(typeof body?.text === 'string' ? body.text : '');
	if (!v.ok) error(400, v.error);
	const next = await editChat(doc, v.text);
	const [view] = await chatViews([next], session.sub);
	return json(view);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!dbConfigured()) error(404, 'Not available here.');
	const session = locals.session;
	if (!session) error(401, 'Sign in with Battle.net to chat.');
	const doc = await getChat(params.id);
	if (!doc) error(404, 'No such message.');
	if (doc.author.sub !== session.sub && !isAdmin(session)) error(403, 'Not yours.');
	await deleteChat(doc._id);
	return json({ deleted: doc._id });
};
