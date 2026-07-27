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
import { replayOutcomes, fmtDuration, type OutcomeReplay } from '../src/lib/outcome.ts';

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

test('fmtDuration: 16 game loops per second, hours only when needed', () => {
	assert.equal(fmtDuration(0), '0:00');
	assert.equal(fmtDuration(496), '0:31'); // the 20260723-1802 fixture
	assert.equal(fmtDuration(21317), '22:12');
	assert.equal(fmtDuration(99031), '1:43:09');
});
