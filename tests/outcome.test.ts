/**
 * Win/loss derivation (node:test, `npm test`).
 *
 * The interesting cases are all about what the save-file win counter can and
 * cannot say: it is snapshot at game start, so a game's result only shows up
 * in its players' *next* sighting, and only when that next sighting is
 * exactly one game later.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replayOutcomes, outcomeChanges, fmtDuration, type OutcomeReplay } from '../src/lib/outcome.ts';

function game(
	file: string,
	playedAt: string,
	sightings: { toon: string; wins: number; gamesPlayed: number }[],
	outcome?: 'win' | 'loss' | null
): OutcomeReplay {
	return { file, playedAt, sightings, ...(outcome !== undefined ? { outcome } : {}) };
}

test('win counter moved between two consecutive games -> win', () => {
	const out = replayOutcomes([
		game('a', '2026-01-01T00:00:00Z', [{ toon: 't1', wins: 4, gamesPlayed: 10 }]),
		game('b', '2026-01-02T00:00:00Z', [{ toon: 't1', wins: 5, gamesPlayed: 11 }])
	]);
	assert.equal(out.a, 'win');
	// b is the newest game for t1 — nothing has settled it yet
	assert.equal(out.b, undefined);
});

test('counter unchanged -> loss', () => {
	const out = replayOutcomes([
		game('a', '2026-01-01T00:00:00Z', [{ toon: 't1', wins: 4, gamesPlayed: 10 }]),
		game('b', '2026-01-02T00:00:00Z', [{ toon: 't1', wins: 4, gamesPlayed: 11 }])
	]);
	assert.equal(out.a, 'loss');
});

test('one player winning outvotes teammates who gained nothing', () => {
	// a leaver, or a player who took no round in a round-based mode, gains no
	// win from a game the squad completed
	const out = replayOutcomes([
		game('a', '2026-01-01T00:00:00Z', [
			{ toon: 'winner', wins: 4, gamesPlayed: 10 },
			{ toon: 'leaver', wins: 9, gamesPlayed: 20 }
		]),
		game('b', '2026-01-02T00:00:00Z', [
			{ toon: 'winner', wins: 5, gamesPlayed: 11 },
			{ toon: 'leaver', wins: 9, gamesPlayed: 21 }
		])
	]);
	assert.equal(out.a, 'win');
});

test('a gap in the archive settles nothing', () => {
	// the player got through three games between the two we hold, so the
	// counters cannot be pinned on the earlier one
	const out = replayOutcomes([
		game('a', '2026-01-01T00:00:00Z', [{ toon: 't1', wins: 4, gamesPlayed: 10 }]),
		game('b', '2026-01-05T00:00:00Z', [{ toon: 't1', wins: 6, gamesPlayed: 13 }])
	]);
	assert.equal(out.a, undefined);
});

test('a reset save file settles nothing (negative delta)', () => {
	const out = replayOutcomes([
		game('a', '2026-01-01T00:00:00Z', [{ toon: 't1', wins: 40, gamesPlayed: 100 }]),
		game('b', '2026-01-02T00:00:00Z', [{ toon: 't1', wins: 0, gamesPlayed: 1 }])
	]);
	assert.equal(out.a, undefined);
});

test('the parser verdict covers a game no follow-up has reached yet', () => {
	const out = replayOutcomes([
		game('a', '2026-01-01T00:00:00Z', [{ toon: 't1', wins: 4, gamesPlayed: 10 }], 'win'),
		game('b', '2026-01-02T00:00:00Z', [{ toon: 't2', wins: 1, gamesPlayed: 2 }], 'loss')
	]);
	assert.equal(out.a, 'win');
	assert.equal(out.b, 'loss');
});

test('a win read from the replay beats teammates who gained no counter', () => {
	// the recording saw the ending cinematic; the only player with a
	// follow-up sighting happens to have gained nothing
	const out = replayOutcomes([
		game('a', '2026-01-01T00:00:00Z', [{ toon: 't1', wins: 4, gamesPlayed: 10 }], 'win'),
		game('b', '2026-01-02T00:00:00Z', [{ toon: 't1', wins: 4, gamesPlayed: 11 }])
	]);
	assert.equal(out.a, 'win');
});

test('sightings are ordered by game time, not by input order', () => {
	const out = replayOutcomes([
		game('b', '2026-01-02T00:00:00Z', [{ toon: 't1', wins: 5, gamesPlayed: 11 }]),
		game('a', '2026-01-01T00:00:00Z', [{ toon: 't1', wins: 4, gamesPlayed: 10 }])
	]);
	assert.equal(out.a, 'win');
});

test('players with no toon handle are skipped', () => {
	const out = replayOutcomes([
		game('a', '2026-01-01T00:00:00Z', [{ toon: '', wins: 4, gamesPlayed: 10 }]),
		game('b', '2026-01-02T00:00:00Z', [{ toon: '', wins: 5, gamesPlayed: 11 }])
	]);
	assert.deepEqual(out, {});
});

// outcomeChanges is what a rebuild actually writes: settling a result needs
// every stored game's counters, which is far too much to read on a page view,
// so the verdict is written onto the replay doc once per upload instead.

test('outcomeChanges: an unsettled archive yields the verdicts to write', () => {
	assert.deepEqual(
		outcomeChanges([
			game('a', '2026-01-01T00:00:00Z', [{ toon: 't1', wins: 4, gamesPlayed: 10 }]),
			game('b', '2026-01-02T00:00:00Z', [{ toon: 't1', wins: 5, gamesPlayed: 11 }])
		]),
		[{ file: 'a', outcome: 'win' }]
	);
});

test('outcomeChanges: re-running over already-settled docs writes nothing', () => {
	const settled = [
		{ ...game('a', '2026-01-01T00:00:00Z', [{ toon: 't1', wins: 4, gamesPlayed: 10 }]), settledOutcome: 'win' as const },
		game('b', '2026-01-02T00:00:00Z', [{ toon: 't1', wins: 5, gamesPlayed: 11 }])
	];
	assert.deepEqual(outcomeChanges(settled), []);
});

test('outcomeChanges: a new game settles only the game before it', () => {
	// 'a' is already written down; 'c' arriving settles 'b' (its counter did
	// not move, so a loss) and leaves every older verdict alone
	assert.deepEqual(
		outcomeChanges([
			{ ...game('a', '2026-01-01T00:00:00Z', [{ toon: 't1', wins: 4, gamesPlayed: 10 }]), settledOutcome: 'win' as const },
			game('b', '2026-01-02T00:00:00Z', [{ toon: 't1', wins: 5, gamesPlayed: 11 }]),
			game('c', '2026-01-03T00:00:00Z', [{ toon: 't1', wins: 5, gamesPlayed: 12 }])
		]),
		[{ file: 'b', outcome: 'loss' }]
	);
});

test('outcomeChanges: a verdict that no longer holds is dropped, not left behind', () => {
	// the follow-up game is gone (a replay replaced by a longer recording of
	// the same lobby), so nothing settles 'a' any more
	assert.deepEqual(
		outcomeChanges([
			{ ...game('a', '2026-01-01T00:00:00Z', [{ toon: 't1', wins: 4, gamesPlayed: 10 }]), settledOutcome: 'win' as const }
		]),
		[{ file: 'a' }]
	);
});

test('fmtDuration: 16 game loops per second, hours only when needed', () => {
	assert.equal(fmtDuration(0), '0:00');
	assert.equal(fmtDuration(496), '0:31'); // the 20260723-1802 fixture
	assert.equal(fmtDuration(21317), '22:12');
	assert.equal(fmtDuration(99031), '1:43:09');
});
