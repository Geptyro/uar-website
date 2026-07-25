import rawPlayers from './data/players.json';
import { rankTracks, type Rank } from './mos';

export interface PlayerProfile {
	name: string;
	clan: string;
	/** Battle.net toon handle (region-S2-realm-id) — the stable unique id. */
	toon: string;
	xpEn: number;
	xpWo: number;
	xpCo: number;
	prestige: number;
	gamesPlayed: number;
	revives: number;
	/** Average game length in seconds. */
	avgGameTime: number;
	/** Games won per game mode (12 modes). */
	winsByMode: number[];
	lastSeen: string;
}

export interface ReplayMeta {
	file: string;
	playedAt: string;
	players: number;
}

const data = rawPlayers as { replays: ReplayMeta[]; players: PlayerProfile[] };

export const players: PlayerProfile[] = data.players;
export const replays: ReplayMeta[] = data.replays;

/** Highest rank reached in a track (1-based track number) for a given XP. */
export function rankFor(track: number, xp: number): Rank | null {
	const ranks = rankTracks.find((t) => t.track === track)?.ranks ?? [];
	let best: Rank | null = null;
	for (const r of ranks) {
		if (xp >= r.xp) best = r;
	}
	return best;
}

export function totalWins(p: PlayerProfile): number {
	return p.winsByMode.reduce((a, b) => a + b, 0);
}

export function totalXp(p: PlayerProfile): number {
	return p.xpEn + p.xpWo + p.xpCo;
}
