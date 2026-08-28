/** Unit tests for clan aggregation over player profiles (npm test). */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildClans, searchClans, sortClans, type ClanMember } from '../src/lib/clans.ts';

const member = (over: Partial<ClanMember>): ClanMember => ({
	name: 'Player',
	clan: '',
	toon: 't0',
	xpEn: 0,
	xpWo: 0,
	xpCo: 0,
	prestige: 0,
	gamesPlayed: 0,
	revives: 0,
	avgGameTime: 0,
	winsByMode: [],
	lastSeen: '2026-01-01T00:00:00Z',
	...over
});

test('groups by tag, sums stats, picks top member and newest lastSeen', () => {
	const clans = buildClans([
		member({
			name: 'Alice',
			clan: 'UAR',
			toon: 't1',
			xpEn: 100,
			prestige: 1,
			gamesPlayed: 10,
			revives: 3,
			winsByMode: [2, 1],
			lastSeen: '2026-07-01T10:00:00Z'
		}),
		member({
			name: 'Bob',
			clan: 'UAR',
			toon: 't2',
			xpEn: 200,
			gamesPlayed: 5,
			revives: 1,
			winsByMode: [4],
			lastSeen: '2026-07-10T10:00:00Z'
		}),
		member({ name: 'Carol', clan: 'ZED', toon: 't3', xpEn: 50, lastSeen: '2026-06-01T00:00:00Z' }),
		member({ name: 'NoClan', toon: 't4', xpEn: 999999 })
	]);

	assert.deepEqual(clans, [
		{
			tag: 'UAR',
			members: 2,
			careerXp: 600300, // Alice 600100 (prestige) + Bob 200
			games: 15,
			wins: 7,
			revives: 4,
			top: { name: 'Alice', toon: 't1' },
			lastSeen: '2026-07-10T10:00:00Z'
		},
		{
			tag: 'ZED',
			members: 1,
			careerXp: 50,
			games: 0,
			wins: 0,
			revives: 0,
			top: { name: 'Carol', toon: 't3' },
			lastSeen: '2026-06-01T00:00:00Z'
		}
	]);
});

test('orders clans by summed career XP', () => {
	const clans = buildClans([
		member({ clan: 'SMALL', toon: 't1', xpEn: 100 }),
		member({ clan: 'BIG', toon: 't2', xpEn: 60 }),
		member({ clan: 'BIG', toon: 't3', xpEn: 60 })
	]);
	assert.deepEqual(
		clans.map((c) => c.tag),
		['BIG', 'SMALL']
	);
});

test('no clanned players yields an empty list', () => {
	assert.deepEqual(buildClans([member({ toon: 't1' })]), []);
});

const three = buildClans([
	member({ name: 'Zoe', clan: 'ab', toon: 't1', xpEn: 300, gamesPlayed: 1 }),
	member({ name: 'Yann', clan: 'AC', toon: 't2', xpEn: 200, gamesPlayed: 9 }),
	member({ name: 'Xav', clan: 'B', toon: 't3', xpEn: 100, gamesPlayed: 9 })
]);

test('sortClans: numbers by value, text case-insensitively, either way round', () => {
	assert.deepEqual(
		sortClans(three, 'games', 1).map((c) => c.tag),
		['ab', 'AC', 'B'] // 9 and 9 tie: career XP decides, AC above B
	);
	assert.deepEqual(
		sortClans(three, 'tag', 1).map((c) => c.tag),
		['ab', 'AC', 'B']
	);
	assert.deepEqual(
		sortClans(three, 'top', -1).map((c) => c.top.name),
		['Zoe', 'Yann', 'Xav']
	);
	// a copy: the input keeps its own order
	assert.deepEqual(
		three.map((c) => c.tag),
		['ab', 'AC', 'B']
	);
});

test('searchClans: matches tag or top player, ignores case and blank queries', () => {
	assert.equal(searchClans(three, '  '), three);
	assert.deepEqual(
		searchClans(three, 'a').map((c) => c.tag),
		['ab', 'AC', 'B'] // B via its top player, Xav
	);
	assert.deepEqual(
		searchClans(three, 'YANN').map((c) => c.tag),
		['AC']
	);
	assert.deepEqual(searchClans(three, 'nobody'), []);
});
