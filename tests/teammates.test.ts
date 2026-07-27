/** Unit tests for the profile "played with" aggregation (npm test). */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { topTeammates, type TeammateReplay } from '../src/lib/server/teammates.ts';

const sighting = (toon: string, name: string, clan = '') => ({ toon, name, clan });

test('sums shared recorded seconds per teammate, excluding the player', () => {
	const replays: TeammateReplay[] = [
		{
			playedAt: '2026-07-01T10:00:00Z',
			durationLoops: 16 * 600, // 10 min
			sightings: [sighting('t1', 'Alice'), sighting('t2', 'Bob'), sighting('t3', 'Cara')]
		},
		{
			playedAt: '2026-07-02T10:00:00Z',
			durationLoops: 16 * 1200, // 20 min
			sightings: [sighting('t1', 'Alice'), sighting('t2', 'Bob')]
		},
		// a game Alice was not in must not count for anyone
		{
			playedAt: '2026-07-03T10:00:00Z',
			durationLoops: 16 * 3000,
			sightings: [sighting('t2', 'Bob'), sighting('t3', 'Cara')]
		}
	];
	assert.deepEqual(topTeammates(replays, 't1'), [
		{ name: 'Bob', clan: '', toon: 't2', games: 2, seconds: 1800 },
		{ name: 'Cara', clan: '', toon: 't3', games: 1, seconds: 600 }
	]);
});

test('newest sighting wins for name/clan, regardless of input order', () => {
	const replays: TeammateReplay[] = [
		{
			playedAt: '2026-07-05T10:00:00Z',
			durationLoops: 160,
			sightings: [sighting('t1', 'Alice'), sighting('t2', 'BobRenamed', 'NEW')]
		},
		{
			playedAt: '2026-07-01T10:00:00Z',
			durationLoops: 160,
			sightings: [sighting('t1', 'Alice'), sighting('t2', 'Bob', 'OLD')]
		}
	];
	assert.deepEqual(topTeammates(replays, 't1'), [
		{ name: 'BobRenamed', clan: 'NEW', toon: 't2', games: 2, seconds: 20 }
	]);
});

test('credits a teammate once per game and falls back to the name key', () => {
	const replays: TeammateReplay[] = [
		{
			playedAt: '2026-07-01T10:00:00Z',
			durationLoops: 16 * 600,
			// a duplicated sighting must not double-count, and the player themselves
			// is keyed by name when the replay carries no toon for them
			sightings: [
				sighting('', 'NoToon'),
				sighting('t2', 'Bob'),
				sighting('t2', 'Bob'),
				sighting('', '')
			]
		}
	];
	assert.deepEqual(topTeammates(replays, 'NoToon'), [
		{ name: 'Bob', clan: '', toon: 't2', games: 1, seconds: 600 }
	]);
});

test('applies the limit and counts games with no recorded duration', () => {
	const replays: TeammateReplay[] = [
		{
			playedAt: '2026-07-01T10:00:00Z',
			sightings: [
				sighting('t1', 'Alice'),
				...Array.from({ length: 12 }, (_, i) => sighting(`m${i}`, `M${i}`))
			]
		}
	];
	const top = topTeammates(replays, 't1');
	assert.equal(top.length, 10);
	assert.deepEqual(top[0], { name: 'M0', clan: '', toon: 'm0', games: 1, seconds: 0 });
	assert.equal(topTeammates(replays, 't1', 3).length, 3);
	// a player with no shared games has an empty board
	assert.deepEqual(topTeammates(replays, 'nobody'), []);
});
