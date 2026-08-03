/** Unit tests for the map's ban list and the boards that drop it (npm test). */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BANNED, BANNED_TOONS, BAN_EFFECT, banKind, isBanned } from '../src/lib/banned.ts';
import { topPlayersByMos } from '../src/lib/server/playtime.ts';
import { topTeammates } from '../src/lib/server/teammates.ts';
import { weeklyBoards } from '../src/lib/server/weekly.ts';

/** One of the map's nine, and one handle that is not. */
const BANNED_XP = '2-S2-1-4182775'; // ALEX — gf_ResetXPPlayer
const BANNED_PRESTIGE = '2-S2-1-9442053'; // HotGirl — gf_ResetPrestigePlayer
const CLEAN = '2-S2-1-1752276';

test('the list is the nine handles gf_Banned() names, with what each loses', () => {
	assert.equal(BANNED_TOONS.length, 9);
	assert.equal(Object.values(BANNED).filter((k) => k === 'xp').length, 7);
	assert.equal(Object.values(BANNED).filter((k) => k === 'prestige').length, 2);
	assert.equal(banKind(BANNED_XP), 'xp');
	assert.equal(banKind(BANNED_PRESTIGE), 'prestige');
	assert.equal(banKind(CLEAN), null);
	assert.ok(isBanned(BANNED_XP) && !isBanned(CLEAN));
	// every kind has the clause a profile prints for it
	for (const kind of Object.values(BANNED)) assert.ok(BAN_EFFECT[kind].length > 0);
});

const game = (toons: string[], playedAt: string, mos = 'Sniper2') => ({
	playedAt,
	gameLoops: 16 * 600, // ten minutes
	sightings: toons.map((t) => ({ toon: t, name: `n:${t}`, clan: '', mos: [mos] }))
});

test('per-class playtime board leaves banned handles off', () => {
	const boards = topPlayersByMos([
		game([BANNED_XP, CLEAN], '2026-01-01T00:00:00Z'),
		game([BANNED_XP, CLEAN], '2026-01-02T00:00:00Z')
	]);
	assert.deepEqual(
		boards.Sniper2.map((r) => r.toon),
		[CLEAN]
	);
});

test('a banned handle is dropped from other players’ teammate lists, not their own', () => {
	const games = [game([BANNED_XP, CLEAN, 't3'], '2026-01-01T00:00:00Z')];
	assert.deepEqual(
		topTeammates(games, CLEAN).map((m) => m.toon),
		['t3']
	);
	// their own profile still shows who they played with
	assert.deepEqual(
		topTeammates(games, BANNED_XP)
			.map((m) => m.toon)
			.sort(),
		[CLEAN, 't3']
	);
});

const wk = (toon: string, playedAt: string, prestige: number, xp: number) => ({
	playedAt,
	sightings: [
		{
			toon,
			name: `n:${toon}`,
			clan: '',
			xpEn: xp,
			xpWo: 0,
			xpCo: 0,
			prestige,
			gamesPlayed: 10,
			mos: ['Sniper2']
		}
	]
});

test('weekly XP and prestige boards drop banned handles but still count their class picks', () => {
	const now = new Date('2026-01-05T00:00:00Z');
	const boards = weeklyBoards(
		[
			wk(BANNED_PRESTIGE, '2026-01-01T00:00:00Z', 40, 0),
			wk(BANNED_PRESTIGE, '2026-01-02T00:00:00Z', 41, 5000),
			wk(CLEAN, '2026-01-01T00:00:00Z', 1, 0),
			wk(CLEAN, '2026-01-02T00:00:00Z', 1, 900)
		],
		now
	);
	assert.deepEqual(
		boards.xp.map((r) => r.toon),
		[CLEAN]
	);
	assert.deepEqual(boards.prestiged, []);
	// four sightings played the class, and the count says four
	assert.deepEqual(boards.classPicks, [{ mos: 'Sniper2', picks: 4 }]);
});
