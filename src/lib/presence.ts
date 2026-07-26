/**
 * SC2 presence ("in lobby / in game") — shared types and pure helpers for
 * the /api/presence route and the top-bar widget. Dependency-free so plain
 * node:test can load it (see CLAUDE.md). Heartbeats come from the UAR Tray
 * companion app (see its docs/sc2-detection.md for what is detectable).
 */

/** A heartbeat becomes stale this long after its last update. */
export const PRESENCE_STALE_MS = 2 * 60 * 1000;

export type PresenceStatus = 'menus' | 'lobby' | 'ingame';

/** What the companion app sends (POST /api/presence). */
export interface PresenceBeat {
	status: PresenceStatus;
	uar: boolean;
	/** human players in the game/lobby */
	players?: number;
	/** game clock, seconds */
	displayTime?: number;
	/** in game: display names; in lobby: battletags */
	roster?: string[];
	/** battlelobby m_randomValue — groups members of one lobby/game */
	lobbyId?: number | null;
}

/** One public presence entry (GET /api/presence). */
export interface PresenceEntry extends PresenceBeat {
	battletag: string;
	toon: string | null;
	avatar: string | null;
	status: 'lobby' | 'ingame';
}

/** Validates an incoming heartbeat; returns null when malformed. */
export function validateBeat(body: unknown): PresenceBeat | null {
	const b = body as Record<string, unknown>;
	if (!b || typeof b !== 'object') return null;
	if (b.status !== 'menus' && b.status !== 'lobby' && b.status !== 'ingame') return null;
	if (typeof b.uar !== 'boolean') return null;
	const beat: PresenceBeat = { status: b.status, uar: b.uar };
	if (typeof b.players === 'number' && b.players >= 0 && b.players <= 64) {
		beat.players = Math.floor(b.players);
	}
	if (typeof b.displayTime === 'number' && b.displayTime >= 0 && b.displayTime < 86_400 * 7) {
		beat.displayTime = Math.floor(b.displayTime);
	}
	if (
		Array.isArray(b.roster) &&
		b.roster.length <= 64 &&
		b.roster.every((n) => typeof n === 'string' && n.length > 0 && n.length <= 64)
	) {
		beat.roster = b.roster as string[];
	}
	if (typeof b.lobbyId === 'number' && Number.isInteger(b.lobbyId) && b.lobbyId > 0) {
		beat.lobbyId = b.lobbyId;
	}
	return beat;
}

/** One lobby or game, with the entries that belong to it. */
export interface PresenceGroup {
	/** grouping key: lobbyId, else roster hash, else per-entry */
	key: string;
	status: 'lobby' | 'ingame';
	uar: boolean;
	members: PresenceEntry[];
	/** best-known human count (max of reported values / roster size) */
	players: number;
	/** longest reported game clock, seconds */
	displayTime?: number;
}

/**
 * Groups entries into lobbies/games: by lobbyId when known, else by the
 * roster name-set (identical for every member of one game), else each
 * entry stands alone.
 */
export function groupPresence(entries: PresenceEntry[]): PresenceGroup[] {
	const groups = new Map<string, PresenceGroup>();
	for (const e of entries) {
		const key =
			e.lobbyId != null
				? `id:${e.lobbyId}`
				: e.roster && e.roster.length > 0
					? `roster:${e.status}:${[...e.roster].sort().join('\n')}`
					: `solo:${e.battletag}`;
		let g = groups.get(key);
		if (!g) {
			g = { key, status: e.status, uar: e.uar, members: [], players: 0 };
			groups.set(key, g);
		}
		g.members.push(e);
		g.uar = g.uar || e.uar;
		// a member already in-game wins over one still in the lobby screen
		if (e.status === 'ingame') g.status = 'ingame';
		g.players = Math.max(g.players, e.players ?? 0, e.roster?.length ?? 0, g.members.length);
		if (e.displayTime !== undefined) {
			g.displayTime = Math.max(g.displayTime ?? 0, e.displayTime);
		}
	}
	return [...groups.values()].sort((a, b) => b.players - a.players);
}
