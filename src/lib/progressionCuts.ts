/**
 * Where a profile's progression went backwards, and which replay holds the bank
 * it had before it happened.
 *
 * Career XP is monotonic by construction — prestiging costs 600,000 of track XP
 * (three tracks from 250,000 down to 50,000) and hands back a prestige level
 * worth exactly 600,000 — so a bank that carries *less* than the one before it
 * has lost something the game does not take away. In practice that is a player
 * who changed computer, reinstalled, or otherwise no longer has the save file
 * they had been playing on.
 *
 * The replay before such a step is the last recording of the bank they lost,
 * which makes it the only surviving copy of that progression once the bucket
 * sweep has been round. `restorePins` names those files so retention can keep
 * them (see replayRetention.ts) instead of dropping them the moment every
 * participant has played a newer game — which is exactly what the "keep each
 * player's latest" rule does to them, because a wiped player's fresh-bank games
 * are by definition newer than the bank worth keeping.
 *
 * Dependency-free apart from the XP arithmetic it shares with the rest of the
 * site (pattern: $lib/xp.ts), so plain `node --test` can load it.
 */

import { careerXp } from './xp.ts';

/** The slice of a history entry this reads. */
export interface CutEntry {
	/** The replay this bank was recorded in — what gets pinned. */
	file: string;
	playedAt: string;
	/** The save file's own game counter. A wipe takes it back to near zero. */
	gamesPlayed: number;
	prestige: number;
	xpEn: number;
	xpWo: number;
	xpCo: number;
}

/** One backwards step in a profile's progression. */
export interface ProgressionCut {
	/** The last replay recorded before the loss — the restore point. */
	beforeFile: string;
	/** The first replay to show the diminished bank. */
	afterFile: string;
	/** When each of the two banks was recorded; the loss happened between. */
	beforeAt: string;
	afterAt: string;
	/** Career XP either side, and the difference as a positive number. */
	before: number;
	after: number;
	lost: number;
	/** The game counter either side — near zero after means a fresh save file. */
	gamesBefore: number;
	gamesAfter: number;
}

/**
 * How far the game counter may fall back before a pair stops looking like a
 * recording that merely reached the archive out of order.
 *
 * A replay's `playedAt` is its `m_timeUTC`, which SC2 stamps when it writes the
 * file — the moment the *recording* stopped, not the moment the game ended. A
 * player who sits in the map after a game keeps their recording running, so
 * their file can be stamped an hour late and sort after a game that genuinely
 * came later. History is ordered by `playedAt`, so those two swap, and the pair
 * reads as a bank that went backwards when nothing was lost at all.
 *
 * Observed in the archive: whole lobbies inverting a single pair at a time, the
 * counter stepping back by one and the career by a few thousand. A real loss
 * takes the counter back by tens or hundreds, so the size of the step separates
 * them cleanly.
 */
const INVERSION_MAX_GAMES = 3;

/** …and only within a session; two games a week apart never swapped. */
const INVERSION_MAX_HOURS = 24;

/**
 * A loss this large is a cut whatever the counter did.
 *
 * Defence in depth against the rule above ever being handed a pair it was not
 * meant for: the largest inversion the archive has produced is a little over
 * 4,000, and no single game pays anything close to this. Being wrong in this
 * direction keeps bytes nobody needed; being wrong in the other deletes the
 * only copy of someone's progression.
 */
const ALWAYS_A_CUT = 20000;

const hoursBetween = (a: string, b: string) =>
	Math.abs(Date.parse(b) - Date.parse(a)) / 3600000;

/**
 * Whether a backwards pair is the archive's ordering rather than a real loss.
 * Exported for the tests, and because the rule is worth being able to ask about
 * on its own.
 */
export function isOrderingInversion(before: CutEntry, after: CutEntry): boolean {
	const lost = careerXp(before) - careerXp(after);
	if (lost >= ALWAYS_A_CUT) return false;
	const stepBack = before.gamesPlayed - after.gamesPlayed;
	return (
		stepBack > 0 &&
		stepBack <= INVERSION_MAX_GAMES &&
		hoursBetween(before.playedAt, after.playedAt) <= INVERSION_MAX_HOURS
	);
}

/**
 * Every backwards step in one profile's history, oldest first.
 *
 * `history` must be oldest first, as it is stored (see `buildPlayersData`).
 * Entries whose career XP only holds level are not cuts — nothing was lost —
 * and neither is the very first entry, which has nothing to be compared against.
 */
export function progressionCuts(history: CutEntry[]): ProgressionCut[] {
	const cuts: ProgressionCut[] = [];
	for (let i = 1; i < history.length; i++) {
		const before = history[i - 1];
		const after = history[i];
		const lost = careerXp(before) - careerXp(after);
		if (lost <= 0) continue;
		if (isOrderingInversion(before, after)) continue;
		cuts.push({
			beforeFile: before.file,
			afterFile: after.file,
			beforeAt: before.playedAt,
			afterAt: after.playedAt,
			before: careerXp(before),
			after: careerXp(after),
			lost,
			gamesBefore: before.gamesPlayed,
			gamesAfter: after.gamesPlayed
		});
	}
	return cuts;
}

/**
 * The replay files that must keep their blob for this profile: one per cut, the
 * bank as it stood before each.
 *
 * Every cut gets a pin rather than only the best of them, because which one a
 * player wants back is not ours to decide — someone who was wiped twice may
 * well want the save from before the first. De-duplicated, since one replay can
 * sit before two cuts once an intervening game is missing from the archive, and
 * ordered oldest first so the list is stable across rebuilds.
 */
export function restorePins(history: CutEntry[]): string[] {
	const seen = new Set<string>();
	for (const cut of progressionCuts(history)) seen.add(cut.beforeFile);
	return [...seen];
}
