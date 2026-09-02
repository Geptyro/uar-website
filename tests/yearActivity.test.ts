/** Unit tests for the overview page's year-activity buckets (npm test). */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	monthsOf,
	rollingMean,
	seriesOf,
	yearTimeline,
	type ActivityDay
} from '../src/lib/yearActivity.ts';

// mid-afternoon on purpose: the window must snap to whole UTC days regardless
const NOW = new Date('2026-08-29T15:41:07Z');
const DAY_MS = 24 * 3600 * 1000;

const day = (d: string, games: number, playerSeconds: number): ActivityDay => ({
	day: d,
	games,
	playerSeconds
});

test('window ends on the day now falls in and is zero-filled', () => {
	const y = yearTimeline([], NOW, 365);
	assert.equal(y.games.length, 365);
	assert.equal(y.players.length, 365);
	// last bucket is today; first is 364 days earlier, both at UTC midnight
	assert.equal(y.start + 364 * DAY_MS, Date.parse('2026-08-29T00:00:00Z'));
	assert.equal(y.start, Date.parse('2025-08-30T00:00:00Z'));
	assert.ok(y.games.every((v) => v === 0));
});

test('a day of games lands in its own bucket, as an average over the day', () => {
	const y = yearTimeline([day('2026-08-28', 3, 86400 * 2)], NOW, 365);
	const i = 363; // yesterday
	assert.equal(y.games[i], 3);
	assert.equal(y.players[i], 2); // 2 player-days over one day
	assert.equal(y.games[i - 1] + y.games[i + 1], 0);
});

test('rows outside the window are dropped, not clamped onto the edges', () => {
	const y = yearTimeline(
		[day('2020-01-01', 9, 100), day('2030-01-01', 9, 100), day('2025-08-29', 9, 100)],
		NOW,
		365
	);
	assert.equal(
		y.games.reduce((a, b) => a + b, 0),
		0
	);
});

test('a short window still ends today', () => {
	const y = yearTimeline([day('2026-08-29', 1, 86400)], NOW, 7);
	assert.equal(y.games.length, 7);
	assert.equal(y.games[6], 1);
	assert.equal(y.players[6], 1);
});

test('rolling mean is trailing and averages only over the days that exist', () => {
	assert.deepEqual(rollingMean([3, 0, 0], 3), [3, 1.5, 1]);
	// once the window is full it is a plain trailing mean
	assert.deepEqual(rollingMean([1, 1, 1, 4], 3), [1, 1, 1, 2]);
});

test('months cover the window end to end, oldest first', () => {
	const y = yearTimeline([], NOW, 365);
	const months = monthsOf(y);
	assert.equal(months.length, 13); // twelve, plus the stub the window opens on
	assert.equal(months[0].key, '2025-08');
	assert.equal(months[months.length - 1].key, '2026-08');
	assert.equal(months[0].from, 0);
	assert.equal(months[months.length - 1].to, 365);
	// contiguous, no gaps
	months.forEach((m, i) => i && assert.equal(m.from, months[i - 1].to));
});

test('minDays drops the leading stub but never the running month', () => {
	const y = yearTimeline([], NOW, 365);
	// the window opens on 2025-08-30, so August contributes two days
	const months = monthsOf(y, 12);
	assert.equal(months.length, 12);
	assert.equal(months[0].key, '2025-09');
	// the newest month is 29 days old and still has to be shown
	assert.equal(months[11].key, '2026-08');
	assert.equal(monthsOf(y, 31)[monthsOf(y, 31).length - 1].key, '2026-08');
});

test('a window inside one month is never emptied by minDays', () => {
	const y = yearTimeline([], NOW, 3);
	assert.deepEqual(monthsOf(y, 12), [{ key: '2026-08', from: 0, to: 3 }]);
});

test('seriesOf picks the series the switch names', () => {
	const y = yearTimeline([day('2026-08-29', 3, 86400 * 2)], NOW, 365);
	assert.equal(seriesOf(y, 'games')[364], 3);
	assert.equal(seriesOf(y, 'players')[364], 2);
});
