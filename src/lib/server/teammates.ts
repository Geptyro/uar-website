/**
 * Who a player has spent the most time in-game with, aggregated from the
 * stored replay docs they appear in.
 *
 * Time credited for a shared game is the stretch both were in it: the game's
 * own length — the same measure the per-MOS playtime boards use, with the
 * same fallback for docs that predate it — cut at whichever of the two left
 * first, where the sightings record it (`leftLoop`; a sighting from before
 * that was read counts as staying to the end).
 */

import type { Teammate } from '../players.ts';
import { LOOPS_PER_SECOND, playedLoops } from '../gameEnd.ts';
import { isBanned } from '../banned.ts';

/** The slice of a replay doc this aggregation needs. */
export interface TeammateReplay {
	playedAt: string;
	/** Recording length in game loops (16 per game-second). */
	durationLoops?: number;
	/** The game's own length in the same loops, where it is known. */
	gameLoops?: number;
	sightings: { toon: string; name: string; clan: string; leftLoop?: number }[];
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
		const gameLoops = r.gameLoops ?? r.durationLoops ?? 0;
		const own = r.sightings.find((s) => (s.toon || s.name) === key);
		if (!own) continue;
		const ownLoops = playedLoops(gameLoops, own.leftLoop);
		// one credit per player per game, even if a lobby lists them twice
		const seen = new Set<string>([key]);
		for (const s of r.sightings) {
			const mate = s.toon || s.name;
			if (!mate || seen.has(mate)) continue;
			// this is a ranked list on somebody else's profile, so it drops the
			// map's banned handles like the other boards do ($lib/banned). The
			// banned player's own list is unaffected: `key` is never filtered
			if (isBanned(mate)) continue;
			seen.add(mate);
			const seconds = Math.round(
				Math.min(ownLoops, playedLoops(gameLoops, s.leftLoop)) / LOOPS_PER_SECOND
			);
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
