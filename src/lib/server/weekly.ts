/**
 * The overview page's 7-day widgets, aggregated from stored replay docs in
 * one pass: XP leaderboard, prestiged honor roll, class pick counts.
 *
 * Sightings carry cumulative bank values, so a player's gain over the window
 * is the careerXp difference between their newest sighting and a baseline:
 * their newest sighting from shortly before the window (at most GRACE early —
 * an older one would credit months of play to "this week"), or failing that
 * their oldest sighting within it (undercounting whatever they earned before
 * that first upload). careerXp folds prestige in (600k per level), so a
 * mid-week prestige reset still counts as forward progress. Players need two
 * qualifying sightings spanning some of the window to appear at all.
 * The same baseline pair yields the honor roll (prestige level increased).
 *
 * Class picks are a plain count over in-window sightings — one per class per
 * game — so unlike the bank deltas they only see uploaded games.
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
/** How far before the window a baseline sighting may sit and still be trusted. */
const GRACE_MS = 3 * 24 * 3600 * 1000;

/** Boards over the 7 days before `now`; xp/classPicks capped at `limit` rows. */
export function weeklyBoards(replays: WeeklyXpReplay[], now: Date, limit = 10): WeeklyBoards {
	const windowStart = now.getTime() - WINDOW_MS;

	// player key -> newest sighting, newest pre-window one, oldest in-window one
	const players = new Map<string, { latest: Sighting; pre?: Sighting; first?: Sighting }>();
	const picks = new Map<string, number>();
	for (const r of replays) {
		const playedAt = Date.parse(r.playedAt);
		if (Number.isNaN(playedAt)) continue;
		const inWindow = playedAt >= windowStart;
		for (const raw of r.sightings) {
			if (inWindow) for (const mos of raw.mos) picks.set(mos, (picks.get(mos) ?? 0) + 1);
			const s: Sighting = { ...raw, playedAt };
			const key = s.toon || s.name;
			const p = players.get(key);
			if (!p) {
				players.set(key, {
					latest: s,
					pre: inWindow ? undefined : s,
					first: inWindow ? s : undefined
				});
				continue;
			}
			if (playedAt > p.latest.playedAt) p.latest = s;
			if (!inWindow) {
				if (!p.pre || playedAt > p.pre.playedAt) p.pre = s;
			} else if (!p.first || playedAt < p.first.playedAt) {
				p.first = s;
			}
		}
	}

	const xp: WeeklyXpEntry[] = [];
	const prestiged: WeeklyPrestige[] = [];
	for (const [toonOrName, p] of players) {
		if (p.latest.playedAt < windowStart) continue; // not seen this week
		const pre = p.pre && p.pre.playedAt >= windowStart - GRACE_MS ? p.pre : undefined;
		const base = pre ?? p.first;
		if (!base || base === p.latest) continue; // no span to diff over
		const who = {
			name: p.latest.name,
			clan: p.latest.clan,
			toon: p.latest.toon || (toonOrName === p.latest.name ? '' : toonOrName)
		};
		if (p.latest.prestige > base.prestige)
			prestiged.push({ ...who, from: base.prestige, to: p.latest.prestige });
		const xpGained = careerXp(p.latest) - careerXp(base);
		if (xpGained <= 0) continue;
		xp.push({ ...who, xpGained, games: Math.max(0, p.latest.gamesPlayed - base.gamesPlayed) });
	}
	xp.sort((a, b) => b.xpGained - a.xpGained || b.games - a.games);
	prestiged.sort((a, b) => b.to - a.to || a.name.localeCompare(b.name));

	const classPicks: WeeklyClassPick[] = [...picks]
		.map(([mos, n]) => ({ mos, picks: n }))
		.sort((a, b) => b.picks - a.picks || a.mos.localeCompare(b.mos))
		.slice(0, limit);

	return { xp: xp.slice(0, limit), prestiged, classPicks };
}
