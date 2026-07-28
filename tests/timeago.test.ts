/**
 * Relative ages (node:test, `npm test`).
 *
 * `now` is an argument rather than the clock, so every boundary is checkable
 * without waiting for one.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timeAgo } from '../src/lib/timeago.ts';

const NOW = Date.parse('2026-07-29T12:00:00Z');
/** an ISO stamp `secs` before NOW */
const ago = (secs: number) => new Date(NOW - secs * 1000).toISOString();

test('the first minute is "just now"', () => {
	assert.equal(timeAgo(ago(0), NOW), 'just now');
	assert.equal(timeAgo(ago(44), NOW), 'just now');
	assert.equal(timeAgo(ago(45), NOW), '1 min ago');
});

test('minutes, then hours, then days, then weeks', () => {
	assert.equal(timeAgo(ago(9 * 60), NOW), '9 min ago');
	assert.equal(timeAgo(ago(3 * 3600), NOW), '3h ago');
	assert.equal(timeAgo(ago(50 * 3600), NOW), '2d ago');
	assert.equal(timeAgo(ago(20 * 86400), NOW), '2w ago');
});

test('an age is never rounded up past its unit', () => {
	// 59.6 minutes is not an hour, and must not read as "60 min ago"
	assert.equal(timeAgo(ago(3599), NOW), '59 min ago');
	// nor is 23h59m a day
	assert.equal(timeAgo(ago(86399), NOW), '23h ago');
	assert.equal(timeAgo(ago(86400), NOW), '1d ago');
});

test('a clock running ahead of the stamp still reads as now, never negative', () => {
	assert.equal(timeAgo(new Date(NOW + 30_000).toISOString(), NOW), 'just now');
});

test('past five weeks there is no useful age left — the caller shows the date', () => {
	assert.equal(timeAgo(ago(34 * 86400), NOW), '4w ago');
	assert.equal(timeAgo(ago(35 * 86400), NOW), null);
	assert.equal(timeAgo(ago(400 * 86400), NOW), null);
});

test('an unparseable stamp is not an age', () => {
	assert.equal(timeAgo('', NOW), null);
	assert.equal(timeAgo('not a date', NOW), null);
});
