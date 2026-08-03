/**
 * "Send a test notification" — delivers one real notification to the caller's
 * own devices and nobody else's.
 *
 * The only way to find out whether a browser will actually raise a
 * notification is to send it one: permission can be granted and the
 * subscription stored while the service worker, the VAPID keys or the push
 * service still get it wrong, and every one of those failures is silent. This
 * writes no roster row, so it cannot put a player who does not exist on the
 * live ready list.
 */
import { error, json } from '@sveltejs/kit';
import { sendTestPush } from '$lib/server/notify';
import type { RequestHandler } from './$types';

export const prerender = false;

// one account, one test every few seconds — a button somebody leans on should
// not turn into a queue of pushes arriving a minute later
const GAP_MS = 5_000;
const lastBySub = new Map<string, number>();

export const POST: RequestHandler = async ({ locals, request }) => {
	const s = locals.session;
	if (!s) error(401, 'sign in with Battle.net to test notifications');

	const last = lastBySub.get(s.sub) ?? 0;
	if (Date.now() - last < GAP_MS) error(429, 'Give the last test a moment to arrive.');
	lastBySub.set(s.sub, Date.now());

	const body = (await request.json().catch(() => null)) as { topic?: unknown } | null;
	const topic = body?.topic === 'lobby' ? 'lobby' : 'ready';

	// named as the player would recognise themselves, so the headline reads
	// like the real one instead of like a placeholder
	const who = s.battletag.split('#')[0] || s.battletag;
	const result = await sendTestPush(s.sub, who, topic);
	if (result.devices === 0) {
		error(409, 'No notification-enabled browser is registered on this account yet.');
	}
	return json(result);
};
