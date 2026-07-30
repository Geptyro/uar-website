/**
 * SC2 presence heartbeats from the UAR Tray companion app.
 *
 * POST (cookie-auth): {status, uar, players?, displayTime?, roster?,
 * lobbyId?} on change + every 60s; entries go stale after 2 min without a
 * beat. An `ingame` beat withdraws the account's ready flag (playing ≠
 * available); a lobby KEEPS it — someone forming a lobby is recruiting,
 * and the badge tells the roster where they are.
 * DELETE (cookie-auth): explicit clear (app quit / SC2 exit).
 * GET (public): fresh lobby/ingame entries for the status chips, already
 * grouped into lobbies/games. Grouping is the server's job: every client
 * then draws the same picture, and a change to what counts as one game
 * ships with a deploy instead of waiting for companion installs to update
 * (`groups` is additive — clients that predate it still group locally).
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
	getNamesByToon,
	getPlayerDirectory,
	getReadyPlayers,
	upsertPresence
} from '$lib/server/db';
import { publishReadyChange } from '$lib/server/events';
import {
	PRESENCE_STALE_MS,
	bareName,
	splitPresence,
	validateBeat,
	type PresenceEntry
} from '$lib/presence';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async ({ locals, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	if (!dbConfigured()) {
		return json({ players: [], me: null, known: {}, groups: { lobbies: [], games: [] } });
	}
	const docs = await getActivePresence(PRESENCE_STALE_MS);
	// the widget colors its own chip by where the session user is
	const mine = locals.session ? docs.find((d) => d._id === locals.session!.sub) : undefined;
	// a heartbeat only carries the account; the profile name comes from the link
	const names = docs.length > 0 ? await getNamesByToon() : {};
	const players: PresenceEntry[] = docs.map((d) => ({
		battletag: d.battletag,
		name: (d.toon ? names[d.toon] : null) ?? null,
		toon: d.toon ?? null,
		avatar: d.avatar ?? null,
		status: d.status as 'lobby' | 'ingame',
		uar: d.uar,
		players: d.players,
		displayTime: d.displayTime,
		roster: d.roster,
		lobbyId: d.lobbyId ?? null,
		selfName: d.selfName
	}));

	// resolve the roster names we recognise, so a live lobby can link to the
	// profiles of players who never installed the companion app. Keyed bare,
	// like the directory and like the lookup on the other side: a lobby roster
	// straight from the battlelobby file spells names "Name#451", and matching
	// that against the directory recognised nobody.
	const rosterNames = new Set(players.flatMap((p) => (p.roster ?? []).map(bareName)));
	const known: Record<string, { toon: string; avatar?: string }> = {};
	if (rosterNames.size > 0) {
		const directory = await getPlayerDirectory();
		for (const name of rosterNames) if (directory[name]) known[name] = directory[name];
	}
	return json({
		players,
		me: mine?.status ?? null,
		known,
		groups: splitPresence(players)
	});
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
		...(beat.selfName ? { selfName: beat.selfName } : {}),
		at: new Date().toISOString()
	});

	// in a lobby or game = not looking anymore: withdraw the ready flag
	if (beat.status === 'ingame' || beat.status === 'lobby') {
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
