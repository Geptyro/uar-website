/**
 * Per-class player boards, aggregated from stored replay docs — who plays a
 * class, how much, and how it goes for them.
 *
 * Time credited to a player for a game is the stretch they were in it: the
 * game's own length — not the recording's, which keeps counting while a
 * client sits in a finished map (see lib/gameEnd.ts); docs from before that
 * was separated out carry only the recording's length and fall back to it —
 * cut where the sighting records them leaving (`leftLoop`; a sighting from
 * before that was read counts as staying to the end). A sighting listing
 * several classes (re-picks) credits that time to each of them. A class's own
 * game time is the longest any of its players stayed.
 *
 * Wins and losses are the game's settled outcome (lib/outcome.ts) — a fact
 * about the game, credited to every player who picked the class in it, so
 * a class's win rate is "how often a game with one of these in it was won",
 * not a claim about who carried it.
 *
 * Computed once per upload by the derived-data pass and stored per class (see
 * `persistMosBoards` in db.ts); the pages read the stored doc.
 */

import type { MosTopPlayer } from '../players.ts';
import type { Outcome } from '../outcome.ts';
import { LOOPS_PER_SECOND, playedLoops } from '../gameEnd.ts';
import { isBanned } from '../banned.ts';
import { weekOf } from '../weeks.ts';

export { weekOf };

/** The slice of a replay doc this aggregation needs. */
export interface PlaytimeReplay {
	/** The replay's file name — the game's id on the site. */
	file?: string;
	playedAt: string;
	/** Recording length in game loops (16 per game-second). */
	durationLoops?: number;
	/** The game's own length in the same loops, where it is known. */
	gameLoops?: number;
	/** The game's result, where either source has settled it. */
	outcome?: Outcome | null;
	/** Game mode 1..12, where the vote or the counters settled it. */
	mode?: number | null;
	sightings: {
		toon: string;
		name: string;
		clan: string;
		mos: string[];
		/** The loop this player left at, where the recording saw them leave. */
		leftLoop?: number | null;
	}[];
}

/** Everything a class's Players tab shows besides the board itself. */
export interface MosClassStats {
	/** Distinct players ever recorded on the class. */
	players: number;
	/** Recorded games with at least one player on the class. */
	games: number;
	/** Player-games: one per player per game on the class. */
	picks: number;
	/** Game time with the class in play, in seconds — each game once, for as
	 *  long as the longest-staying of its players was in it. */
	seconds: number;
	/** Of those games, how many were settled won or lost. */
	wins: number;
	losses: number;
	/** The same, per settled mode (1..12), busiest first. */
	byMode: { mode: number; games: number; wins: number; losses: number }[];
	firstAt: string | null;
	lastAt: string | null;
}

/** One of the last games the class was seen in. */
export interface MosRecentGame {
	file: string;
	playedAt: string;
	seconds: number;
	mode: number | null;
	outcome: Outcome | null;
	/** Who picked the class in it. */
	players: { toon: string; name: string; clan: string }[];
}

/** Games with the class in them, per ISO week (Monday, UTC), oldest first. */
export interface MosWeek {
	/** The week's Monday, YYYY-MM-DD. */
	week: string;
	games: number;
	wins: number;
	losses: number;
}

/** Another class seen in the same games — a team-composition fact. */
export interface MosAlongside {
	mos: string;
	/** Games with both classes in them. */
	games: number;
}

export interface MosBoard {
	/** Top players by recorded time on the class. */
	rows: MosTopPlayer[];
	stats: MosClassStats;
	recent: MosRecentGame[];
	/** Every week the class was seen in, oldest first — the page picks its window. */
	weekly: MosWeek[];
	/** The classes most often in the same game, busiest first. */
	alongside: MosAlongside[];
}


/**
 * The board, the totals and the last few games, per MOS id.
 *
 * `limit` caps the rows kept per class (Infinity keeps them all) and `recent`
 * the games — everything else is a total, so it costs the same however many
 * players there are.
 */
