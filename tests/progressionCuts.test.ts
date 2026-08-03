/**
 * Unit tests for progression-cut detection (npm test).
 *
 * The fixtures are real profiles out of the archive rather than invented
 * numbers, because the two things this has to separate — a save file that was
 * lost, and a pair of replays that merely reached the archive out of order —
 * look alike in the abstract and are told apart only by how far the game
 * counter moved. Using the actual figures keeps the thresholds honest.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	isOrderingInversion,
	progressionCuts,
	restorePins,
	type CutEntry
} from '../src/lib/progressionCuts.ts';

const e = (
	file: string,
	playedAt: string,
	gamesPlayed: number,
	prestige: number,
	xpEn: number,
	xpWo: number,
	xpCo: number
): CutEntry => ({ file, playedAt, gamesPlayed, prestige, xpEn, xpWo, xpCo });

test('a fresh save file is a cut — Kaori, 2,012 games and 4.1M career gone', () => {
	const history = [
		e('20260616-1817.SC2Replay', '2026-06-16T18:17:00Z', 2012, 6, 145682, 162802, 250000),
		e('20260711-1916.SC2Replay', '2026-07-11T19:16:00Z', 3, 0, 6300, 1, 1)
	];
	const cuts = progressionCuts(history);
	assert.equal(cuts.length, 1);
	assert.equal(cuts[0].beforeFile, '20260616-1817.SC2Replay');
	assert.equal(cuts[0].afterFile, '20260711-1916.SC2Replay');
	assert.equal(cuts[0].before, 4158484);
	assert.equal(cuts[0].after, 6302);
	assert.equal(cuts[0].lost, 4152182);
	assert.equal(cuts[0].gamesBefore, 2012);
	assert.equal(cuts[0].gamesAfter, 3);
	// the pin is the bank as it stood before, never the one that replaced it
	assert.deepEqual(restorePins(history), ['20260616-1817.SC2Replay']);
});

test('prestiging is not a cut — the 600,000 it costs is the 600,000 it pays', () => {
	// all three tracks at the 250,000 cap, then reset to 50,000 with a level
	const history = [
		e('a.SC2Replay', '2026-01-01T10:00:00Z', 500, 0, 250000, 250000, 250000),
		e('b.SC2Replay', '2026-01-08T10:00:00Z', 505, 1, 50000, 50000, 50000)
	];
	assert.deepEqual(progressionCuts(history), []);
	assert.deepEqual(restorePins(history), []);
});

test('a prestige that also gained ground is not a cut', () => {
	const history = [
		e('a.SC2Replay', '2026-01-01T10:00:00Z', 500, 0, 250000, 250000, 250000),
		e('b.SC2Replay', '2026-01-08T10:00:00Z', 505, 1, 61200, 50000, 50000)
	];
	assert.deepEqual(progressionCuts(history), []);
});

test('a bank that only holds level is not a cut', () => {
	// an idle game: the counter moves, nothing is earned and nothing is lost
	const history = [
		e('a.SC2Replay', '2026-01-01T10:00:00Z', 500, 0, 100, 200, 300),
		e('b.SC2Replay', '2026-01-02T10:00:00Z', 501, 0, 100, 200, 300)
	];
	assert.deepEqual(progressionCuts(history), []);
});

test('a replay stamped late is an ordering inversion, not a loss', () => {
	// the real 2026-06-27 pair: one recorder sat in the map after their game,
	// so their file was written 36 minutes late and sorts after a game that
	// genuinely came later. The counter proves the true order — 592 before 593.
	const before = e('20260627-1802.SC2Replay', '2026-06-27T18:02:00Z', 593, 0, 250000, 250000, 249161);
	const after = e('20260627-1838.SC2Replay', '2026-06-27T18:38:33Z', 592, 0, 250000, 250000, 245011);
	assert.equal(isOrderingInversion(before, after), true);
	assert.deepEqual(progressionCuts([before, after]), []);
	assert.deepEqual(restorePins([before, after]), []);
});

test('the same inversion a week apart is a real loss', () => {
	// nothing sits in the map for a week; a counter that fell over that span
	// fell because the save changed
	const before = e('a.SC2Replay', '2026-06-27T18:02:00Z', 593, 0, 250000, 250000, 249161);
	const after = e('b.SC2Replay', '2026-07-04T18:38:33Z', 592, 0, 250000, 250000, 245011);
	assert.equal(isOrderingInversion(before, after), false);
	assert.equal(progressionCuts([before, after]).length, 1);
});

test('the counter stepping back more than three is a loss even within the hour', () => {
	const before = e('a.SC2Replay', '2026-06-27T18:02:00Z', 600, 0, 250000, 250000, 249161);
	const after = e('b.SC2Replay', '2026-06-27T18:38:00Z', 596, 0, 250000, 250000, 245011);
	assert.equal(isOrderingInversion(before, after), false);
	assert.equal(progressionCuts([before, after]).length, 1);
});

test('a large loss is a cut whatever the counter did', () => {
	// the safety valve: one game back, minutes apart — everything the inversion
	// rule looks for — but no single game pays a prestige level and 100,000 on
	// top, so the size of the loss overrules the shape of the counter step
	const before = e('a.SC2Replay', '2026-06-27T18:02:00Z', 600, 1, 250000, 250000, 250000);
	const after = e('b.SC2Replay', '2026-06-27T18:38:00Z', 599, 0, 250000, 250000, 150000);
	assert.equal(isOrderingInversion(before, after), false);
	assert.equal(progressionCuts([before, after])[0].lost, 700000);
});

test('XP can be lost while the game counter climbs — Yossarian', () => {
	// 340 games and 91 wins intact, all three XP tracks at zero: the map reads
	// XP only when nbe/nbw/nbc exist, so a bank that verifies without them
	// loads with the counters and nothing else
	const history = [
		e('20260613-1247.SC2Replay', '2026-06-13T11:48:49Z', 10, 0, 24993, 2830, 1),
		e('20260717-1929-503496591.SC2Replay', '2026-07-17T19:29:05Z', 340, 0, 0, 0, 0)
	];
	const cuts = progressionCuts(history);
	assert.equal(cuts.length, 1);
	assert.equal(cuts[0].lost, 27824);
	// the counter went forward, so this can never be mistaken for an inversion
	assert.equal(cuts[0].gamesAfter > cuts[0].gamesBefore, true);
	assert.deepEqual(restorePins(history), ['20260613-1247.SC2Replay']);
});

test('one maxed track zeroed while the counter climbs — hsdk, 2021', () => {
	const history = [
		e('a.SC2Replay', '2021-08-15T16:29:18Z', 2090, 0, 250000, 250000, 250000),
		e('b.SC2Replay', '2021-09-04T16:45:18Z', 2096, 0, 250000, 250000, 0)
	];
	assert.equal(progressionCuts(history)[0].lost, 250000);
});

test('a partial rollback is a cut — Anja kept most of her progress', () => {
	const history = [
		e('a.SC2Replay', '2023-06-12T18:21:00Z', 740, 1, 250000, 250000, 81218),
		e('b.SC2Replay', '2025-02-11T18:18:00Z', 642, 1, 163205, 250000, 50000)
	];
	const cuts = progressionCuts(history);
	assert.equal(cuts.length, 1);
	assert.equal(cuts[0].lost, 118013);
});

test('every cut gets its own pin — a profile wiped more than once', () => {
	// darknubs: reset in 2021, recovered, reset again in 2025
	const history = [
		e('a.SC2Replay', '2021-06-14T16:42:00Z', 125, 0, 157148, 43944, 28238),
		e('b.SC2Replay', '2021-08-06T19:28:00Z', 8, 0, 7913, 5533, 1),
		e('c.SC2Replay', '2025-04-26T20:40:00Z', 275, 0, 201957, 195958, 167656),
		e('d.SC2Replay', '2025-09-22T17:48:00Z', 1, 0, 5084, 0, 0)
	];
	const cuts = progressionCuts(history);
	assert.equal(cuts.length, 2);
	assert.deepEqual(restorePins(history), ['a.SC2Replay', 'c.SC2Replay']);
});

test('one replay sitting before two cuts is pinned once', () => {
	// possible when the game between them was never uploaded: b and c both
	// follow a downwards, and a is the only bank either could restore from
	const history = [
		e('a.SC2Replay', '2026-01-01T10:00:00Z', 500, 0, 200000, 200000, 200000),
		e('a.SC2Replay', '2026-02-01T10:00:00Z', 400, 0, 100000, 100000, 100000),
		e('a.SC2Replay', '2026-03-01T10:00:00Z', 300, 0, 50000, 50000, 50000)
	];
	assert.equal(progressionCuts(history).length, 2);
	assert.deepEqual(restorePins(history), ['a.SC2Replay']);
});

test('pins come out oldest first and are stable across repeated runs', () => {
	const history = [
		e('a.SC2Replay', '2021-06-14T16:42:00Z', 125, 0, 157148, 43944, 28238),
		e('b.SC2Replay', '2021-08-06T19:28:00Z', 8, 0, 7913, 5533, 1),
		e('c.SC2Replay', '2025-04-26T20:40:00Z', 275, 0, 201957, 195958, 167656),
		e('d.SC2Replay', '2025-09-22T17:48:00Z', 1, 0, 5084, 0, 0)
	];
	assert.deepEqual(restorePins(history), restorePins(history));
	assert.deepEqual(restorePins(history), ['a.SC2Replay', 'c.SC2Replay']);
});

test('a history too short to compare yields nothing', () => {
	assert.deepEqual(progressionCuts([]), []);
	assert.deepEqual(restorePins([]), []);
	const one = [e('a.SC2Replay', '2026-01-01T10:00:00Z', 500, 3, 1, 2, 3)];
	// a first sighting is never a cut — there is nothing behind it to have lost
	assert.deepEqual(progressionCuts(one), []);
	assert.deepEqual(restorePins(one), []);
});

test('a profile that only ever climbed yields nothing', () => {
	const history = [
		e('a.SC2Replay', '2026-01-01T10:00:00Z', 10, 0, 1000, 0, 0),
		e('b.SC2Replay', '2026-01-02T10:00:00Z', 20, 0, 5000, 100, 0),
		e('c.SC2Replay', '2026-01-03T10:00:00Z', 30, 0, 9000, 500, 250),
		e('d.SC2Replay', '2026-01-04T10:00:00Z', 40, 1, 50000, 50000, 50000)
	];
	assert.deepEqual(progressionCuts(history), []);
	assert.deepEqual(restorePins(history), []);
});
