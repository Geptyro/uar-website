/**
 * SC2 presence heartbeats from the UAR Tray companion app.
 *
 * POST (cookie-auth): {status, uar, players?, displayTime?, roster?,
 * lobbyId?} on change + every 60s; entries go stale after 2 min without a
 * beat. An `ingame` beat withdraws the account's ready flag (playing ≠
 * available); a lobby KEEPS it — someone forming a lobby is recruiting,
 * and the badge tells the roster where they are.
 * DELETE (cookie-auth): explicit clear (app quit / SC2 exit).
 * GET (public): fresh lobby/ingame entries for the status chips.
 *
 * Changes broadcast on the ready SSE channel — clients refetch both
 * /api/ready and /api/presence on any 'change' event.
 */
import { error, json } from '@sveltejs/kit';
import {
	clearReady,
	dbConfigured,
	deletePresence,
	getActivePresence,
	getReadyPlayers,
	upsertPresence
} from '$lib/server/db';
import { publishReadyChange } from '$lib/server/events';
import { PRESENCE_STALE_MS, validateBeat, type PresenceEntry } from '$lib/presence';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async ({ setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	if (!dbConfigured()) return json({ players: [] });
	const docs = await getActivePresence(PRESENCE_STALE_MS);
	const players: PresenceEntry[] = docs.map((d) => ({
		battletag: d.battletag,
		toon: d.toon ?? null,
		avatar: d.avatar ?? null,
		status: d.status as 'lobby' | 'ingame',
		uar: d.uar,
		players: d.players,
		displayTime: d.displayTime,
		roster: d.roster,
		lobbyId: d.lobbyId ?? null
	}));
	return json({ players });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const s = locals.session;
	if (!s) error(401, 'sign in with Battle.net to report presence');
	if (!dbConfigured()) error(503, 'player database not configured');
	const beat = validateBeat(await request.json().catch(() => null));
	if (!beat) error(400, 'malformed presence heartbeat');

	await upsertPresence({
		_id: s.sub,
		battletag: s.battletag,
		...(s.toon ? { toon: s.toon } : {}),
		...(s.avatar ? { avatar: s.avatar } : {}),
		status: beat.status,
		uar: beat.uar,
		...(beat.players !== undefined ? { players: beat.players } : {}),
		...(beat.displayTime !== undefined ? { displayTime: beat.displayTime } : {}),
		...(beat.roster !== undefined ? { roster: beat.roster } : {}),
		...(beat.lobbyId != null ? { lobbyId: beat.lobbyId } : {}),
		at: new Date().toISOString()
	});

	// playing = not available: a started game withdraws the ready flag
	if (beat.status === 'ingame') {
		const ready = await getReadyPlayers();
		if (ready.some((r) => r._id === s.sub)) await clearReady(s.sub);
	}
	publishReadyChange();
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ locals }) => {
	const s = locals.session;
	if (!s) error(401, 'not signed in');
	if (!dbConfigured()) error(503, 'player database not configured');
	await deletePresence(s.sub);
	publishReadyChange();
	return json({ ok: true });
};
