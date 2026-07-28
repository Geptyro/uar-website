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
import { cacheState } from '../src/lib/cache.ts';

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
