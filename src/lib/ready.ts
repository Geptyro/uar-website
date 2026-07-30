/**
 * "Ready to play" flags — shared types and pure helpers for the top-bar
 * widget and the /api/ready route. Dependency-free so plain node:test can
 * load it (see CLAUDE.md).
 */

/** How long a flag lasts before it silently expires. */
export const READY_DURATION_MS = 60 * 60 * 1000;

/** One flagged player, as served by GET /api/ready. */
export interface ReadyPlayer {
	battletag: string;
	/**
	 * SC2 profile name of `toon` — what the row shows, since that is the name
	 * everyone reads in a lobby. Null when the site cannot resolve one, and
	 * the battletag stands in.
	 */
	name: string | null;
	/** Toon handle of the player's primary profile — links to /players/{toon}. */
	toon: string | null;
	/** SC2 portrait URL, if the account has one. */
	avatar: string | null;
	/** ISO timestamp when the flag expires. */
	until: string;
}

/** Players whose flag has not expired yet. */
export function activeReady<T extends { until: string }>(players: T[], now: number): T[] {
	return players.filter((p) => Date.parse(p.until) > now);
}

/** Whole minutes left on a flag, for display; at least 1 while active. */
export function minutesLeft(until: string, now: number): number {
	return Math.max(1, Math.ceil((Date.parse(until) - now) / 60_000));
}

/** Urgency bucket for the flag button's color: green / gold / red. */
export function readyLevel(minutes: number): 'high' | 'mid' | 'low' {
	if (minutes <= 10) return 'low';
	if (minutes <= 30) return 'mid';
	return 'high';
}
