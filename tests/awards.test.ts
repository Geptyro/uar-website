import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	awardsBetween,
	awardsForSightings,
	awardTimeline,
	type AwardRankTrack,
	type AwardSighting
} from '../src/lib/awards.ts';

const TRACKS: AwardRankTrack[] = [
	{
		track: 1,
		ranks: [
			{ xp: 0, name: 'Private' },
			{ xp: 1000, name: 'Private First Class' },
			{ xp: 5000, name: 'Corporal' }
		]
	},
	{
		track: 2,
		ranks: [
			{ xp: 0, name: 'WO1' },
			{ xp: 2000, name: 'WO2' }
		]
	}
];

/** A bank with nothing in it; spread over it to say only what a test is about. */
function bank(over: Partial<AwardSighting> = {}): AwardSighting {
	return {
		gamesPlayed: 0,
		prestige: 0,
		xpEn: 0,
		xpWo: 0,
		xpCo: 0,
		...over,
		unlocks: {
			camos: [1, 19],
			decals: [],
			sis: [],
			medals: [],
			walker: [false, false, false, false, false, false],
			lk19: [],
			predator: [],
			robot: [false, false],
			medvisor: [],
			...(over.unlocks ?? {})
		}
	};
}

test('a medal that appears in the next bank was won in this game', () => {
	const got = awardsBetween(bank(), bank({ unlocks: { medals: [3] } as never }));
	assert.deepEqual(got, [{ type: 'medal', id: 3 }]);
});

test('nothing is reported when nothing changed', () => {
	assert.deepEqual(awardsBetween(bank({ unlocks: { medals: [3] } as never }), bank({ unlocks: { medals: [3] } as never })), []);
});

test('a bank that goes backwards is silence, not a loss', () => {
	const before = bank({ unlocks: { medals: [1, 2, 3], sis: [4] } as never });
	const after = bank({ unlocks: { medals: [], sis: [] } as never });
	assert.deepEqual(awardsBetween(before, after), []);
});

test('the camos forced on by the load code are never awards', () => {
	// 1 and 19 are set by the map whatever the player did; 7 is real
	const got = awardsBetween(bank({ unlocks: { camos: [] } as never }), bank({ unlocks: { camos: [1, 7, 19] } as never }));
	assert.deepEqual(got, [{ type: 'camo', id: 7 }]);
});

test('completing a gear ladder is announced once, not twice', () => {
	// the map derives decal 11 from the walker's last rung, so both flip together
	const before = bank({ unlocks: { walker: [true, true, true, true, true, false] } as never });
	const after = bank({
		unlocks: { walker: [true, true, true, true, true, true], decals: [11] } as never
	});
	assert.deepEqual(awardsBetween(before, after), [{ type: 'gear', group: 'walker', id: 5 }]);
});

test('a decal that is not ladder-derived still counts', () => {
	const got = awardsBetween(bank(), bank({ unlocks: { decals: [4] } as never }));
	assert.deepEqual(got, [{ type: 'decal', id: 4 }]);
});

test('crossing a rank threshold is an award, naming the rank reached', () => {
	const got = awardsBetween(bank({ xpEn: 900 }), bank({ xpEn: 1200 }), TRACKS);
	assert.deepEqual(got, [{ type: 'rank', id: 1, track: 1, label: 'Private First Class' }]);
});

test('two tracks can rank up in the same game', () => {
	const got = awardsBetween(bank({ xpEn: 900, xpWo: 1900 }), bank({ xpEn: 1200, xpWo: 2200 }), TRACKS);
	assert.deepEqual(got.map((a) => a.label), ['Private First Class', 'WO2']);
});

test('XP that gains no rank is not an award', () => {
	assert.deepEqual(awardsBetween(bank({ xpEn: 1100 }), bank({ xpEn: 1900 }), TRACKS), []);
});

test('prestige is an award, and the reset it causes is not a demotion', () => {
	// every track drops to 50k on prestige; here that puts Enlisted back down
	const before = bank({ xpEn: 6000, prestige: 0 });
	const after = bank({ xpEn: 100, prestige: 1 });
	assert.deepEqual(awardsBetween(before, after, TRACKS), [{ type: 'prestige', id: 1 }]);
});

