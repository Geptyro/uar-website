/** Unit tests for the overview page's 7-day boards aggregation (npm test). */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { longestGame, weeklyBoards, type WeeklyXpReplay } from '../src/lib/server/weekly.ts';

// window starts 2026-07-19T12:00:00Z; nothing older than that ever counts
const NOW = new Date('2026-07-26T12:00:00Z');

const sighting = (
	toon: string,
	name: string,
	xp: number,
	gamesPlayed: number,
	{ prestige = 0, clan = '', mos = [] as string[] } = {}
) => ({ toon, name, clan, xpEn: xp, xpWo: 0, xpCo: 0, prestige, gamesPlayed, mos });

const replay = (playedAt: string, sightings: WeeklyXpReplay['sightings']): WeeklyXpReplay => ({
	playedAt,
	sightings
});

test('xp: diffs the newest in-window sighting against the oldest in-window one', () => {
	const replays = [
		replay('2026-07-17T10:00:00Z', [sighting('t1', 'Alice', 1000, 10)]), // pre-window
		replay('2026-07-20T10:00:00Z', [sighting('t1', 'Alice', 6000, 12)]),
		replay('2026-07-25T10:00:00Z', [sighting('t1', 'Alice', 9000, 15, { clan: 'NEW' })])
	];
	assert.deepEqual(weeklyBoards(replays, NOW).xp, [
		{ name: 'Alice', clan: 'NEW', toon: 't1', xpGained: 3000, games: 3 }
	]);
});

test('xp: a pre-window sighting is never the baseline, however recent it is', () => {
	const replays = [
		// one day before the window opens: anchoring here would credit Bruno's
		// pre-window games (10 of them, 8000 XP) to "this week"
		replay('2026-07-18T10:00:00Z', [sighting('t1', 'Bruno', 1000, 10)]),
		replay('2026-07-21T10:00:00Z', [sighting('t1', 'Bruno', 9000, 20)]),
		replay('2026-07-25T10:00:00Z', [sighting('t1', 'Bruno', 12000, 24)])
	];
	assert.deepEqual(weeklyBoards(replays, NOW).xp, [
		{ name: 'Bruno', clan: '', toon: 't1', xpGained: 3000, games: 4 }
	]);
});

test('xp: a single in-window sighting gives no span to diff over', () => {
	const replays = [
		replay('2026-07-20T10:00:00Z', [
			sighting('t1', 'Alice', 500, 1),
			sighting('t2', 'Bob', 9000, 50) // never seen again this week
		]),
		replay('2026-07-24T10:00:00Z', [sighting('t1', 'Alice', 2500, 4)])
	];
	assert.deepEqual(weeklyBoards(replays, NOW).xp, [
		{ name: 'Alice', clan: '', toon: 't1', xpGained: 2000, games: 3 }
	]);
});

test('months-old sightings stay out of both the xp board and the honor roll', () => {
	const replays = [
		replay('2026-05-17T16:41:00Z', [
			sighting('t1', 'Dani', 194075, 83),
			sighting('t2', 'Cara', 1000, 10),
			sighting('t3', 'Pres', 250000, 40)
		]),
		replay('2026-07-25T11:59:00Z', [
			sighting('t1', 'Dani', 250000, 169),
			sighting('t2', 'Cara', 3000, 12),
			sighting('t3', 'Pres', 50000, 44, { prestige: 2 })
		]),
		replay('2026-07-25T20:15:00Z', [sighting('t2', 'Cara', 5000, 14)])
	];
	const boards = weeklyBoards(replays, NOW);
	// Dani/Pres: one in-window sighting only → nothing to diff → hidden
	// Cara: diffs between her two in-window games, not against May
	assert.deepEqual(boards.xp, [{ name: 'Cara', clan: '', toon: 't2', xpGained: 2000, games: 2 }]);
	assert.deepEqual(boards.prestiged, []);
});

