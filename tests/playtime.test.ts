/** Unit tests for the per-MOS player boards aggregation (npm test). */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	classBoardsByMos,
	topPlayersByMos,
	weekOf,
	type PlaytimeReplay
} from '../src/lib/server/playtime.ts';

const sighting = (toon: string, name: string, mos: string[], clan = '', leftLoop?: number) => ({
	toon,
	name,
	clan,
	mos,
	...(leftLoop === undefined ? {} : { leftLoop })
});

/** A row as the board stores it, for a player with no settled games. */
const row = (name: string, toon: string, games: number, seconds: number, lastAt: string) => ({
	name,
	clan: '',
	toon,
	games,
	seconds,
	wins: 0,
	losses: 0,
	lastAt
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
		row('Alice', 't1', 2, 1800, '2026-07-02T10:00:00Z'),
		row('Bob', 't2', 1, 600, '2026-07-01T10:00:00Z')
	]);
	// a multi-class sighting credits the full game to each class
	assert.deepEqual(top['Recon'], [row('Alice', 't1', 1, 1200, '2026-07-02T10:00:00Z')]);
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
	assert.equal(p.lastAt, '2026-07-05T10:00:00Z');
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
	assert.deepEqual(top[0], row('NoToon', '', 2, 30, '2026-07-02T10:00:00Z'));
	assert.equal(Object.keys(topPlayersByMos(replays)).length, 1);
	// the totals see everyone, whatever the board's limit
	assert.equal(classBoardsByMos(replays)['Medic'].stats.players, 13);
});

test('missing durationLoops counts the game with zero time', () => {
	const replays: PlaytimeReplay[] = [
		{
			playedAt: '2026-07-01T10:00:00Z',
			sightings: [sighting('t1', 'Alice', ['Medic'])]
		}
	];
	assert.deepEqual(topPlayersByMos(replays)['Medic'], [
		row('Alice', 't1', 1, 0, '2026-07-01T10:00:00Z')
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
		row('Alice', 't1', 1, 4726, '2026-07-30T04:43:07Z')
	]);
});

test('credits a player who left for the stretch they were in, and the class for the longest stay', () => {
	const replays: PlaytimeReplay[] = [
		{
			playedAt: '2026-07-01T10:00:00Z',
			gameLoops: 16 * 3600, // an hour
			sightings: [
				sighting('t1', 'Alice', ['Medic'], '', 16 * 120), // left at minute two
				sighting('t2', 'Bob', ['Medic']), // stayed to the end
				sighting('t3', 'Cara', ['Medic'], '', 16 * 99999) // a leave after the game's end is clamped
			]
		}
	];
	const b = classBoardsByMos(replays)['Medic'];
	const by = Object.fromEntries(b.rows.map((r) => [r.toon, r.seconds]));
	assert.deepEqual(by, { t1: 120, t2: 3600, t3: 3600 });
	assert.equal(b.stats.seconds, 3600);
	assert.equal(b.stats.picks, 3);
	assert.equal(b.stats.games, 1);
});

