/**
 * Read-cache freshness (node:test, `npm test`).
 *
 * The case that matters is the last one: a TTL longer than the stale window.
 * When the window was an absolute age rather than a window past the TTL, that
 * combination made the stale branch unreachable, so every expiry blocked a
 * visitor on the full query — the exact stall the cache exists to prevent.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cacheState, cacheKeyMatches } from '../src/lib/cache.ts';

const MIN = 60_000;

test('young values are served as-is', () => {
	assert.equal(cacheState(0, 10 * MIN, 30 * MIN), 'fresh');
	assert.equal(cacheState(10 * MIN - 1, 10 * MIN, 30 * MIN), 'fresh');
});

test('past the TTL it is served stale while the refresh runs', () => {
	assert.equal(cacheState(10 * MIN, 10 * MIN, 30 * MIN), 'stale');
	assert.equal(cacheState(39 * MIN, 10 * MIN, 30 * MIN), 'stale');
});

test('past TTL + window the caller has to wait', () => {
	assert.equal(cacheState(40 * MIN, 10 * MIN, 30 * MIN), 'expired');
	assert.equal(cacheState(24 * 60 * MIN, 10 * MIN, 30 * MIN), 'expired');
});

test('a TTL longer than the stale window still yields a stale window', () => {
	// the regression: with an absolute-age window this returned 'expired' the
	// instant the value aged out, and nothing was ever served stale again
	assert.equal(cacheState(10 * MIN, 10 * MIN, 5 * MIN), 'stale');
	assert.equal(cacheState(14 * MIN, 10 * MIN, 5 * MIN), 'stale');
	assert.equal(cacheState(15 * MIN, 10 * MIN, 5 * MIN), 'expired');
});

test('a short-lived key still gets its window', () => {
	assert.equal(cacheState(31_000, 30_000, 30 * MIN), 'stale');
});

// Invalidation scope. A presence heartbeat arrives every half-minute from
// every running Companion; when it cleared everything, almost every page view
// became a cold read. These pin that it now reaches the roster and nothing else.

test('a prefix matches its own key and its namespace', () => {
	assert.equal(cacheKeyMatches('presence', ['presence']), true);
	assert.equal(cacheKeyMatches('replays:page:1:50', ['replays']), true);
	assert.equal(cacheKeyMatches('replays', ['replays']), true);
});

test('a prefix does not bleed into a sibling namespace', () => {
	// the trap: 'player' must not reach the leaderboard or the summaries
	assert.equal(cacheKeyMatches('players:count', ['player']), false);
	assert.equal(cacheKeyMatches('playerSummary:2-S2-1-1', ['player']), false);
	assert.equal(cacheKeyMatches('player:2-S2-1-1', ['player']), true);
});

test('a presence heartbeat leaves the page caches alone', () => {
	const untouched = [
		'replays:page:1:50',
		'players:careerXp:-1:1',
		'clans:members',
		'playerSummary:2-S2-1-7486118',
		'playerHistory:2-S2-1-7486118:1',
		'mosBoard:AlligatorLK19',
		'weeklyBoards'
	];
	for (const key of untouched) {
		assert.equal(cacheKeyMatches(key, ['presence']), false, `${key} should survive a heartbeat`);
	}
	assert.equal(cacheKeyMatches('presence', ['presence']), true);
	assert.equal(cacheKeyMatches('ready', ['ready']), true);
});
