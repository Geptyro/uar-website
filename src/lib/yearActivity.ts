/**
 * The year view of the activity chart: one bucket per day over a trailing
 * ~12-month window, beside the half-hour view `activity.ts` builds for the
 * last week.
 *
 * The two are deliberately different objects. A year of half-hour slots is
 * 17 520 numbers and the shape of every game inside a day is noise at this
 * zoom, so the database groups by day and returns ~365 rows (measured: 55 ms,
 * ~20 KB) rather than the archive — the only lever this cluster has is bytes
 * returned (see server/db.ts).
 *
 * Days are UTC, because that is the boundary the grouping key cuts on
 * (`playedAt` is stored as a fixed-width UTC string). The week chart renders
 * in the viewer's timezone; this one cannot without regrouping, and at day
 * resolution the difference is which side of midnight a handful of games
 * land on. The label formatters below all pin `timeZone: 'UTC'` so SSR and
 * hydration agree.
 *
 * Dependency-free (pattern: xp.ts) so node:test can load it directly and the
 * chart components can import the constants without pulling in server code.
 */

/** Trailing window of the year chart — the query and the chart must agree. */
export const YEAR_DAYS = 365;

export const DAY_MS = 24 * 3600 * 1000;

/** One day of games, as the database groups them. Sparse: quiet days absent. */
export interface ActivityDay {
	/** `YYYY-MM-DD`, UTC, the day the games *started* on. */
	day: string;
	/** Games that started that day. */
	games: number;
	/** Σ lobby size × game length, in seconds — player-time in game. */
	playerSeconds: number;
}

/** The dense series the charts read: parallel arrays, oldest day first. */
export interface YearTimeline {
	/** Epoch ms of the first day's UTC midnight; day i is `start + i·DAY_MS`. */
	start: number;
	/** Average players in game across each whole day (player-seconds / 86400). */
	players: number[];
	/** Games started each day. */
	games: number[];
}

/** Which number the bars are drawn from. */
export type YearMetric = 'players' | 'games';

export const METRIC_LABEL: Record<YearMetric, string> = {
	players: 'Players in game',
	games: 'Games played'
};

/** UTC midnight of the day `d` falls in. */
export function dayStart(ms: number): number {
	return Math.floor(ms / DAY_MS) * DAY_MS;
}

/** `YYYY-MM-DD` (UTC) of an epoch-ms instant. */
export function dayKey(ms: number): string {
	return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Fill the sparse day rows into a dense trailing window ending on the day
 * `now` falls in (inclusive), so a quiet day is a zero rather than a gap.
 * Rows outside the window are ignored; a duplicate key would be summed, which
 * the grouping cannot produce but costs nothing to survive.
 */
export function yearTimeline(rows: ActivityDay[], now: Date, days = YEAR_DAYS): YearTimeline {
	const end = dayStart(now.getTime()) + DAY_MS; // exclusive
	const start = end - days * DAY_MS;
	const players = new Array<number>(days).fill(0);
	const games = new Array<number>(days).fill(0);
	for (const r of rows) {
		const at = Date.parse(`${r.day}T00:00:00Z`);
		if (Number.isNaN(at)) continue;
		const i = Math.floor((at - start) / DAY_MS);
		if (i < 0 || i >= days) continue;
		players[i] += Math.round((r.playerSeconds / 86400) * 1000) / 1000;
		games[i] += r.games;
	}
	return { start, players, games };
}

/** The series for one metric. */
export function seriesOf(year: YearTimeline, metric: YearMetric): number[] {
	return metric === 'games' ? year.games : year.players;
}

/**
 * Trailing mean over `window` days, aligned on the right — what smooths the
 * daily series into a trend line. The first days average over what exists
 * rather than over zeros, so the line does not start from a false floor.
 */
export function rollingMean(values: number[], window: number): number[] {
	const out = new Array<number>(values.length);
	let sum = 0;
	for (let i = 0; i < values.length; i++) {
		sum += values[i];
		if (i >= window) sum -= values[i - window];
		out[i] = sum / Math.min(i + 1, window);
	}
	return out;
}

/**
 * Calendar months the window touches, oldest first, with their day spans.
 *
 * `minDays` drops a leading stub. A trailing 365-day window starts mid-month,
 * so the oldest "month" is however many days are left of it — two, some years
 * — and a stub that thin has no room for its own label: it drew on top of the
 * next month's, which is how "ASep" ended up under the axis.
 */
export function monthsOf(
	year: YearTimeline,
	minDays = 0
): { key: string; from: number; to: number }[] {
	const out: { key: string; from: number; to: number }[] = [];
	for (let i = 0; i < year.games.length; i++) {
		const key = dayKey(year.start + i * DAY_MS).slice(0, 7);
		const last = out[out.length - 1];
		if (last?.key === key) last.to = i + 1;
		else out.push({ key, from: i, to: i + 1 });
	}
	// only ever the first: every other month in the window is whole, and the
	// last one is the running month, which must stay however young it is
	if (out.length > 1 && out[0].to - out[0].from < minDays) out.shift();
	return out;
}


