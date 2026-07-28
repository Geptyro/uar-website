/**
 * Game-mode derivation (node:test, `npm test`).
 *
 * Two things under test, for the two sources lib/mode.ts reads: the map's own
 * vote count as re-run over the clicks a replay records, and the per-mode win
 * counters, which move only on a win and only one game later.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	tallyModeVotes,
	replayModes,
	counterModes,
	modeChanges,
	type ModeReplay,
	type ModeVoter
} from '../src/lib/mode.ts';

/** A voter with enough career XP for anything but Apocalypse. */
function v(mode: number, over: Partial<ModeVoter> = {}): ModeVoter {
	return { clicks: [mode], xp: 100000, prestige: 0, ...over };
}

test('an outright majority takes the mode', () => {
	// six of ten is more than half; the map needs strictly more
	const votes = [...Array(6).fill(v(5)), v(3), v(4), v(2), v(8)];
	assert.equal(tallyModeVotes(votes, 10), 5);
});

test('exactly half is not a majority — it falls to the average', () => {
	// 5 × Nightmare and 5 × Recruit average to 300, which is the Hard band
	const votes = [...Array(5).fill(v(5)), ...Array(5).fill(v(1))];
	assert.equal(tallyModeVotes(votes, 10), 3);
});

test('no majority: the regular votes average into a difficulty band', () => {
	// the real 2026-07-23 game: 2 Insane, 3 Nightmare, 1 Hard, 1 Recruit and
	// 1 Invasion — 2700 points over 7 regular voters is 385, so Insane
	const votes = [v(4), v(4), v(5), v(5), v(5), v(3), v(1), v(9)];
	assert.equal(tallyModeVotes(votes, 8), 4);
});

test('a lone player gets what they clicked', () => {
	assert.equal(tallyModeVotes([v(7)], 1), 7);
});

test('nobody voted -> Normal', () => {
	assert.equal(tallyModeVotes([], 6), 2);
});

test('a special mode wins outright when the regulars are outnumbered', () => {
	// 3 Survival against 1 Hard: fewer than half the votes are regular, so the
	// map takes the most-voted special mode
	const votes = [v(7), v(7), v(7), v(3)];
	assert.equal(tallyModeVotes(votes, 4), 7);
});

test('tied special modes are a coin toss the replay cannot undo', () => {
	const votes = [v(7), v(7), v(8), v(8)];
	assert.equal(tallyModeVotes(votes, 4), null);
});

test('the map refuses votes the voter has not unlocked', () => {
	// Insane needs 40k career XP, so the two under-XP clicks never happened
	// and the one Recruit vote is the whole lobby's ballot
	const votes = [v(4, { xp: 1000 }), v(4, { xp: 39999 }), v(1, { xp: 500 })];
	assert.equal(tallyModeVotes(votes, 3), 1);
});

test('a refused click does not spend the vote — the next one counts', () => {
	// the map returns without recording, leaving the buttons live, so someone
	// who reaches for Nightmare and is turned away still votes with their
	// second click. Counting only the first would read this lobby as
	// Nightmare when the map ran it on Normal.
	const reachedTooHigh = { clicks: [5, 2], xp: 1000, prestige: 0 };
	assert.equal(tallyModeVotes([reachedTooHigh], 1), 2);
	// and with the XP for it, the first click stands
	assert.equal(tallyModeVotes([{ ...reachedTooHigh, xp: 100000 }], 1), 5);
});

test('a voter refused every time counts as not having voted', () => {
	assert.equal(tallyModeVotes([{ clicks: [5, 4, 3], xp: 0, prestige: 0 }], 1), 2);
});

test('prestige unlocks Apocalypse without the XP', () => {
	assert.equal(tallyModeVotes([v(12, { xp: 0, prestige: 1 })], 1), 12);
	// and without either, the click is refused and the default stands
	assert.equal(tallyModeVotes([v(12, { xp: 0, prestige: 0 })], 1), 2);
});

test('Competitive needs four players', () => {
	assert.equal(tallyModeVotes([v(6), v(6), v(6)], 3), 2);
	assert.equal(tallyModeVotes([v(6), v(6), v(6), v(6)], 4), 6);
});

function game(
	file: string,
	playedAt: string,
	sightings: { toon: string; winsByMode: number[]; gamesPlayed: number }[],
	mode?: number | null
): ModeReplay {
	return { file, playedAt, sightings, ...(mode !== undefined ? { mode } : {}) };
}

/** wins on mode `m` (1-based), zero everywhere else. */
function wins(m: number, n: number): number[] {
	const a = Array(12).fill(0);
	a[m - 1] = n;
	return a;
}

test('the win counter that moved names the mode of the game before it', () => {
	const out = replayModes([
		game('a', '2026-01-01T00:00:00Z', [{ toon: 't1', winsByMode: wins(5, 3), gamesPlayed: 10 }]),
		game('b', '2026-01-02T00:00:00Z', [{ toon: 't1', winsByMode: wins(5, 4), gamesPlayed: 11 }])
	]);
	assert.equal(out.a, 5);
	// b is the newest game for t1 — nothing has settled it yet
	assert.equal(out.b, undefined);
});

test('a lost game moves no counter, so it stays unsettled', () => {
	const out = replayModes([
		game('a', '2026-01-01T00:00:00Z', [{ toon: 't1', winsByMode: wins(5, 3), gamesPlayed: 10 }]),
		game('b', '2026-01-02T00:00:00Z', [{ toon: 't1', winsByMode: wins(5, 3), gamesPlayed: 11 }])
	]);
	assert.equal(out.a, undefined);
});

