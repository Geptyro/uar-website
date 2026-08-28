/**
 * Activity timeline for the overview chart: average players in game per
 * half-hour slot over a trailing window — the Steam-charts view of when
 * games actually run.
 *
 * Each game credits every slot it overlaps with lobby-size × overlap time, so
 * a 90-minute 6-player game raises three slots, not just its start slot.
 * Slot timestamps are absolute (epoch ms); the chart renders axis labels and
 * tooltips in the viewer's timezone client-side.
 *
 * Dependency-free (pattern: xp.ts) so node:test can load it directly and the
 * chart component can import the constants without pulling in server code.
 */

import { LOOPS_PER_SECOND } from './gameEnd.ts';
import type { Outcome } from './outcome.ts';

export const SLOT_MINUTES = 30;

export interface ActivityTimeline {
	/** Epoch ms of the first slot's start; slot i covers start + i·30min. */
	start: number;
	/** Average players in game during each half-hour slot, oldest first. */
	values: number[];
}

/** One game, as the chart needs it. */
export interface ActivityGame {
	/**
	 * When the game began, UTC. Not a replay doc's `playedAt`, which is when
	 * the recording *stopped* — see gameEnd.startedAtOf, which is what the
	 * caller resolves this from. Feeding the end in as a start put every game
	 * on the chart a full game-length late.
	 */
	startedAt: string;
	players: number;
	/** The game's own length in loops (16 per game-second, see gameEnd.ts). */
	gameLoops?: number;
	/** The replay file, so the longest game of the week can link to its page. */
	file?: string;
	/** The settled result and mode where known — not read by the chart itself. */
	outcome?: Outcome;
	mode?: number;
}

const SLOT_MS = SLOT_MINUTES * 60 * 1000;
const DAY_MS = 24 * 3600 * 1000;
/** Credited when a doc carries no length at all. */
const DEFAULT_DURATION_MS = 30 * 60 * 1000;

/**
 * Players in game per half-hour slot over the `days` days before `now`
 * (window end rounded up to a slot boundary). Games overlapping the window
 * edge are clipped to it; unparseable dates are skipped; durations are capped
 * at a day so corrupt loop counts can't dominate the chart.
 */
export function activityTimeline(
	replays: ActivityGame[],
	now: Date,
	days = 7
): ActivityTimeline {
	const endSlot = Math.ceil(now.getTime() / SLOT_MS);
	const slots = (days * DAY_MS) / SLOT_MS;
	const windowStart = (endSlot - slots) * SLOT_MS;
	const windowEnd = endSlot * SLOT_MS;
	const playerMs = new Array<number>(slots).fill(0);
	for (const r of replays) {
		const started = Date.parse(r.startedAt);
		if (Number.isNaN(started)) continue;
		const durationMs = r.gameLoops
			? Math.min(DAY_MS, (r.gameLoops / LOOPS_PER_SECOND) * 1000)
			: DEFAULT_DURATION_MS;
		const end = Math.min(started + durationMs, windowEnd);
		for (let t = Math.max(started, windowStart); t < end; ) {
			const chunkEnd = Math.min(end, t - (t % SLOT_MS) + SLOT_MS);
			playerMs[Math.floor((t - windowStart) / SLOT_MS)] += (chunkEnd - t) * r.players;
			t = chunkEnd;
		}
	}
	return {
		start: windowStart,
		values: playerMs.map((ms) => Math.round((ms / SLOT_MS) * 1000) / 1000)
	};
}
