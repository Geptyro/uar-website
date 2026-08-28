/**
 * "I am typing": the page says so every few seconds while the reader types;
 * the room hears it through the stream and forgets it a few seconds later.
 */
import { error, json } from '@sveltejs/kit';
import { getNamesByToon } from '$lib/server/db';
import { startedTyping, stoppedTyping } from '$lib/server/chat';
import type { RequestHandler } from './$types';

export const prerender = false;

export const POST: RequestHandler = async ({ request, locals }) => {
	const session = locals.session;
	if (!session) error(401, 'Sign in with Battle.net to chat.');
	const body = (await request.json().catch(() => null)) as { typing?: unknown } | null;
	if (body?.typing === false) {
		stoppedTyping(session.sub);
		return json({ ok: true });
	}
	const names = await getNamesByToon();
	const name = (session.toon && names[session.toon]) || session.battletag.replace(/#\d+$/, '');
	startedTyping(session.sub, name);
	return json({ ok: true });
};
