/**
 * What a player won in a game.
 *
 * The save file is snapshot at the *start* of every game, so nothing a game
 * gave you is in its own sighting — it is in the next one. A game's awards are
 * therefore the difference between the two banks either side of it, which is
 * the same trick $lib/outcome.ts plays to settle win and loss, and the same one
 * the replay table already plays to print "+1,200" against a row.
 *
 * The consequence is worth stating plainly, because it shapes the whole
 * feature: a game's awards only become knowable once one of its players has
 * uploaded a *later* game. The newest game in the archive always shows none.
 * That is not a gap to paper over — it is the honest state of the record.
 *
 * Four rules, each one a way of not lying:
 *
 *  1. Only differences between two known banks count. A player's first sighting
 *     is never treated as a haul, or everything they had ever earned would be
 *     reported as won in one afternoon.
 *  2. Only gains. A bank that goes backwards — a reset, a restored save — is
 *     silence, never "lost the Purple Heart".
 *  3. The ladder decals are not awards. The map grants decals 11/12/13 from a
 *     completed walker/LK19/Predator ladder (see server/replay/bank.ts), so
 *     they flip in the same instant as the final gear piece; reporting both
 *     would announce one achievement twice.
 *  4. Camos 1 and 19 are forced on by the load code, so they are nobody's
 *     doing and can never appear in a difference anyway.
 *
 * Dependency-free so node:test can load it directly (pattern: $lib/xp.ts) —
 * which is why the rank ladders are passed in rather than imported.
 */

/** The gear ladders, as they are named on `Unlocks`. */
export const GEAR_GROUPS = ['walker', 'lk19', 'predator', 'robot', 'medvisor'] as const;

export type GearGroup = (typeof GEAR_GROUPS)[number];

export type AwardType = 'medal' | 'decal' | 'camo' | 'si' | 'gear' | 'rank' | 'prestige';

/** One thing gained. `id` is read against `type`, and nothing else is stored. */
export interface Award {
	type: AwardType;
	/**
	 * The medal / decal / camo / SI number; the gear piece's index in its
	 * ladder; the rank's index in its track; or the prestige level reached.
	 */
	id: number;
	/** Which ladder, for `gear`. */
	group?: GearGroup;
	/** Which rank track (1–3), for `rank`. */
	track?: number;
	/** The rank's name, resolved here so a page needs no second lookup. */
	label?: string;
}

/** The slice of a sighting this derivation reads. */
export interface AwardSighting {
	gamesPlayed: number;
	prestige: number;
	xpEn: number;
	xpWo: number;
	xpCo: number;
	unlocks: {
		camos: number[];
		decals: number[];
		sis: number[];
		medals: number[];
		walker?: boolean[];
		lk19?: boolean[];
		predator?: boolean[];
		robot?: boolean[];
		medvisor?: boolean[];
	};
}

/** A rank ladder, in ascending XP order — `rankTracks` from $lib/mos. */
export interface AwardRankTrack {
	track: number;
	ranks: { xp: number; name: string }[];
}

/** Granted by completing a gear ladder, not by earning them — see rule 3. */
const LADDER_DECALS = new Set([11, 12, 13]);

/** Forced true by the map's load code — see rule 4. */
const FREE_CAMOS = new Set([1, 19]);

/** Numbers in `after` that were not in `before`, minus any that never count. */
function gained(before: number[], after: number[], skip?: Set<number>): number[] {
	const had = new Set(before);
	return after
		.filter((n) => !had.has(n) && !skip?.has(n))
		.sort((a, b) => a - b);
}

/** Indices that flipped false → true. */
function gearGained(before: boolean[] = [], after: boolean[] = []): number[] {
	const out: number[] = [];
	for (let i = 0; i < after.length; i++) if (after[i] && !before[i]) out.push(i);
	return out;
}

/** Highest rank reached at this XP, as an index into the track (-1 = none). */
function rankIndex(ranks: { xp: number }[], xp: number): number {
	let best = -1;
	for (let i = 0; i < ranks.length; i++) if (xp >= ranks[i].xp) best = i;
	return best;
}

/**
 * The collectables gained between two of one player's banks.
 *
 * Split from the standing below for a reason that is about where each can be
 * worked out. The unlock sets exist only on the stored sighting, never on the
 * profile, so these have to be derived once at write time and kept — which
 * means this half has to run inside the replay pipeline, and therefore has to
 * stay clear of anything that reaches for the site's JSON data.
 */
export function unlockAwards(cur: AwardSighting, next: AwardSighting): Award[] {
	const out: Award[] = [];

	for (const id of gained(cur.unlocks.medals, next.unlocks.medals)) out.push({ type: 'medal', id });
	for (const id of gained(cur.unlocks.decals, next.unlocks.decals, LADDER_DECALS))
		out.push({ type: 'decal', id });
	for (const id of gained(cur.unlocks.camos, next.unlocks.camos, FREE_CAMOS))
		out.push({ type: 'camo', id });
	for (const id of gained(cur.unlocks.sis, next.unlocks.sis)) out.push({ type: 'si', id });
	for (const group of GEAR_GROUPS)
		for (const id of gearGained(cur.unlocks[group], next.unlocks[group]))
			out.push({ type: 'gear', group, id });

	return out;
}