test('a game is credited only once the next bank exists', () => {
	const s = [bank({ gamesPlayed: 1 }), bank({ gamesPlayed: 2, unlocks: { medals: [2] } as never })];
	const got = awardsForSightings(s, TRACKS);
	// the medal belongs to game 0 — the one played before the bank that shows it
	assert.deepEqual(got[0], [{ type: 'medal', id: 2 }]);
	// the newest game has no follow-up yet, so nothing is knowable about it
	assert.deepEqual(got[1], []);
});

test("a player's first sighting is not treated as a haul", () => {
	// somebody arriving with a full collection has won none of it *here*
	const s = [
		bank({ gamesPlayed: 40, unlocks: { medals: [1, 2, 3], sis: [1, 2] } as never }),
		bank({ gamesPlayed: 41, unlocks: { medals: [1, 2, 3], sis: [1, 2] } as never })
	];
	assert.deepEqual(awardsForSightings(s, TRACKS), [[], []]);
});

test('a bank that did not move forward is skipped entirely', () => {
	// same game counter: a reset, or the same game recorded twice
	const s = [
		bank({ gamesPlayed: 10 }),
		bank({ gamesPlayed: 10, unlocks: { medals: [5] } as never })
	];
	assert.deepEqual(awardsForSightings(s, TRACKS)[0], []);
});

test('awards over an un-ingested run are still reported, for the caller to mark', () => {
	const s = [
		bank({ gamesPlayed: 10 }),
		bank({ gamesPlayed: 14, unlocks: { medals: [5] } as never })
	];
	assert.deepEqual(awardsForSightings(s, TRACKS)[0], [{ type: 'medal', id: 5 }]);
});

test('the timeline counts the games between two that gave something', () => {
	const rows = awardTimeline([
		{ file: 'c', startedAt: '2026-08-02T00:00:00Z', awards: [], gamesPlayed: 20, span: 1 },
		{ file: 'b', startedAt: '2026-08-01T00:00:00Z', awards: [], gamesPlayed: 16, span: 1 },
		{ file: 'a', startedAt: '2026-07-30T00:00:00Z', awards: [], gamesPlayed: 15, span: 1 }
	]);
	// 20 - 16 - 1 = 3 games passed between b and c that gave nothing; b and a
	// are consecutive, so nothing sits between them
	assert.deepEqual(
		rows.map((r) => (r.kind === 'gap' ? `gap:${r.games}` : r.game.file)),
		['c', 'gap:3', 'b', 'a']
	);
});

test('the count covers uneventful games and un-uploaded ones alike', () => {
	// the save file's counter moved by 9 whatever reached the archive
	const rows = awardTimeline([
		{ file: 'b', startedAt: '2026-08-01T00:00:00Z', awards: [], gamesPlayed: 30, span: 1 },
		{ file: 'a', startedAt: '2026-07-01T00:00:00Z', awards: [], gamesPlayed: 21, span: 1 }
	]);
	assert.deepEqual(
		rows.filter((r) => r.kind === 'gap').map((r) => (r.kind === 'gap' ? r.games : 0)),
		[8]
	);
});

test('an approximate row carries its own run, so no gap is printed above it', () => {
	// both labels would describe the same stretch — the row's own wins
	const rows = awardTimeline([
		{ file: 'b', startedAt: '2026-08-01T00:00:00Z', awards: [], gamesPlayed: 500, span: 1 },
		{ file: 'a', startedAt: '2021-08-08T00:00:00Z', awards: [], gamesPlayed: 10, span: 490 }
	]);
	assert.deepEqual(
		rows.map((r) => r.kind),
		['game', 'game']
	);
});

test('a game whose awards span an un-uploaded run is marked approximate', () => {
	const rows = awardTimeline([
		{ file: 'b', startedAt: '2026-08-01T00:00:00Z', awards: [], gamesPlayed: 16, span: 4 },
		{ file: 'a', startedAt: '2026-07-30T00:00:00Z', awards: [], gamesPlayed: 15, span: 1 }
	]);
	const games = rows.filter((r) => r.kind === 'game');
	assert.deepEqual(
		games.map((r) => (r.kind === 'game' ? r.approximate : null)),
		[true, false]
	);
});