export function classBoardsByMos(
	replays: PlaytimeReplay[],
	{
		limit = 25,
		recent = 8,
		alongside: alongsideLimit = 8
	}: { limit?: number; recent?: number; alongside?: number } = {}
): Record<string, MosBoard> {
	type Row = MosTopPlayer & { at: string };
	type Acc = {
		players: Map<string, Row>;
		games: number;
		picks: number;
		seconds: number;
		wins: number;
		losses: number;
		byMode: Map<number, { games: number; wins: number; losses: number }>;
		firstAt: string | null;
		lastAt: string | null;
		recent: MosRecentGame[];
		weekly: Map<string, { games: number; wins: number; losses: number }>;
		alongside: Map<string, number>;
	};
	const byMos = new Map<string, Acc>();
	const acc = (mos: string): Acc => {
		let a = byMos.get(mos);
		if (!a) {
			a = {
				players: new Map(),
				games: 0,
				picks: 0,
				seconds: 0,
				wins: 0,
				losses: 0,
				byMode: new Map(),
				firstAt: null,
				lastAt: null,
				recent: [],
				weekly: new Map(),
				alongside: new Map()
			};
			byMos.set(mos, a);
		}
		return a;
	};

	for (const r of replays) {
		const gameLoops = r.gameLoops ?? r.durationLoops ?? 0;
		const secondsOf = (s: { leftLoop?: number | null }) =>
			Math.round(playedLoops(gameLoops, s.leftLoop) / LOOPS_PER_SECOND);
		const outcome = r.outcome ?? null;
		const mode = r.mode ?? null;
		// who picked what in this game — a class counts the game once however
		// many players were on it, so the per-class roster is built first
		const roster = new Map<string, PlaytimeReplay['sightings']>();
		for (const s of r.sightings) {
			// boards, so the map's banned handles are left off them ($lib/banned).
			// Dropped here rather than from the finished rows, or excluding one
			// would leave a board a place short of its limit
			if (isBanned(s.toon || s.name)) continue;
			for (const mos of s.mos) {
				let list = roster.get(mos);
				if (!list) roster.set(mos, (list = []));
				list.push(s);
			}
		}
		const week = weekOf(r.playedAt);
		for (const [mos, sightings] of roster) {
			const a = acc(mos);
			// the class was in play for as long as its longest-staying player
			const seconds = Math.max(...sightings.map(secondsOf));
			a.games += 1;
			const w = a.weekly.get(week) ?? { games: 0, wins: 0, losses: 0 };
			w.games += 1;
			if (outcome === 'win') w.wins += 1;
			else if (outcome === 'loss') w.losses += 1;
			a.weekly.set(week, w);
			for (const other of roster.keys()) {
				if (other !== mos) a.alongside.set(other, (a.alongside.get(other) ?? 0) + 1);
			}
			a.picks += sightings.length;
			a.seconds += seconds;
			if (outcome === 'win') a.wins += 1;
			else if (outcome === 'loss') a.losses += 1;
			if (mode) {
				const m = a.byMode.get(mode) ?? { games: 0, wins: 0, losses: 0 };
				m.games += 1;
				if (outcome === 'win') m.wins += 1;
				else if (outcome === 'loss') m.losses += 1;
				a.byMode.set(mode, m);
			}
			if (!a.firstAt || r.playedAt < a.firstAt) a.firstAt = r.playedAt;
			if (!a.lastAt || r.playedAt > a.lastAt) a.lastAt = r.playedAt;
			if (r.file) {
				a.recent.push({
					file: r.file,
					playedAt: r.playedAt,
					seconds,
					mode,
					outcome,
					players: sightings.map((s) => ({
						toon: s.toon,
						name: s.name,
						clan: s.clan
					}))
				});
			}
			for (const s of sightings) {
				const key = s.toon || s.name;
				const own = secondsOf(s);
				const cur = a.players.get(key);
				if (!cur) {
					a.players.set(key, {
						name: s.name,
						clan: s.clan,
						toon: s.toon,
						games: 1,
						seconds: own,
						wins: outcome === 'win' ? 1 : 0,
						losses: outcome === 'loss' ? 1 : 0,
						lastAt: r.playedAt,
						at: r.playedAt
					});
				} else {
					cur.games += 1;
					cur.seconds += own;
					if (outcome === 'win') cur.wins = (cur.wins ?? 0) + 1;
					else if (outcome === 'loss') cur.losses = (cur.losses ?? 0) + 1;
					if (r.playedAt > cur.at) {
						// newest sighting names the player: renames and clan moves follow
						cur.at = r.playedAt;
						cur.lastAt = r.playedAt;
						cur.name = s.name;
						cur.clan = s.clan;
					}
				}
			}
		}
	}

	const out: Record<string, MosBoard> = {};
	for (const [mos, a] of byMos) {
		out[mos] = {
			rows: [...a.players.values()]
				.sort((x, y) => y.seconds - x.seconds || y.games - x.games)
				.slice(0, limit)
				.map(({ at: _, ...p }) => p),
			stats: {
				players: a.players.size,
				games: a.games,
				picks: a.picks,
				seconds: a.seconds,
				wins: a.wins,
				losses: a.losses,
				byMode: [...a.byMode]
					.map(([mode, m]) => ({ mode, ...m }))
					.sort((x, y) => y.games - x.games || x.mode - y.mode),
				firstAt: a.firstAt,
				lastAt: a.lastAt
			},
			recent: a.recent
				.sort((x, y) => (x.playedAt < y.playedAt ? 1 : x.playedAt > y.playedAt ? -1 : 0))
				.slice(0, recent),
			weekly: [...a.weekly]
				.map(([week, w]) => ({ week, ...w }))
				.sort((x, y) => (x.week < y.week ? -1 : x.week > y.week ? 1 : 0)),
			alongside: [...a.alongside]
				.map(([mos, games]) => ({ mos, games }))
				.sort((x, y) => y.games - x.games || x.mos.localeCompare(y.mos))
				.slice(0, alongsideLimit)
		};
	}
	return out;
}

/** Top players per MOS id, by recorded seconds played (ties: games). */
export function topPlayersByMos(
	replays: PlaytimeReplay[],
	limit = 10
): Record<string, MosTopPlayer[]> {
	const boards = classBoardsByMos(replays, { limit, recent: 0 });
	const out: Record<string, MosTopPlayer[]> = {};
	for (const [mos, b] of Object.entries(boards)) out[mos] = b.rows;
	return out;
}