/**
 * The standing gained between the same two banks: a prestige, and any rank
 * crossed on any of the three tracks.
 *
 * Separate from the unlocks only because it is answerable from figures a
 * profile already carries, where they are not. Both halves are stored, and the
 * reason is the read rather than the write: a feed wants the games that gave
 * *something*, and if half of "something" were worked out at render time the
 * database could not be asked for them — it would have to hand over an entire
 * history for the page to sift, which is the one thing this cluster cannot
 * afford. The cost is that a stored rank name is the name at the time of
 * ingest; re-extracting the ladders means a rebuild, as it already does for
 * every other derived field here.
 */
export function progressAwards(
	cur: AwardSighting,
	next: AwardSighting,
	tracks: AwardRankTrack[] = []
): Award[] {
	const out: Award[] = [];

	if (next.prestige > cur.prestige) out.push({ type: 'prestige', id: next.prestige });

	/* Only upwards. A prestige resets all three tracks to 50k, so the ranks it
	   takes away are not losses worth reporting and the ranks re-earned on the
	   way back up are not gains — which `to > from` already handles, since after
	   a reset `to` sits below `from` and stays there for a long while. */
	const xps = [
		[cur.xpEn, next.xpEn],
		[cur.xpWo, next.xpWo],
		[cur.xpCo, next.xpCo]
	];
	for (const t of tracks) {
		const pair = xps[t.track - 1];
		if (!pair || !t.ranks.length) continue;
		const from = rankIndex(t.ranks, pair[0]);
		const to = rankIndex(t.ranks, pair[1]);
		if (to > from && to >= 0)
			out.push({ type: 'rank', id: to, track: t.track, label: t.ranks[to].name });
	}

	return out;
}

/**
 * Everything gained between two banks, both halves together.
 *
 * The order is the order a reader should meet them in: the collectables first,
 * then the two things that are about standing rather than kit.
 */
export function awardsBetween(
	cur: AwardSighting,
	next: AwardSighting,
	tracks: AwardRankTrack[] = []
): Award[] {
	return [...unlockAwards(cur, next), ...progressAwards(cur, next, tracks)];
}

/**
 * Whether a pair of banks is a run this derivation will speak about at all:
 * the game counter has to have moved forward. It has not when a save was reset
 * or when the same game reached the archive twice.
 */
export function isCreditable(cur: AwardSighting, next: AwardSighting | undefined): boolean {
	return !!next && next.gamesPlayed - cur.gamesPlayed >= 1;
}

/**
 * Awards per sighting, aligned with the input: entry `i` is what game `i`
 * gave, which is the difference between bank `i` and bank `i + 1`.
 *
 * Sightings must be oldest first, as they are stored. The last entry is always
 * empty — nobody has played the follow-up that would settle it yet — and so is
 * any pair whose game counter did not move forward, which is a bank that was
 * reset or a game recorded twice.
 */
export function awardsForSightings(
	sightings: AwardSighting[],
	tracks: AwardRankTrack[] = []
): Award[][] {
	return sightings.map((cur, i) => {
		const next = sightings[i + 1];
		return isCreditable(cur, next) ? awardsBetween(cur, next, tracks) : [];
	});
}

/** A game as the feed shows it, newest first. */
export interface AwardGame {
	file: string;
	/** When the game began, UTC. */
	startedAt: string;
	awards: Award[];
	/** Class(es) the player picked in this game — the context an award wants. */
	mos?: string[];
	/** The save file's game counter as this game started. */
	gamesPlayed: number;
	/**
	 * Games this player got through between this bank and the next *uploaded*
	 * one. 1 means the awards are pinned to this game; more means they fell
	 * somewhere in the run and only the first of it was ever uploaded.
	 */
	span: number;
}

export type TimelineRow =
	| { kind: 'game'; game: AwardGame; approximate: boolean }
	| { kind: 'gap'; games: number };

/**
 * The feed, as rows: the games that gave something, and between them a count
 * of the games that did not.
 *
 * Only rewarding games get a row, because a feed is worth having precisely
 * where the replay list is not — two hundred rows with a medal on three of
 * them is a worse way to read those three. But the games in between are not
 * hidden either: the space between two rows is itself a row, carrying how many
 * games passed there. That is the brew timeline's idea used properly — the gap
 * holds the interval rather than merely separating two events — and it means
 * the record stays continuous whether the missing games were uploaded and
 * uneventful or never uploaded at all.
 *
 * The count comes from the save file's own game counter, so it covers both
 * kinds. `games` takes newest first, which is the order it renders in.
 */
export function awardTimeline(games: AwardGame[]): TimelineRow[] {
	const rows: TimelineRow[] = [];
	for (let i = 0; i < games.length; i++) {
		const g = games[i];
		rows.push({ kind: 'game', game: g, approximate: g.span > 1 });
		const older = games[i + 1];
		if (!older) continue;
		/* An approximate row already carries this same stretch: its award could
		   have come from any of the games between it and the next upload, which
		   is the run this gap would count. Printing both put "490 games,
		   nothing earned" directly above "somewhere in 490 games" — one run,
		   said twice, in two different voices. The row's own label wins,
		   because it also explains why the award is not pinned. */
		if (older.span > 1) continue;
		// every game the counter advanced through between the two, this one
		// excluded — a run of nothing-happened, however it reached the archive
		const between = g.gamesPlayed - older.gamesPlayed - 1;
		if (between > 0) rows.push({ kind: 'gap', games: between });
	}
	return rows;
}