test('careerXp carries gains across a prestige reset, and the honor roll records it', () => {
	const replays = [
		replay('2026-07-20T10:00:00Z', [
			{ toon: 't1', name: 'Alice', clan: '', xpEn: 250000, xpWo: 250000, xpCo: 250000, prestige: 0, gamesPlayed: 100, mos: [] }
		]),
		// prestiged and earned 3k on top of the fresh 50k tracks
		replay('2026-07-25T10:00:00Z', [
			{ toon: 't1', name: 'Alice', clan: '', xpEn: 53000, xpWo: 50000, xpCo: 50000, prestige: 1, gamesPlayed: 101, mos: [] }
		])
	];
	const boards = weeklyBoards(replays, NOW);
	assert.deepEqual(boards.xp, [{ name: 'Alice', clan: '', toon: 't1', xpGained: 3000, games: 1 }]);
	assert.deepEqual(boards.prestiged, [
		{ name: 'Alice', clan: '', toon: 't1', from: 0, to: 1, prestigedAt: '2026-07-20T10:00:00.000Z' }
	]);
});

test('excludes players not seen this week and zero-gain players', () => {
	const replays = [
		replay('2026-07-01T10:00:00Z', [sighting('t1', 'Idle', 1000, 5)]),
		replay('2026-07-10T10:00:00Z', [sighting('t1', 'Idle', 9000, 9)]),
		replay('2026-07-20T10:00:00Z', [sighting('t2', 'Flat', 500, 3)]),
		replay('2026-07-25T10:00:00Z', [sighting('t2', 'Flat', 500, 3)])
	];
	const boards = weeklyBoards(replays, NOW);
	assert.deepEqual(boards.xp, []);
	assert.deepEqual(boards.prestiged, []);
});

test('sorts by gain (ties: games) and applies the limit', () => {
	const replays = [
		replay(
			'2026-07-20T10:00:00Z',
			Array.from({ length: 12 }, (_, i) => sighting(`t${i}`, `P${i}`, 0, 0))
		),
		replay(
			'2026-07-25T10:00:00Z',
			Array.from({ length: 12 }, (_, i) => sighting(`t${i}`, `P${i}`, 100 * (i + 1), i))
		)
	];
	const top = weeklyBoards(replays, NOW).xp;
	assert.equal(top.length, 10);
	assert.equal(top[0].name, 'P11');
	assert.equal(top[0].xpGained, 1200);
	assert.equal(top[9].name, 'P2');
	assert.equal(weeklyBoards(replays, NOW, 3).xp.length, 3);
});

test('prestiged: same-day prestiges sort by new level, no XP-gain requirement', () => {
	const replays = [
		replay('2026-07-20T10:00:00Z', [
			sighting('t1', 'Alice', 250000, 10, { prestige: 2 }),
			sighting('t2', 'Bob', 250000, 20, { prestige: 0 })
		]),
		// fresh prestige with no XP on top: careerXp gain is 0 but the roll still shows it
		replay('2026-07-25T10:00:00Z', [
			sighting('t1', 'Alice', 50000, 11, { prestige: 3 }),
			sighting('t2', 'Bob', 50000, 21, { prestige: 1 })
		])
	];
	const boards = weeklyBoards(replays, NOW);
	assert.deepEqual(
		boards.prestiged.map((p) => [p.name, p.from, p.to]),
		[
			['Alice', 2, 3],
			['Bob', 0, 1]
		]
	);
	// with only one track banked, careerXp change here is 600k - 200k = 400k
	assert.equal(boards.xp.length, 2);
});

test('prestiged: dated to the game taken in (last seen at the old level), newest first', () => {
	const replays = [
		// out of order on purpose: the dating must not lean on replay order
		replay('2026-07-25T10:00:00Z', [
			sighting('t1', 'Alice', 50000, 12, { prestige: 3 }),
			sighting('t2', 'Bob', 50000, 21, { prestige: 1 })
		]),
		replay('2026-07-20T10:00:00Z', [
			sighting('t1', 'Alice', 250000, 10, { prestige: 2 }),
			sighting('t2', 'Bob', 250000, 20, { prestige: 0 })
		]),
		// Alice's bank still reads P2 going into this game: this is the one she prestiged in
		replay('2026-07-22T10:00:00Z', [sighting('t1', 'Alice', 250000, 11, { prestige: 2 })]),
		// same for Bob, two days later
		replay('2026-07-24T10:00:00Z', [sighting('t2', 'Bob', 250000, 20, { prestige: 0 })])
	];
	assert.deepEqual(
		weeklyBoards(replays, NOW).prestiged.map((p) => [p.name, p.to, p.prestigedAt]),
		[
			// Bob's is the more recent prestige, though Alice reached the higher level
			['Bob', 1, '2026-07-24T10:00:00.000Z'],
			['Alice', 3, '2026-07-22T10:00:00.000Z']
		]
	);
});