test('the parser fills in what the counters cannot', () => {
	const out = replayModes([
		game('a', '2026-01-01T00:00:00Z', [{ toon: 't1', winsByMode: wins(5, 3), gamesPlayed: 10 }], 9),
		game('b', '2026-01-02T00:00:00Z', [{ toon: 't1', winsByMode: wins(5, 3), gamesPlayed: 11 }], 9)
	]);
	assert.equal(out.a, 9);
	assert.equal(out.b, 9);
});

test('corroborated counters overrule the vote', () => {
	// two players of the same game moved the same counter: they finished it
	// together, and that is the map's own bookkeeping
	const out = replayModes([
		game('a', '2026-01-01T00:00:00Z', [
			{ toon: 't1', winsByMode: wins(5, 3), gamesPlayed: 10 },
			{ toon: 't2', winsByMode: wins(5, 1), gamesPlayed: 20 }
		], 4),
		game('b', '2026-01-02T00:00:00Z', [
			{ toon: 't1', winsByMode: wins(5, 4), gamesPlayed: 11 },
			{ toon: 't2', winsByMode: wins(5, 2), gamesPlayed: 21 }
		])
	]);
	assert.equal(out.a, 5);
});

test('a lone counter reading does not overrule the vote', () => {
	// the leaver case: this player gained nothing from game a because they
	// left it, played something else, and won that instead — their delta
	// names the wrong game, and a whole lobby's ballot outranks it
	const out = replayModes([
		game('a', '2026-01-01T00:00:00Z', [
			{ toon: 't1', winsByMode: wins(5, 3), gamesPlayed: 10 },
			{ toon: 't2', winsByMode: wins(5, 1), gamesPlayed: 20 }
		], 3),
		game('b', '2026-01-02T00:00:00Z', [
			{ toon: 't1', winsByMode: wins(5, 4), gamesPlayed: 11 },
			{ toon: 't2', winsByMode: wins(5, 1), gamesPlayed: 20 }
		])
	]);
	assert.equal(out.a, 3);
});

test('a lone counter reading still stands when there is no vote to prefer', () => {
	const out = replayModes([
		game('a', '2026-01-01T00:00:00Z', [{ toon: 't1', winsByMode: wins(5, 3), gamesPlayed: 10 }]),
		game('b', '2026-01-02T00:00:00Z', [{ toon: 't1', winsByMode: wins(5, 4), gamesPlayed: 11 }])
	]);
	assert.equal(out.a, 5);
});

test('counterModes reports how many players back a reading', () => {
	const out = counterModes([
		game('a', '2026-01-01T00:00:00Z', [
			{ toon: 't1', winsByMode: wins(8, 0), gamesPlayed: 10 },
			{ toon: 't2', winsByMode: wins(8, 4), gamesPlayed: 20 },
			{ toon: 't3', winsByMode: wins(2, 9), gamesPlayed: 30 }
		]),
		game('b', '2026-01-02T00:00:00Z', [
			{ toon: 't1', winsByMode: wins(8, 1), gamesPlayed: 11 },
			{ toon: 't2', winsByMode: wins(8, 5), gamesPlayed: 21 },
			{ toon: 't3', winsByMode: wins(2, 9), gamesPlayed: 31 }
		])
	]);
	// t3 gained nothing (left, or took no round) — support counts agreement,
	// not headcount
	assert.deepEqual(out.a, { mode: 8, support: 2 });
});

test('a gap in the games says nothing about any one of them', () => {
	const out = replayModes([
		game('a', '2026-01-01T00:00:00Z', [{ toon: 't1', winsByMode: wins(5, 3), gamesPlayed: 10 }]),
		game('b', '2026-01-05T00:00:00Z', [{ toon: 't1', winsByMode: wins(5, 6), gamesPlayed: 14 }])
	]);
	assert.equal(out.a, undefined);
});

test('two counters moving at once is a reset, not a game', () => {
	const both = Array(12).fill(0);
	both[3] = 1;
	both[4] = 1;
	const out = replayModes([
		game('a', '2026-01-01T00:00:00Z', [{ toon: 't1', winsByMode: Array(12).fill(0), gamesPlayed: 10 }]),
		game('b', '2026-01-02T00:00:00Z', [{ toon: 't1', winsByMode: both, gamesPlayed: 11 }])
	]);
	assert.equal(out.a, undefined);
});

test('a teammate who gained nothing does not outvote one who did', () => {
	// only players still in at the end are credited a win, so one mover is
	// the whole answer
	const out = replayModes([
		game('a', '2026-01-01T00:00:00Z', [
			{ toon: 't1', winsByMode: wins(8, 1), gamesPlayed: 10 },
			{ toon: 't2', winsByMode: wins(8, 7), gamesPlayed: 30 }
		]),
		game('b', '2026-01-02T00:00:00Z', [
			{ toon: 't1', winsByMode: wins(8, 1), gamesPlayed: 11 },
			{ toon: 't2', winsByMode: wins(8, 8), gamesPlayed: 31 }
		])
	]);
	assert.equal(out.a, 8);
});

test('modeChanges writes only what moved, and clears what no longer holds', () => {
	const games = [
		game('a', '2026-01-01T00:00:00Z', [{ toon: 't1', winsByMode: wins(5, 3), gamesPlayed: 10 }]),
		game('b', '2026-01-02T00:00:00Z', [{ toon: 't1', winsByMode: wins(5, 4), gamesPlayed: 11 }])
	];
	assert.deepEqual(modeChanges(games), [{ file: 'a', mode: 5 }]);
	// idempotent once stored
	assert.deepEqual(
		modeChanges([{ ...games[0], settledMode: 5 }, games[1]]),
		[]
	);
	// and a stored mode the counters no longer support is dropped
	assert.deepEqual(
		modeChanges([{ ...games[1], settledMode: 3 }]),
		[{ file: 'b' }]
	);
});
