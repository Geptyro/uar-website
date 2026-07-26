import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupPresence, validateBeat, type PresenceEntry } from '../src/lib/presence.ts';

test('validateBeat: accepts real heartbeats, clamps junk', () => {
	assert.deepEqual(validateBeat({ status: 'ingame', uar: true, players: 12, displayTime: 57.9 }), {
		status: 'ingame',
		uar: true,
		players: 12,
		displayTime: 57
	});
	assert.deepEqual(validateBeat({ status: 'lobby', uar: false }), { status: 'lobby', uar: false });
	const withExtras = validateBeat({
		status: 'lobby',
		uar: true,
		roster: ['Kanax#2515'],
		lobbyId: 355265080
	});
	assert.deepEqual(withExtras?.roster, ['Kanax#2515']);
	assert.equal(withExtras?.lobbyId, 355265080);

	assert.equal(validateBeat(null), null);
	assert.equal(validateBeat({ status: 'flying', uar: true }), null);
	assert.equal(validateBeat({ status: 'ingame' }), null);
	// out-of-range extras are dropped, not fatal
	const clamped = validateBeat({ status: 'ingame', uar: true, players: 900, lobbyId: -1 });
	assert.equal(clamped?.players, undefined);
	assert.equal(clamped?.lobbyId, undefined);
});

function entry(partial: Partial<PresenceEntry> & { battletag: string }): PresenceEntry {
	return { toon: null, avatar: null, status: 'ingame', uar: true, ...partial };
}

test('groupPresence: lobbyId first, roster fallback, solo last resort', () => {
	const groups = groupPresence([
		entry({ battletag: 'A#1', lobbyId: 42, status: 'lobby' }),
		entry({ battletag: 'B#2', lobbyId: 42, status: 'lobby' }),
		entry({ battletag: 'C#3', roster: ['C', 'D', 'E'], players: 3 }),
		entry({ battletag: 'D#4', roster: ['E', 'D', 'C'], players: 3 }),
		entry({ battletag: 'F#5' })
	]);
	assert.equal(groups.length, 3);
	const byKey = Object.fromEntries(groups.map((g) => [g.key, g]));
	assert.equal(byKey['lobby'].members.length, 2, 'lobbies collapse regardless of id');
	assert.equal(byKey['lobby'].status, 'lobby');
	const rosterKey = Object.keys(byKey).find((k) => k.startsWith('roster:'));
	assert.ok(rosterKey, 'roster-set grouping key exists');
	assert.equal(byKey[rosterKey!].members.length, 2);
	assert.equal(byKey[rosterKey!].players, 3);
	assert.equal(byKey['solo:F#5'].members.length, 1);
});

test('groupPresence: every lobby reporter lands in the one lobby', () => {
	// nothing local distinguishes two open lobbies — SC2 writes the file
	// carrying a lobby id at game start, not when the lobby forms — and
	// matching on rosters split one lobby into several, because members see
	// different sets as people join
	const groups = groupPresence([
		entry({ battletag: 'A#1', status: 'lobby', roster: ['A', 'B'] }),
		entry({ battletag: 'B#2', status: 'lobby', roster: ['A', 'B', 'C'] }),
		entry({ battletag: 'C#3', status: 'lobby' })
	]);
	assert.equal(groups.length, 1);
	assert.equal(groups[0].key, 'lobby');
	assert.equal(groups[0].members.length, 3);
	assert.equal(groups[0].players, 3);
});

test('groupPresence: concurrent games still separate on their rosters', () => {
	const groups = groupPresence([
		entry({ battletag: 'A#1', roster: ['A', 'B'], players: 2 }),
		entry({ battletag: 'C#3', roster: ['C', 'D'], players: 2 })
	]);
	assert.equal(groups.length, 2, 'games run at the same time — never merge them');
});

test('groupPresence: game members share a lobby id, clock takes the max', () => {
	const groups = groupPresence([
		entry({ battletag: 'A#1', lobbyId: 7, status: 'ingame', displayTime: 60 }),
		entry({ battletag: 'B#2', lobbyId: 7, status: 'ingame', displayTime: 120 }),
		entry({ battletag: 'C#3', lobbyId: 7, status: 'ingame', displayTime: 90 })
	]);
	assert.equal(groups.length, 1);
	assert.equal(groups[0].status, 'ingame');
	assert.equal(groups[0].displayTime, 120, 'the furthest-along clock wins');
	assert.equal(groups[0].players, 3);
});
