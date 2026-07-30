/**
 * Unit tests for telling a game's length from its recording's (npm test).
 *
 * The numbers in here are from real replays: the archive's one idled recording
 * (9:06:08 recorded, the win cinematic at 1:17:48, nine of twelve players
 * clicking through the end screen at 1:18:31–1:18:46 and leaving, three
 * staying in the map) and a normal game of the same era for the case that must
 * not change (1:44:50 recorded, marker at 1:43:49, nobody left early).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	LOOPS_PER_SECOND as L,
	departedEarly,
	exitDialogLoop,
	gameEndLoop,
	needsExitScan,
	startedAtOf,
	type DialogClick,
	type PlayerEnd
} from '../src/lib/gameEnd.ts';

const at = (h: number, m: number, s: number) => ((h * 60 + m) * 60 + s) * L;

/** The idled game: nine players out at ~1:18:4x, three still in at 9:06:08. */
const IDLED_RECORDING = at(9, 6, 8);
const idledPlayers: PlayerEnd[] = [
	...[31, 33, 34, 36, 38, 39, 42, 45, 46].map((s, i) => ({
		user: i,
		lastLoop: at(1, 18, s)
	})),
	{ user: 9, lastLoop: IDLED_RECORDING },
	{ user: 10, lastLoop: IDLED_RECORDING },
	{ user: 11, lastLoop: IDLED_RECORDING }
];

/** A normal game: the whole lobby is still in when the recording stops. */
const NORMAL_RECORDING = at(1, 44, 50);
const normalPlayers: PlayerEnd[] = Array.from({ length: 12 }, (_, i) => ({
	user: i,
	lastLoop: NORMAL_RECORDING - (i % 3) * L * 4
}));

test('departedEarly separates the players who left from those who stayed', () => {
	const left = departedEarly(idledPlayers, IDLED_RECORDING);
	assert.equal(left.length, 9);
	assert.equal(Math.max(...left.map((p) => p.lastLoop)), at(1, 18, 46));
	// a lobby that all stopped together left nobody behind to notice
	assert.deepEqual(departedEarly(normalPlayers, NORMAL_RECORDING), []);
});

test('needsExitScan only pays for game.events when nothing else can date the end', () => {
	// a marker answers it for free, however lopsided the departures
	assert.equal(needsExitScan(idledPlayers, IDLED_RECORDING, at(1, 17, 48)), false);
	// no marker, most of the lobby gone, this recording still running
	assert.equal(needsExitScan(idledPlayers, IDLED_RECORDING, null), true);
	// no marker but nobody left early: a recording that stopped mid-game
	assert.equal(needsExitScan(normalPlayers, NORMAL_RECORDING, null), false);
	// a couple of leavers in a game the rest played on in is not an ending
	const twoLeavers: PlayerEnd[] = [
		{ user: 0, lastLoop: at(0, 20, 0) },
		{ user: 1, lastLoop: at(0, 21, 0) },
		...normalPlayers.slice(2)
	];
	assert.equal(needsExitScan(twoLeavers, NORMAL_RECORDING, null), false);
});

test('exitDialogLoop finds the end screen and ignores gameplay dialogs', () => {
	// the real burst: one control, one click each, everyone gone right after
	const exit: DialogClick[] = [31, 33, 34, 36, 38, 39, 42, 45, 46].map((s, i) => ({
		user: i,
		control: 40783,
		loop: at(1, 18, s)
	}));
	assert.equal(exitDialogLoop(exit, idledPlayers), at(1, 18, 46));

	// shop and skill traffic: many controls, repeat clicks, players who play on
	const gameplay: DialogClick[] = [
		{ user: 0, control: 1278, loop: at(0, 49, 4) },
		{ user: 0, control: 1278, loop: at(0, 49, 9) },
		{ user: 1, control: 1298, loop: at(0, 49, 12) },
		{ user: 2, control: 1338, loop: at(0, 50, 1) }
	];
	assert.equal(exitDialogLoop(gameplay, idledPlayers), null);
	// one control clicked once each by two players who then kept playing
	const stayed: DialogClick[] = [
		{ user: 9, control: 683, loop: at(0, 55, 0) },
		{ user: 10, control: 683, loop: at(0, 55, 6) }
	];
	assert.equal(exitDialogLoop(stayed, idledPlayers), null);
	// a real burst still wins when it comes after a coincidental one
	assert.equal(exitDialogLoop([...gameplay, ...stayed, ...exit], idledPlayers), at(1, 18, 46));
});

test('exitDialogLoop needs a burst, not a single click', () => {
	const one: DialogClick[] = [{ user: 0, control: 40783, loop: at(1, 18, 31) }];
	assert.equal(exitDialogLoop(one, idledPlayers), null);
	// clicks too far apart to be one ending
	const spread: DialogClick[] = [
		{ user: 0, control: 40783, loop: at(1, 18, 31) },
		{ user: 1, control: 40783, loop: at(1, 25, 0) }
	];
	assert.equal(exitDialogLoop(spread, idledPlayers), null);
});

test('gameEndLoop trims the idle tail off the recording', () => {
	// the marker dates it, and the departures carry it to the end screen
	assert.equal(
		gameEndLoop({
			recordingLoops: IDLED_RECORDING,
			markerLoop: at(1, 17, 48),
			players: idledPlayers
		}),
		at(1, 18, 46)
	);
	// a marker-less ending, dated by the exit dialog instead
	assert.equal(
		gameEndLoop({
			recordingLoops: IDLED_RECORDING,
			markerLoop: null,
			exitLoop: at(1, 18, 46),
			players: idledPlayers
		}),
		at(1, 18, 46)
	);
});

test('gameEndLoop leaves an ordinary recording exactly as long as it was', () => {
	// the cinematic and score screen legitimately run on past the marker
	assert.equal(
		gameEndLoop({
			recordingLoops: NORMAL_RECORDING,
			markerLoop: at(1, 43, 49),
			players: normalPlayers
		}),
		NORMAL_RECORDING
	);
	// and a recording that stopped mid-game has no evidence to trim by
	assert.equal(
		gameEndLoop({ recordingLoops: NORMAL_RECORDING, markerLoop: null, players: normalPlayers }),
		NORMAL_RECORDING
	);
});

test('gameEndLoop never reports a game longer than its recording', () => {
	// a marker at the very last loop, and a stale exit loop beyond it
	assert.equal(
		gameEndLoop({
			recordingLoops: at(0, 30, 0),
			markerLoop: at(0, 29, 59),
			exitLoop: at(0, 45, 0),
			players: [],
			}),
		at(0, 30, 0)
	);
});

test('startedAtOf walks back from the recording end, not the game end', () => {
	// the idled game: 9:06:08 of recording before m_timeUTC
	assert.equal(startedAtOf('2026-07-30T04:43:07Z', IDLED_RECORDING), '2026-07-29T19:36:59Z');
	// fixed-width shape, so playedAt range queries stay lexical
	assert.equal(startedAtOf('2026-07-23T18:02:17Z', 496), '2026-07-23T18:01:46Z');
	// nothing to walk back with, or nothing parseable: unchanged
	assert.equal(startedAtOf('2026-07-23T18:02:17Z'), '2026-07-23T18:02:17Z');
	assert.equal(startedAtOf('not a date', 496), 'not a date');
});
