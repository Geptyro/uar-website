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
	/** the reporter's own entry in `roster` (their SC2 profile name) */
	selfName?: string;
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
	if (typeof b.selfName === 'string' && b.selfName.length > 0 && b.selfName.length <= 64) {
		beat.selfName = b.selfName;
	}
	return beat;
}

// grouping lives in uar-shared (the tray renders the same groups)
export { groupPresence, splitPresence, type PresenceGroup } from 'uar-shared/presence';
