/**
 * The overview page's 7-day widgets, aggregated from stored replay docs in
 * one pass: XP leaderboard, prestiged honor roll, class pick counts.
 *
 * A sighting carries the bank as it stood at the *start* of that game, so the
 * XP a game earns first shows up in the player's next sighting. A player's
 * gain over the window is therefore the careerXp difference between their
 * newest and their oldest sighting inside it: that spans exactly the games
 * they played after the window opened. Sightings from before the window are
 * never a baseline — an earlier anchor would put pre-window games on a board
 * labelled "last 7 days", and how much it inflated a given player depended
 * entirely on when they happened to upload. The cost is that XP earned inside
 * the window but before a player's first upload of it goes uncounted;
 * undercounting is the honest side to err on here.
 *
 * careerXp folds prestige in (600k per level), so a mid-week prestige reset
 * still counts as forward progress. Players need two sightings inside the
 * window to appear at all. The same pair yields the honor roll (prestige
 * level increased), on the same window for the same reason. The roll runs
 * newest first, each row dated to the game its prestige was taken in: the
 * bank is written at the end screen and a sighting reads it as the game
 * *started*, so that is the last game recorded at the old level — the same
 * game a profile's feed credits it to (awardsBetween, in replay/extract.ts).
 * A double prestige is dated by its last step, since the level reached is
 * what the row shows.
 *
 * Class picks are a plain count over in-window sightings — one per class per
 * game — so like the bank deltas they only see uploaded games.
 */

import { careerXp } from '../xp.ts';
import { isBanned } from '../banned.ts';
import type {
	WeeklyBoards,
	WeeklyXpEntry,
	WeeklyPrestige,
	WeeklyClassPick,
	WeeklyGames
} from '../players.ts';
import type { Outcome } from '../outcome.ts';
import type { ActivityGame } from '../activity.ts';

/** The slice of a replay doc this aggregation needs. */
export interface WeeklyXpReplay {
	playedAt: string;
	/** Profiles in the game; a doc at 0 is an empty recording, not a game played. */
	players?: number;
	/** The settled result and mode where known (see db.replayOutcomeOf / replayModeOf). */
	outcome?: Outcome;
	mode?: number;
	sightings: {
		toon: string;
		name: string;
		clan: string;
		xpEn: number;
		xpWo: number;
		xpCo: number;
		prestige: number;
		gamesPlayed: number;
		mos: string[];
	}[];
}

type Sighting = WeeklyXpReplay['sightings'][number] & { playedAt: number };

/**
 * Exported so the database read can ask for exactly this window. Games older
 * than it are skipped below, so fetching them is pure waste — and the archive
 * grows without bound while the window does not.
 */
export const WINDOW_MS = 7 * 24 * 3600 * 1000;

