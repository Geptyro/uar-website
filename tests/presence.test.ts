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
	assert.equal(byKey['id:42'].members.length, 2);
	assert.equal(byKey['id:42'].status, 'lobby');
	const rosterKey = Object.keys(byKey).find((k) => k.startsWith('roster:'));
	assert.ok(rosterKey, 'roster-set grouping key exists');
	assert.equal(byKey[rosterKey!].members.length, 2);
	assert.equal(byKey[rosterKey!].players, 3);
	assert.equal(byKey['solo:F#5'].members.length, 1);
});

test('groupPresence: a lobby reporter with no id joins the lobby we can see', () => {
	// their battlelobby file did not parse — they are still in that lobby,
	// and showing them as a second one is the bug this rule fixes
	const groups = groupPresence([
		entry({ battletag: 'A#1', lobbyId: 42, status: 'lobby', roster: ['A', 'B'] }),
		entry({ battletag: 'B#2', status: 'lobby', roster: ['A', 'B', 'C'] })
	]);
	assert.equal(groups.length, 1);
	assert.equal(groups[0].key, 'id:42');
	assert.equal(groups[0].members.length, 2);
});

test('groupPresence: id-less lobby reporters form one lobby, not one each', () => {
	// rosters differ because people joined between heartbeats
	const groups = groupPresence([
		entry({ battletag: 'A#1', status: 'lobby', roster: ['A', 'B'] }),
		entry({ battletag: 'B#2', status: 'lobby', roster: ['A', 'B', 'C'] }),
		entry({ battletag: 'C#3', status: 'lobby' })
	]);
	assert.equal(groups.length, 1);
	assert.equal(groups[0].key, 'lobby:unidentified');
	assert.equal(groups[0].members.length, 3);
});

test('groupPresence: several identified lobbies keep id-less reporters apart', () => {
	// the one-lobby-at-a-time guess is only safe when one lobby is visible
	const groups = groupPresence([
		entry({ battletag: 'A#1', lobbyId: 1, status: 'lobby' }),
		entry({ battletag: 'B#2', lobbyId: 2, status: 'lobby' }),
		entry({ battletag: 'C#3', status: 'lobby' })
	]);
	assert.equal(groups.length, 3);
	assert.ok(groups.some((g) => g.key === 'lobby:unidentified'));
});

test('groupPresence: concurrent games still separate on their rosters', () => {
	const groups = groupPresence([
		entry({ battletag: 'A#1', roster: ['A', 'B'], players: 2 }),
		entry({ battletag: 'C#3', roster: ['C', 'D'], players: 2 })
	]);
	assert.equal(groups.length, 2, 'games run at the same time — never merge them');
});

test('groupPresence: ingame member upgrades a mixed group, clock takes the max', () => {
	const groups = groupPresence([
		entry({ battletag: 'A#1', lobbyId: 7, status: 'lobby' }),
		entry({ battletag: 'B#2', lobbyId: 7, status: 'ingame', displayTime: 120 }),
		entry({ battletag: 'C#3', lobbyId: 7, status: 'ingame', displayTime: 90 })
	]);
	assert.equal(groups.length, 1);
	assert.equal(groups[0].status, 'ingame');
	assert.equal(groups[0].displayTime, 120);
	assert.equal(groups[0].players, 3);
});
