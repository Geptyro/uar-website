/**
 * Per-MOS playtime leaderboards, aggregated from stored replay docs.
 *
 * Time credited for a game is the game's own length — not the recording's,
 * which keeps counting while a client sits in a finished map (see
 * lib/gameEnd.ts); docs from before that was separated out carry only the
 * recording's length and fall back to it. Banks carry no per-player leave
 * time, so early leavers are credited the full game, and a sighting listing
 * several classes (re-picks) credits the full game to each of them.
 */

import type { MosTopPlayer } from '../players.ts';
import { LOOPS_PER_SECOND } from '../gameEnd.ts';

/** The slice of a replay doc this aggregation needs. */
export interface PlaytimeReplay {
	playedAt: string;
	/** Recording length in game loops (16 per game-second). */
	durationLoops?: number;
	/** The game's own length in the same loops, where it is known. */
	gameLoops?: number;
	sightings: { toon: string; name: string; clan: string; mos: string[] }[];
}

/** Top players per MOS id, by recorded seconds played (ties: games). */
export function topPlayersByMos(
	replays: PlaytimeReplay[],
	limit = 10
): Record<string, MosTopPlayer[]> {
	// mos id -> player key (toon, falling back to name) -> accumulated row
	const byMos = new Map<string, Map<string, MosTopPlayer & { at: string }>>();
	for (const r of replays) {
		const seconds = Math.round((r.gameLoops ?? r.durationLoops ?? 0) / LOOPS_PER_SECOND);
		for (const s of r.sightings) {
			for (const mos of s.mos) {
				let players = byMos.get(mos);
				if (!players) byMos.set(mos, (players = new Map()));
				const cur = players.get(s.toon || s.name);
				if (!cur) {
					players.set(s.toon || s.name, {
						name: s.name,
						clan: s.clan,
						toon: s.toon,
						games: 1,
						seconds,
						at: r.playedAt
					});
				} else {
					cur.games += 1;
					cur.seconds += seconds;
					if (r.playedAt > cur.at) {
						cur.at = r.playedAt;
						cur.name = s.name;
						cur.clan = s.clan;
					}
				}
			}
		}
	}

	const out: Record<string, MosTopPlayer[]> = {};
	for (const [mos, players] of byMos) {
		out[mos] = [...players.values()]
			.sort((a, b) => b.seconds - a.seconds || b.games - a.games)
			.slice(0, limit)
			.map(({ at: _, ...p }) => p);
	}
	return out;
}
