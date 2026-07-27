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
 * level increased), on the same window for the same reason.
 *
 * Class picks are a plain count over in-window sightings — one per class per
 * game — so like the bank deltas they only see uploaded games.
 */

import { careerXp } from '../xp.ts';
import type { WeeklyBoards, WeeklyXpEntry, WeeklyPrestige, WeeklyClassPick } from '../players.ts';

/** The slice of a replay doc this aggregation needs. */
export interface WeeklyXpReplay {
	playedAt: string;
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

const WINDOW_MS = 7 * 24 * 3600 * 1000;

/** Boards over the 7 days before `now`; xp/classPicks capped at `limit` rows. */
export function weeklyBoards(replays: WeeklyXpReplay[], now: Date, limit = 10): WeeklyBoards {
	const windowStart = now.getTime() - WINDOW_MS;

	// player key -> oldest and newest sighting inside the window
	const players = new Map<string, { first: Sighting; latest: Sighting }>();
	const picks = new Map<string, number>();
	for (const r of replays) {
		const playedAt = Date.parse(r.playedAt);
		if (Number.isNaN(playedAt) || playedAt < windowStart) continue;
		for (const raw of r.sightings) {
			for (const mos of raw.mos) picks.set(mos, (picks.get(mos) ?? 0) + 1);
			const s: Sighting = { ...raw, playedAt };
			const key = s.toon || s.name;
			const p = players.get(key);
			if (!p) {
				players.set(key, { first: s, latest: s });
				continue;
			}
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
			prestiged.push({ ...who, from: p.first.prestige, to: p.latest.prestige });
		const xpGained = careerXp(p.latest) - careerXp(p.first);
		if (xpGained <= 0) continue;
		xp.push({
			...who,
			xpGained,
			games: Math.max(0, p.latest.gamesPlayed - p.first.gamesPlayed)
		});
	}
	xp.sort((a, b) => b.xpGained - a.xpGained || b.games - a.games);
	prestiged.sort((a, b) => b.to - a.to || a.name.localeCompare(b.name));

	const classPicks: WeeklyClassPick[] = [...picks]
		.map(([mos, n]) => ({ mos, picks: n }))
		.sort((a, b) => b.picks - a.picks || a.mos.localeCompare(b.mos))
		.slice(0, limit);

	return { xp: xp.slice(0, limit), prestiged, classPicks };
}
