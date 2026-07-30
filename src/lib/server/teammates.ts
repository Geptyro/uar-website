/**
 * Who a player has spent the most time in-game with, aggregated from the
 * stored replay docs they appear in.
 *
 * Time credited for a shared game is the game's own length — the same measure
 * the per-MOS playtime boards use, with the same fallback for docs that
 * predate it and the same caveat: banks carry no per-player leave time, so an
 * early leaver is credited the full game.
 */

import type { Teammate } from '../players.ts';
import { LOOPS_PER_SECOND } from '../gameEnd.ts';

/** The slice of a replay doc this aggregation needs. */
export interface TeammateReplay {
	playedAt: string;
	/** Recording length in game loops (16 per game-second). */
	durationLoops?: number;
	/** The game's own length in the same loops, where it is known. */
	gameLoops?: number;
	sightings: { toon: string; name: string; clan: string }[];
}

/**
 * Top teammates of `key` (a toon handle, or a name for toon-less sightings)
 * by shared recorded seconds, ties broken by shared games. Replays the player
 * does not appear in are ignored, so the caller may pass the whole archive.
 */
export function topTeammates(replays: TeammateReplay[], key: string, limit = 10): Teammate[] {
	// teammate key (toon, falling back to name) -> accumulated row
	const mates = new Map<string, Teammate & { at: string }>();
	for (const r of replays) {
		const seconds = Math.round((r.gameLoops ?? r.durationLoops ?? 0) / LOOPS_PER_SECOND);
		if (!r.sightings.some((s) => (s.toon || s.name) === key)) continue;
		// one credit per player per game, even if a lobby lists them twice
		const seen = new Set<string>([key]);
		for (const s of r.sightings) {
			const mate = s.toon || s.name;
			if (!mate || seen.has(mate)) continue;
			seen.add(mate);
			const cur = mates.get(mate);
			if (!cur) {
				mates.set(mate, {
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
				// newest sighting owns the display name — players rename and switch clans
				if (r.playedAt > cur.at) {
					cur.at = r.playedAt;
					cur.name = s.name;
					cur.clan = s.clan;
				}
			}
		}
	}

	return [...mates.values()]
		.sort((a, b) => b.seconds - a.seconds || b.games - a.games)
		.slice(0, limit)
		.map(({ at: _, ...m }) => m);
}
