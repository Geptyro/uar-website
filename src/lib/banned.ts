/**
 * The map's own ban list, and what the site does about it.
 *
 * `gf_Banned()` in the map's MapScript.galaxy names nine Battle.net handles and,
 * for each, starts a trigger that forces their experience — and for two of them
 * only their prestige — back to zero every half second for the whole game. The
 * bank is written at game over, so whatever those players save is a wiped
 * profile. That is the map author's judgement about those accounts, not ours:
 * the site mirrors the list rather than making a call of its own, and says so
 * in those terms wherever it shows.
 *
 * What the site does with it is narrower than hiding them. A forged bank does
 * its damage in comparisons — a career board, a clan total, a weekly gain — so
 * those drop them. The record does not: they stay in the rosters of the games
 * they actually played, they stay findable by name, and their profile still
 * loads, carrying the note. The same reasoning as $lib/awards.ts: a figure the
 * site cannot stand behind is left off a board, never quietly rewritten.
 *
 * Hardcoded rather than a flag on the player document, because seven of the
 * nine have never appeared in an uploaded replay. A list can decide what to do
 * about a profile the moment it first arrives; a flag could only be set on one
 * that already exists.
 *
 * Dependency-free so node:test can load it directly (pattern: $lib/xp.ts), and
 * so one constant answers both the database filters and the profile's banner.
 */

/** Which trigger the map runs — `gf_ResetXPPlayer` or `gf_ResetPrestigePlayer`. */
export type BanKind = 'xp' | 'prestige';

/** Battle.net handle -> what the map takes off them, in `gf_Banned()` order. */
export const BANNED: Readonly<Record<string, BanKind>> = {
	'2-S2-2-1811117': 'xp',
	'2-S2-1-10168638': 'xp',
	'2-S2-1-10171141': 'xp',
	'2-S2-1-10172652': 'xp',
	'2-S2-1-7325055': 'xp',
	'2-S2-1-4182775': 'xp',
	'2-S2-1-10555032': 'xp',
	'2-S2-1-9442053': 'prestige',
	'2-S2-1-5590170': 'prestige'
};

/** The handles alone — what a `$nin` filter wants. */
export const BANNED_TOONS: string[] = Object.keys(BANNED);

/**
 * What the ban costs, as a clause a profile drops into a sentence.
 *
 * The site calls this a ban because the map does: the routine is named
 * `gf_Banned`, and it is the only thing in the whole script that answers to
 * that word — `gf_KickPlayer` exists but is never called, so there is no other
 * meaning of "banned" here for this to be confused with. Saying it plainly is
 * both shorter and more accurate than describing the mechanism and leaving a
 * reader to infer the verdict. What stays careful is the attribution: it is the
 * map's ban, and the profile says whose.
 */
export const BAN_EFFECT: Readonly<Record<BanKind, string>> = {
	xp: 'wipes its experience and prestige',
	prestige: 'wipes its prestige'
};

/**
 * The ban on a player key, or null.
 *
 * Takes a player key rather than a handle specifically — profiles are keyed by
 * toon, falling back to the in-game name when a replay carried no bank
 * signature (see `buildPlayersData`), and every caller here holds that key.
 */
export function banKind(key: string): BanKind | null {
	return BANNED[key] ?? null;
}

export function isBanned(key: string): boolean {
	return key in BANNED;
}
