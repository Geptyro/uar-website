/**
 * The in-process presence store. Its whole job is deciding what is still true,
 * so the expiry boundaries get the attention: a record one millisecond past
 * stale must be gone, and a `menus` beat must never surface as a chip.
 */
import { strict as assert } from 'node:assert';
import { test, beforeEach } from 'node:test';
import {
	clearPresence,
	deletePresence,
	getActivePresence,
	getPresence,
	presenceCount,
	upsertPresence,
	type PresenceRecord
} from '../src/lib/server/presenceStore.ts';

const NOW = Date.parse('2026-08-03T12:00:00Z');
const STALE_MS = 2 * 60_000;

const beat = (sub: string, over: Partial<PresenceRecord> = {}): PresenceRecord => ({
	sub,
	battletag: `${sub}#1234`,
	status: 'lobby',
	uar: true,
	at: new Date(NOW).toISOString(),
	...over
});

beforeEach(() => clearPresence());

test('a fresh lobby beat is served', () => {
	upsertPresence(beat('a'), NOW);
	assert.deepEqual(
		getActivePresence(STALE_MS, NOW).map((r) => r.sub),
		['a']
	);
});

test('a beat exactly at the staleness boundary is already gone', () => {
	upsertPresence(beat('a'), NOW);
	assert.equal(getActivePresence(STALE_MS, NOW + STALE_MS - 1).length, 1);
	assert.equal(getActivePresence(STALE_MS, NOW + STALE_MS).length, 0);
});

test('menus is stored but never shown — it means "not in a game"', () => {
	upsertPresence(beat('a', { status: 'menus' }), NOW);
	assert.equal(getActivePresence(STALE_MS, NOW).length, 0);
	assert.equal(getPresence('a')?.status, 'menus', 'the ready route still reads it');
});

test('a heartbeat replaces the account’s previous one rather than stacking', () => {
	upsertPresence(beat('a', { status: 'lobby' }), NOW);
	upsertPresence(beat('a', { status: 'ingame', at: new Date(NOW + 1000).toISOString() }), NOW + 1000);
	assert.equal(presenceCount(), 1);
	assert.equal(getActivePresence(STALE_MS, NOW + 1000)[0].status, 'ingame');
});

test('active entries come back oldest first', () => {
	upsertPresence(beat('late', { at: new Date(NOW + 5_000).toISOString() }), NOW);
	upsertPresence(beat('early', { at: new Date(NOW).toISOString() }), NOW);
	assert.deepEqual(
		getActivePresence(STALE_MS, NOW + 5_000).map((r) => r.sub),
		['early', 'late']
	);
});

test('an explicit clear removes the entry — SC2 exit, or the app quitting', () => {
	upsertPresence(beat('a'), NOW);
	deletePresence('a');
	assert.equal(getPresence('a'), null);
	assert.equal(getActivePresence(STALE_MS, NOW).length, 0);
});

test('a companion that quit without a DELETE is forgotten, not kept forever', () => {
	upsertPresence(beat('ghost'), NOW);
	// long stale, but only a later write triggers the sweep
	upsertPresence(beat('live', { at: new Date(NOW + 2 * 3_600_000).toISOString() }), NOW + 2 * 3_600_000);
	assert.equal(presenceCount(), 1, 'the hour-old record was dropped on the next write');
	assert.equal(getPresence('ghost'), null);
});

test('a restart starts empty — the companions re-heartbeat within a minute', () => {
	upsertPresence(beat('a'), NOW);
	clearPresence(); // what a deploy does
	assert.equal(getActivePresence(STALE_MS, NOW).length, 0);
});
