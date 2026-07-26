/**
 * "Ready to play" flags for the top-bar widget. GET = who is currently
 * flagged (public); POST / DELETE = flag or unflag the signed-in account.
 * Flags last one hour (READY_DURATION_MS) and expire silently; re-flagging
 * restarts the hour.
 */
import { error, json } from '@sveltejs/kit';
import { clearReady, dbConfigured, getPresence, getReadyPlayers, setReady } from '$lib/server/db';
import { publishReadyChange } from '$lib/server/events';
import { READY_DURATION_MS, type ReadyPlayer } from '$lib/ready';
import { PRESENCE_STALE_MS } from '$lib/presence';
import type { RequestHandler } from './$types';

export const prerender = false;

// per-account toggle limit — flag/unflag flapping is visible to everyone
// (SSE + notifications in the companion app), so keep it civil. In-memory
// like the upload limiters: single always-on machine, restart clears it.
const TOGGLE_LIMIT = 8;
const TOGGLE_WINDOW_MS = 10 * 60 * 1000;
const togglesBySub = new Map<string, number[]>();

function toggleLimited(sub: string): boolean {
	const list = (togglesBySub.get(sub) ?? []).filter((t) => Date.now() - t < TOGGLE_WINDOW_MS);
	togglesBySub.set(sub, list);
	if (list.length >= TOGGLE_LIMIT) return true;
	list.push(Date.now());
	return false;
}

async function state(
	sub: string | undefined
): Promise<{ me: boolean; until: string | null; players: ReadyPlayer[] }> {
	const docs = dbConfigured() ? await getReadyPlayers() : [];
	const mine = sub === undefined ? undefined : docs.find((p) => p._id === sub);
	return {
		me: mine !== undefined,
		until: mine?.until ?? null,
		players: docs.map((p) => ({
			battletag: p.battletag,
			toon: p.toon ?? null,
			avatar: p.avatar ?? null,
			until: p.until
		}))
	};
}

export const GET: RequestHandler = async ({ locals, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	return json(await state(locals.session?.sub));
};

export const POST: RequestHandler = async ({ locals }) => {
	const s = locals.session;
	if (!s) error(401, 'sign in with Battle.net to flag yourself as ready');
	if (!dbConfigured()) error(503, 'player database not configured');
	// in a lobby or game = not looking: block flagging while a fresh
	// heartbeat says so (the same transition also auto-withdraws the flag)
	const presence = await getPresence(s.sub);
	if (
		presence &&
		presence.status !== 'menus' &&
		Date.now() - Date.parse(presence.at) < PRESENCE_STALE_MS
	) {
		error(
			409,
			presence.status === 'ingame'
				? 'You are in a game — flag yourself again when it ends.'
				: 'You are in a lobby — no need for the flag anymore.'
		);
	}
	if (toggleLimited(s.sub)) error(429, 'Too many ready toggles — give it a few minutes.');
	const now = new Date();
	await setReady({
		_id: s.sub,
		battletag: s.battletag,
		...(s.toon ? { toon: s.toon } : {}),
		...(s.avatar ? { avatar: s.avatar } : {}),
		since: now.toISOString(),
		until: new Date(now.getTime() + READY_DURATION_MS).toISOString()
	});
	publishReadyChange();
	return json(await state(s.sub));
};

export const DELETE: RequestHandler = async ({ locals }) => {
	const s = locals.session;
	if (!s) error(401, 'not signed in');
	if (!dbConfigured()) error(503, 'player database not configured');
	if (toggleLimited(s.sub)) error(429, 'Too many ready toggles — give it a few minutes.');
	await clearReady(s.sub);
	publishReadyChange();
	return json(await state(s.sub));
};
