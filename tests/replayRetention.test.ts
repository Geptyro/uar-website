/** Unit tests for the replay blob retention rule (npm test). */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	pinnedOnArrival,
	pinnedReplays,
	prunableReplays,
	type RetentionReplay
} from '../src/lib/replayRetention.ts';

const r = (file: string, playedAt: string, toons: string[], blobPruned = false): RetentionReplay => ({
	file,
	playedAt,
	toons,
	blobPruned
});

test("keeps every player's latest replay", () => {
	const replays = [
		r('a.SC2Replay', '2026-01-01T10:00:00Z', ['t1', 't2']),
		r('b.SC2Replay', '2026-02-01T10:00:00Z', ['t1', 't2'])
	];
	// both players moved on from a, so only b is needed
	assert.deepEqual([...pinnedReplays(replays)], ['b.SC2Replay']);
	assert.deepEqual(prunableReplays(replays), ['a.SC2Replay']);
});

test('one player who never came back pins the whole replay', () => {
	const replays = [
		r('a.SC2Replay', '2026-01-01T10:00:00Z', ['t1', 'gone']),
		r('b.SC2Replay', '2026-02-01T10:00:00Z', ['t1'])
	];
	// "gone" has no later replay — a stays, even though t1 moved on
	assert.deepEqual(prunableReplays(replays), []);
	assert.deepEqual([...pinnedReplays(replays)].sort(), ['a.SC2Replay', 'b.SC2Replay']);
});

test('ingesting an older replay never un-prunes (the rule is monotonic)', () => {
	const before = [
		r('a.SC2Replay', '2026-01-01T10:00:00Z', ['t1']),
		r('b.SC2Replay', '2026-02-01T10:00:00Z', ['t1'])
	];
	assert.deepEqual(prunableReplays(before), ['a.SC2Replay']);
	// a backfilled game older than both: still prunable, and a stays prunable
	const after = [...before, r('old.SC2Replay', '2025-06-01T10:00:00Z', ['t1'])];
	assert.deepEqual(prunableReplays(after), ['a.SC2Replay', 'old.SC2Replay']);
});

test('a backfilled replay introducing an unseen player pins itself', () => {
	const replays = [
		r('a.SC2Replay', '2026-02-01T10:00:00Z', ['t1']),
		r('old.SC2Replay', '2025-06-01T10:00:00Z', ['t1', 'newcomer'])
	];
	// old is "newcomer"'s only game, so it is their latest
	assert.deepEqual(prunableReplays(replays), []);
});

test('keepPerPlayer keeps the N most recent per player', () => {
	const replays = [
		r('a.SC2Replay', '2026-01-01T10:00:00Z', ['t1']),
		r('b.SC2Replay', '2026-02-01T10:00:00Z', ['t1']),
		r('c.SC2Replay', '2026-03-01T10:00:00Z', ['t1'])
	];
	assert.deepEqual(prunableReplays(replays, 1), ['a.SC2Replay', 'b.SC2Replay']);
	assert.deepEqual(prunableReplays(replays, 2), ['a.SC2Replay']);
	assert.deepEqual(prunableReplays(replays, 3), []);
	assert.throws(() => prunableReplays(replays, 0), RangeError);
});

test('already-pruned blobs are not returned again', () => {
	const replays = [
		r('a.SC2Replay', '2026-01-01T10:00:00Z', ['t1'], true),
		r('b.SC2Replay', '2026-02-01T10:00:00Z', ['t1'])
	];
	assert.deepEqual(prunableReplays(replays), []);
});

test('a replay with no parsed sightings is kept, not silently dropped', () => {
	const replays = [
		r('empty.SC2Replay', '2026-01-01T10:00:00Z', []),
		r('b.SC2Replay', '2026-02-01T10:00:00Z', ['t1'])
	];
	// pins nothing, but it is the case we understand least — keep the bytes
	assert.deepEqual(prunableReplays(replays), []);
});

test('same-minute replays resolve deterministically regardless of input order', () => {
	const a = r('20260101-1000-1.SC2Replay', '2026-01-01T10:00:00Z', ['t1']);
	const b = r('20260101-1000-2.SC2Replay', '2026-01-01T10:00:00Z', ['t1']);
	assert.deepEqual(prunableReplays([a, b]), prunableReplays([b, a]));
});

test('duplicate toons within one replay do not consume extra keep slots', () => {
	const replays = [
		r('a.SC2Replay', '2026-01-01T10:00:00Z', ['t1']),
		r('b.SC2Replay', '2026-02-01T10:00:00Z', ['t1', 't1'])
	];
	// b must not count as both of t1's two most recent games
	assert.deepEqual(prunableReplays(replays, 2), []);
	assert.deepEqual(prunableReplays(replays, 1), ['a.SC2Replay']);
});

test('a game nobody has played past is pinned on arrival', () => {
	// the ordinary upload: a game that just finished, every count zero
	assert.equal(pinnedOnArrival([0, 0, 0, 0]), true);
});

test('a backfilled game everyone has moved past is not pinned on arrival', () => {
	assert.equal(pinnedOnArrival([1, 3, 12]), false);
	// one straggler is enough to keep it, exactly as in prunableReplays
	assert.equal(pinnedOnArrival([1, 3, 0]), true);
});

test('pinnedOnArrival counts against keepPerPlayer, not against one', () => {
	assert.equal(pinnedOnArrival([1, 1], 2), true);
	assert.equal(pinnedOnArrival([2, 2], 2), false);
	assert.throws(() => pinnedOnArrival([1], 0), RangeError);
});

test('pinnedOnArrival keeps a replay with no participants', () => {
	// mirrors the no-sightings rule in prunableReplays — the bytes we least
	// understand are the ones worth keeping
	assert.equal(pinnedOnArrival([]), true);
});

test('pinnedOnArrival agrees with prunableReplays on the same archive', () => {
	const replays = [
		r('a.SC2Replay', '2026-01-01T10:00:00Z', ['t1', 'gone']),
		r('b.SC2Replay', '2026-02-01T10:00:00Z', ['t1']),
		r('c.SC2Replay', '2026-03-01T10:00:00Z', ['t1'])
	];
	const newerThan = (file: string, toon: string) =>
		replays.filter((x) => x.playedAt > replays.find((y) => y.file === file)!.playedAt)
			.filter((x) => x.toons.includes(toon)).length;
	// what the upload path would decide, replay by replay
	const arriving = replays.filter(
		(x) => !pinnedOnArrival(x.toons.map((t) => newerThan(x.file, t)))
	);
	assert.deepEqual(
		arriving.map((x) => x.file),
		prunableReplays(replays)
	);
	assert.deepEqual(prunableReplays(replays), ['b.SC2Replay']);
});
