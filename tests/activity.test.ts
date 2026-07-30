/** Unit tests for the overview page's activity-timeline aggregation (npm test). */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activityTimeline } from '../src/lib/activity.ts';

// slot-aligned so the window is exactly 2026-07-19T12:00 .. 2026-07-26T12:00
const NOW = new Date('2026-07-26T12:00:00Z');
const LOOPS_PER_MINUTE = 16 * 60;

// `startedAt`, not a doc's `playedAt`: the chart is fed the time a game began,
// which the caller derives — see gameEnd.startedAtOf
const game = (startedAt: string, players: number, minutes?: number) => ({
	startedAt,
	players,
	gameLoops: minutes === undefined ? undefined : minutes * LOOPS_PER_MINUTE
});

const slotOf = (iso: string, start: number) => (Date.parse(iso) - start) / (30 * 60 * 1000);

test('covers the window with slot-aligned bounds and zero-filled slots', () => {
	const { start, values } = activityTimeline([], NOW);
	assert.equal(start, Date.parse('2026-07-19T12:00:00Z'));
	assert.equal(values.length, 7 * 48);
	assert.ok(values.every((v) => v === 0));
});

test('a slot-aligned game fills exactly its slots with its player count', () => {
	const { start, values } = activityTimeline([game('2026-07-25T20:00:00Z', 4, 60)], NOW);
	const i = slotOf('2026-07-25T20:00:00Z', start);
	assert.equal(values[i - 1], 0);
	assert.equal(values[i], 4);
	assert.equal(values[i + 1], 4);
	assert.equal(values[i + 2], 0);
});

test('partial slot overlap credits the overlapped fraction', () => {
	// 45-minute, 2-player game starting at :15 — half of slot 1, all of slot 2
	const { start, values } = activityTimeline([game('2026-07-25T20:15:00Z', 2, 45)], NOW);
	const i = slotOf('2026-07-25T20:00:00Z', start);
	assert.equal(values[i], 1);
	assert.equal(values[i + 1], 2);
	assert.equal(values[i + 2], 0);
});

test('concurrent games stack', () => {
	const { start, values } = activityTimeline(
		[game('2026-07-25T20:00:00Z', 4, 30), game('2026-07-25T20:00:00Z', 3, 30)],
		NOW
	);
	assert.equal(values[slotOf('2026-07-25T20:00:00Z', start)], 7);
});

test('games straddling the window start are clipped, not dropped', () => {
	// 60-minute game whose second half falls inside the window
	const { values } = activityTimeline([game('2026-07-19T11:30:00Z', 6, 60)], NOW);
	assert.equal(values[0], 6);
	assert.equal(values[1], 0);
});

test('missing duration falls back to 30 minutes', () => {
	const { start, values } = activityTimeline([game('2026-07-25T20:00:00Z', 3)], NOW);
	const i = slotOf('2026-07-25T20:00:00Z', start);
	assert.equal(values[i], 3);
	assert.equal(values[i + 1], 0);
});

test('skips unparseable dates, caps runaway durations at a day', () => {
	const { values } = activityTimeline(
		[
			{ startedAt: 'not a date', players: 8, gameLoops: 30 * LOOPS_PER_MINUTE },
			game('2026-07-20T00:00:00Z', 1, 7 * 24 * 60) // a week of loops → capped at 24h
		],
		NOW
	);
	assert.equal(
		values.reduce((n, v) => n + v, 0),
		48 // 1 player × 24h of half-hour slots
	);
});
