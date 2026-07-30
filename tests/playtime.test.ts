/** Unit tests for the per-MOS playtime leaderboard aggregation (npm test). */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { topPlayersByMos, type PlaytimeReplay } from '../src/lib/server/playtime.ts';

const sighting = (toon: string, name: string, mos: string[], clan = '') => ({
	toon,
	name,
	clan,
	mos
});

test('sums recorded seconds per player per class', () => {
	const replays: PlaytimeReplay[] = [
		{
			playedAt: '2026-07-01T10:00:00Z',
			durationLoops: 16 * 600, // 10 min
			sightings: [sighting('t1', 'Alice', ['Medic']), sighting('t2', 'Bob', ['Medic'])]
		},
		{
			playedAt: '2026-07-02T10:00:00Z',
			durationLoops: 16 * 1200, // 20 min
			sightings: [sighting('t1', 'Alice', ['Medic', 'Recon'])]
		}
	];
	const top = topPlayersByMos(replays);
	assert.deepEqual(top['Medic'], [
		{ name: 'Alice', clan: '', toon: 't1', games: 2, seconds: 1800 },
		{ name: 'Bob', clan: '', toon: 't2', games: 1, seconds: 600 }
	]);
	// a multi-class sighting credits the full game to each class
	assert.deepEqual(top['Recon'], [{ name: 'Alice', clan: '', toon: 't1', games: 1, seconds: 1200 }]);
});

test('newest sighting wins for name/clan, regardless of input order', () => {
	const replays: PlaytimeReplay[] = [
		{
			playedAt: '2026-07-05T10:00:00Z',
			durationLoops: 160,
			sightings: [sighting('t1', 'AliceRenamed', ['Medic'], 'NEW')]
		},
		{
			playedAt: '2026-07-01T10:00:00Z',
			durationLoops: 160,
			sightings: [sighting('t1', 'Alice', ['Medic'], 'OLD')]
		}
	];
	const [p] = topPlayersByMos(replays)['Medic'];
	assert.equal(p.name, 'AliceRenamed');
	assert.equal(p.clan, 'NEW');
	assert.equal(p.games, 2);
});

test('falls back to name as key when toon is empty, applies limit, skips empty mos', () => {
	const replays: PlaytimeReplay[] = [
		{
			playedAt: '2026-07-01T10:00:00Z',
			durationLoops: 160,
			sightings: [
				sighting('', 'NoToon', ['Medic']),
				sighting('t9', 'Spectator', []),
				...Array.from({ length: 12 }, (_, i) => sighting(`t${i}`, `P${i}`, ['Medic']))
			]
		},
		{
			playedAt: '2026-07-02T10:00:00Z',
			durationLoops: 320,
			sightings: [sighting('', 'NoToon', ['Medic'])]
		}
	];
	const top = topPlayersByMos(replays)['Medic'];
	assert.equal(top.length, 10);
	assert.deepEqual(top[0], { name: 'NoToon', clan: '', toon: '', games: 2, seconds: 30 });
	assert.equal(Object.keys(topPlayersByMos(replays)).length, 1);
});

test('missing durationLoops counts the game with zero time', () => {
	const replays: PlaytimeReplay[] = [
		{ playedAt: '2026-07-01T10:00:00Z', sightings: [sighting('t1', 'Alice', ['Medic'])] }
	];
	assert.deepEqual(topPlayersByMos(replays)['Medic'], [
		{ name: 'Alice', clan: '', toon: 't1', games: 1, seconds: 0 }
	]);
});

test('credits the game, not a recording left running after it ended', () => {
	// the archive's idled recording: 9:06:08 recorded, 1:18:46 of game
	const replays: PlaytimeReplay[] = [
		{
			playedAt: '2026-07-30T04:43:07Z',
			durationLoops: 16 * 32768,
			gameLoops: 16 * 4726,
			sightings: [sighting('t1', 'Alice', ['Medic'])]
		}
	];
	assert.deepEqual(topPlayersByMos(replays)['Medic'], [
		{ name: 'Alice', clan: '', toon: 't1', games: 1, seconds: 4726 }
	]);
});