test('totals: games once per class, picks per player, outcomes and modes tallied', () => {
	const replays: PlaytimeReplay[] = [
		{
			file: 'g1',
			playedAt: '2026-07-01T10:00:00Z',
			gameLoops: 16 * 600,
			outcome: 'win',
			mode: 3,
			sightings: [sighting('t1', 'Alice', ['Medic']), sighting('t2', 'Bob', ['Medic'])]
		},
		{
			file: 'g2',
			playedAt: '2026-07-02T10:00:00Z',
			gameLoops: 16 * 1200,
			outcome: 'loss',
			mode: 3,
			sightings: [sighting('t1', 'Alice', ['Medic'])]
		},
		{
			file: 'g3',
			playedAt: '2026-07-03T10:00:00Z',
			gameLoops: 16 * 300,
			// unsettled, unknown mode
			sightings: [sighting('t3', 'Cara', ['Medic'])]
		},
		{
			file: 'g4',
			playedAt: '2026-06-30T10:00:00Z',
			gameLoops: 16 * 100,
			outcome: 'win',
			mode: 5,
			sightings: [sighting('t9', 'Nobody', ['Recon'])]
		}
	];
	const medic = classBoardsByMos(replays)['Medic'];
	assert.deepEqual(medic.stats, {
		players: 3,
		games: 3,
		picks: 4,
		seconds: 600 + 1200 + 300,
		wins: 1,
		losses: 1,
		byMode: [{ mode: 3, games: 2, wins: 1, losses: 1 }],
		firstAt: '2026-07-01T10:00:00Z',
		lastAt: '2026-07-03T10:00:00Z'
	});
	// per-player outcomes ride along on the rows
	const alice = medic.rows.find((r) => r.toon === 't1')!;
	assert.equal(alice.wins, 1);
	assert.equal(alice.losses, 1);
	const cara = medic.rows.find((r) => r.toon === 't3')!;
	assert.equal(cara.wins, 0);
	assert.equal(cara.losses, 0);
	// recent: newest first, capped, with the class's own roster for the game
	assert.deepEqual(
		medic.recent.map((g) => g.file),
		['g3', 'g2', 'g1']
	);
	assert.deepEqual(medic.recent[2], {
		file: 'g1',
		playedAt: '2026-07-01T10:00:00Z',
		seconds: 600,
		mode: 3,
		outcome: 'win',
		players: [
			{ toon: 't1', name: 'Alice', clan: '' },
			{ toon: 't2', name: 'Bob', clan: '' }
		]
	});
	assert.equal(classBoardsByMos(replays, { recent: 1 })['Medic'].recent.length, 1);
	// the other class saw none of it
	assert.equal(classBoardsByMos(replays)['Recon'].stats.games, 1);
	// weekly: g1 (Wed 07-01) and g2 (Thu 07-02) share the week of Mon 06-29; g3 (Fri 07-03) too
	assert.deepEqual(medic.weekly, [{ week: '2026-06-29', games: 3, wins: 1, losses: 1 }]);
});

test('weekOf is the Monday of the week, UTC', () => {
	assert.equal(weekOf('2026-07-01T10:00:00Z'), '2026-06-29'); // a Wednesday
	assert.equal(weekOf('2026-06-29T00:00:00Z'), '2026-06-29'); // Monday itself
	assert.equal(weekOf('2026-07-05T23:59:59Z'), '2026-06-29'); // Sunday still belongs to it
	assert.equal(weekOf('2026-07-06T00:00:00Z'), '2026-07-06');
});

test('alongside: the other classes in the same games, once per game, busiest first', () => {
	const g = (file: string, day: number, picks: [string, string[]][]): PlaytimeReplay => ({
		file,
		playedAt: `2026-07-${String(day).padStart(2, '0')}T10:00:00Z`,
		gameLoops: 160,
		sightings: picks.map(([toon, mos]) => sighting(toon, toon, mos))
	});
	const b = classBoardsByMos([
		g('a', 1, [['t1', ['Medic']], ['t2', ['Rifle']], ['t3', ['Rifle']], ['t4', ['Sniper']]]),
		g('b', 2, [['t1', ['Medic']], ['t2', ['Rifle']]]),
		g('c', 3, [['t5', ['Sniper']], ['t6', ['Rifle']]])
	]);
	// two riflemen in game a still count it once; the sniper's game c has no medic
	assert.deepEqual(b['Medic'].alongside, [
		{ mos: 'Rifle', games: 2 },
		{ mos: 'Sniper', games: 1 }
	]);
	assert.deepEqual(b['Sniper'].alongside, [
		{ mos: 'Rifle', games: 2 },
		{ mos: 'Medic', games: 1 }
	]);
	assert.deepEqual(classBoardsByMos([g('a', 1, [['t1', ['Medic']]])])['Medic'].alongside, []);
	assert.equal(classBoardsByMos([g('a', 1, [['t1', ['Medic']], ['t2', ['Rifle']], ['t3', ['Sniper']]])], { alongside: 1 })['Medic'].alongside.length, 1);
});

test('busiest mode first, ties by mode number', () => {
	const game = (file: string, mode: number, day: number): PlaytimeReplay => ({
		file,
		playedAt: `2026-07-${String(day).padStart(2, '0')}T10:00:00Z`,
		gameLoops: 160,
		mode,
		sightings: [sighting('t1', 'Alice', ['Medic'])]
	});
	const b = classBoardsByMos([game('a', 7, 1), game('b', 2, 2), game('c', 7, 3), game('d', 1, 4)]);
	assert.deepEqual(
		b['Medic'].stats.byMode.map((m) => m.mode),
		[7, 1, 2]
	);
});