/** Boards over the 7 days before `now`; xp/classPicks capped at `limit` rows. */
export function weeklyBoards(replays: WeeklyXpReplay[], now: Date, limit = 10): WeeklyBoards {
	const windowStart = now.getTime() - WINDOW_MS;

	// player key -> oldest and newest sighting inside the window, and the
	// newest one seen at each prestige level (what dates a prestige, below)
	const players = new Map<
		string,
		{ first: Sighting; latest: Sighting; lastAtLevel: Map<number, number> }
	>();
	const picks = new Map<string, number>();
	const games: WeeklyGames = { played: 0, won: 0, lost: 0 };
	const modes = new Map<number, number>();
	for (const r of replays) {
		const playedAt = Date.parse(r.playedAt);
		if (Number.isNaN(playedAt) || playedAt < windowStart) continue;
		if (r.players !== 0) {
			games.played++;
			if (r.outcome === 'win') games.won++;
			else if (r.outcome === 'loss') games.lost++;
			if (r.mode) modes.set(r.mode, (modes.get(r.mode) ?? 0) + 1);
		}
		for (const raw of r.sightings) {
			for (const mos of raw.mos) picks.set(mos, (picks.get(mos) ?? 0) + 1);
			const s: Sighting = { ...raw, playedAt };
			const key = s.toon || s.name;
			/* The two player boards drop the map's banned handles ($lib/banned);
			   the class counts above them do not, and the line between the two is
			   where the figure comes from. A week's XP gain is the bank's word for
			   itself, which is the thing being forged. Which class someone picked
			   is the replay's own record of the game, as true of them as of
			   anyone, and dropping it would misreport how popular a class was. */
			if (isBanned(key)) continue;
			const p = players.get(key);
			if (!p) {
				players.set(key, { first: s, latest: s, lastAtLevel: new Map([[s.prestige, playedAt]]) });
				continue;
			}
			if (playedAt > (p.lastAtLevel.get(s.prestige) ?? -Infinity))
				p.lastAtLevel.set(s.prestige, playedAt);
			// first.playedAt <= latest.playedAt always holds, so these are exclusive
			if (playedAt > p.latest.playedAt) p.latest = s;
			else if (playedAt < p.first.playedAt) p.first = s;
		}
	}

	const xp: WeeklyXpEntry[] = [];
	const prestiged: WeeklyPrestige[] = [];
	for (const [toonOrName, p] of players) {
		if (p.first === p.latest) continue; // one sighting: no span to diff over
		const who = {
			name: p.latest.name,
			clan: p.latest.clan,
			toon: p.latest.toon || (toonOrName === p.latest.name ? '' : toonOrName)
		};
		if (p.latest.prestige > p.first.prestige)
			prestiged.push({
				...who,
				from: p.first.prestige,
				to: p.latest.prestige,
				prestigedAt: new Date(prestigedAt(p.lastAtLevel, p.latest.prestige)).toISOString()
			});
		const xpGained = careerXp(p.latest) - careerXp(p.first);
		if (xpGained <= 0) continue;
		xp.push({
			...who,
			xpGained,
			games: Math.max(0, p.latest.gamesPlayed - p.first.gamesPlayed)
		});
	}
	xp.sort((a, b) => b.xpGained - a.xpGained || b.games - a.games);
	// newest prestige first; the level only breaks ties
	prestiged.sort(
		(a, b) =>
			Date.parse(b.prestigedAt) - Date.parse(a.prestigedAt) ||
			b.to - a.to ||
			a.name.localeCompare(b.name)
	);

	const classPicks: WeeklyClassPick[] = [...picks]
		.map(([mos, n]) => ({ mos, picks: n }))
		.sort((a, b) => b.picks - a.picks || a.mos.localeCompare(b.mos))
		.slice(0, limit);

	// the most played mode; on a tie the harder one, since the modes are
	// numbered up the difficulty ladder first (see ModeMark)
	let topMode: number | undefined;
	for (const [mode, n] of modes) {
		const best = topMode === undefined ? -1 : modes.get(topMode)!;
		if (n > best || (n === best && mode > topMode!)) topMode = mode;
	}
	if (topMode !== undefined) games.topMode = topMode;

	return { xp: xp.slice(0, limit), prestiged, classPicks, games };
}

/**
 * The longest game that began inside the window, off the activity chart's
 * list — no read of its own. Null when no game in the window has a length.
 */
export function longestGame(games: ActivityGame[], now: Date): ActivityGame | null {
	const windowStart = now.getTime() - WINDOW_MS;
	let best: ActivityGame | null = null;
	for (const g of games) {
		if (!g.file || !g.gameLoops) continue;
		const startedAt = Date.parse(g.startedAt);
		if (Number.isNaN(startedAt) || startedAt < windowStart) continue;
		if (!best || g.gameLoops > best.gameLoops!) best = g;
	}
	return best;
}

/**
 * When a player who reached `level` this week did so: the newest sighting
 * still below it — see the header for why that is the game the prestige was
 * taken in. Always inside the window, since every sighting counted is.
 */
function prestigedAt(lastAtLevel: Map<number, number>, level: number): number {
	let at = 0;
	for (const [l, t] of lastAtLevel) if (l < level && t > at) at = t;
	return at;
}