test('prestiged: a double prestige is dated by its last step', () => {
	const replays = [
		replay('2026-07-20T10:00:00Z', [sighting('t1', 'Alice', 250000, 10, { prestige: 2 })]),
		replay('2026-07-22T10:00:00Z', [sighting('t1', 'Alice', 250000, 11, { prestige: 3 })]),
		replay('2026-07-25T10:00:00Z', [sighting('t1', 'Alice', 50000, 12, { prestige: 4 })])
	];
	assert.deepEqual(
		weeklyBoards(replays, NOW).prestiged.map((p) => [p.from, p.to, p.prestigedAt]),
		[[2, 4, '2026-07-22T10:00:00.000Z']]
	);
});

test('classPicks: counts per-game picks inside the window only', () => {
	const replays = [
		replay('2026-07-10T10:00:00Z', [sighting('t1', 'Alice', 0, 1, { mos: ['Ghost'] })]),
		replay('2026-07-20T10:00:00Z', [
			sighting('t1', 'Alice', 100, 2, { mos: ['Ghost', 'Reaper'] }),
			sighting('t2', 'Bob', 0, 1, { mos: ['Ghost'] })
		]),
		replay('2026-07-25T10:00:00Z', [sighting('t1', 'Alice', 200, 3, { mos: ['Ghost'] })])
	];
	assert.deepEqual(weeklyBoards(replays, NOW).classPicks, [
		{ mos: 'Ghost', picks: 3 },
		{ mos: 'Reaper', picks: 1 }
	]);
});

test('games: counts the window, settles wins and losses, names the top mode', () => {
	const game = (playedAt: string, extra: Partial<WeeklyXpReplay>) => ({
		...replay(playedAt, [sighting('t1', 'Alice', 1000, 10)]),
		...extra
	});
	const replays = [
		game('2026-07-17T10:00:00Z', { outcome: 'win', mode: 3 }), // pre-window
		game('2026-07-20T10:00:00Z', { outcome: 'win', mode: 3 }),
		game('2026-07-21T10:00:00Z', { outcome: 'loss', mode: 2 }),
		game('2026-07-22T10:00:00Z', { outcome: 'win', mode: 2 }),
		game('2026-07-23T10:00:00Z', {}), // unsettled, mode unknown
		game('2026-07-24T10:00:00Z', { players: 0, outcome: 'win', mode: 2 }) // empty recording
	];
	assert.deepEqual(weeklyBoards(replays, NOW).games, { played: 4, won: 2, lost: 1, topMode: 2 });
});

test('games: a tie on mode goes to the harder one, and no mode known means none named', () => {
	const game = (playedAt: string, mode?: number) => ({
		...replay(playedAt, [sighting('t1', 'Alice', 1000, 10)]),
		...(mode ? { mode } : {})
	});
	assert.equal(
		weeklyBoards([game('2026-07-20T10:00:00Z', 2), game('2026-07-21T10:00:00Z', 4)], NOW).games
			.topMode,
		4
	);
	assert.deepEqual(weeklyBoards([game('2026-07-20T10:00:00Z')], NOW).games, {
		played: 1,
		won: 0,
		lost: 0
	});
});

test('longestGame: the longest in-window game with a length, or null', () => {
	const g = (file: string, startedAt: string, gameLoops?: number) => ({
		file,
		startedAt,
		players: 4,
		...(gameLoops ? { gameLoops } : {})
	});
	assert.equal(
		longestGame(
			[
				g('a.SC2Replay', '2026-07-18T10:00:00Z', 90000), // pre-window, longest of all
				g('b.SC2Replay', '2026-07-20T10:00:00Z', 50000),
				g('c.SC2Replay', '2026-07-24T10:00:00Z', 70000),
				g('d.SC2Replay', '2026-07-25T10:00:00Z') // no length
			],
			NOW
		)?.file,
		'c.SC2Replay'
	);
	assert.equal(longestGame([g('d.SC2Replay', '2026-07-25T10:00:00Z')], NOW), null);
});
