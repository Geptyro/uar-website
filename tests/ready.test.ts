/** Unit tests for the "ready to play" helpers (npm test). */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeReady, minutesLeft, readyLevel, READY_DURATION_MS } from '../src/lib/ready.ts';

const T0 = Date.parse('2026-07-26T12:00:00Z');
const at = (offsetMs: number) => new Date(T0 + offsetMs).toISOString();

test('flag duration is one hour', () => {
	assert.equal(READY_DURATION_MS, 3_600_000);
});

test('activeReady keeps unexpired flags and drops expired ones', () => {
	const players = [
		{ battletag: 'Fresh#1', until: at(READY_DURATION_MS) },
		{ battletag: 'AlmostGone#2', until: at(1_000) },
		{ battletag: 'Expired#3', until: at(-1) },
		{ battletag: 'JustExpired#4', until: at(0) }
	];
	assert.deepEqual(
		activeReady(players, T0).map((p) => p.battletag),
		['Fresh#1', 'AlmostGone#2']
	);
});

test('readyLevel buckets: green above 30 min, gold to 30, red to 10', () => {
	assert.equal(readyLevel(60), 'high');
	assert.equal(readyLevel(31), 'high');
	assert.equal(readyLevel(30), 'mid');
	assert.equal(readyLevel(11), 'mid');
	assert.equal(readyLevel(10), 'low');
	assert.equal(readyLevel(1), 'low');
});

test('minutesLeft rounds up and never reports zero while active', () => {
	assert.equal(minutesLeft(at(READY_DURATION_MS), T0), 60);
	assert.equal(minutesLeft(at(59 * 60_000 + 1), T0), 60);
	assert.equal(minutesLeft(at(30 * 60_000), T0), 30);
	assert.equal(minutesLeft(at(30_000), T0), 1);
	assert.equal(minutesLeft(at(1), T0), 1);
});
