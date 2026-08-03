/**
 * When a roster change is worth a notification, and what it says. These rules
 * decide whether a phone buzzes, so the cases that must stay quiet — a fresh
 * boot, an expiry, your own click — get as much attention as the ones that fire.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
	DEFAULT_PREFS,
	NO_LOBBY_STATE,
	NO_READY_STATE,
	diffLobby,
	diffReady,
	listNames,
	lobbyPayload,
	readPrefs,
	readyPayload,
	type Subject
} from '../src/lib/push.ts';

const NOW = Date.parse('2026-08-03T12:00:00Z');
const soon = new Date(NOW + 55 * 60_000).toISOString();
const player = (battletag: string, name: string | null = battletag.split('#')[0]) => ({
	// accounts are opaque ids; the battletag doubles as one in these fixtures
	id: `acct:${battletag}`,
	battletag,
	name,
	until: soon
});

/* ------------------------------------------------------------------ ready */

test('the first evaluation after a boot only sets a baseline', () => {
	const { diff, state } = diffReady(NO_READY_STATE, [player('Kanaxz#1234')], NOW);
	assert.equal(diff, null, 'a deploy must not notify everyone who was already flagged');
	assert.deepEqual(Object.keys(state.known ?? {}), ['acct:Kanaxz#1234']);
});

test('a new flag is announced', () => {
	const first = diffReady(NO_READY_STATE, [], NOW).state;
	const { diff } = diffReady(first, [player('Kanaxz#1234')], NOW);
	assert.equal(diff?.added.length, 1);
	assert.equal(diff?.added[0].name, 'Kanaxz');
	assert.equal(diff?.total, 1);
});

test('a flag dropped early is announced, one that merely expired is not', () => {
	const dropped = { ...player('Kanaxz#1234'), until: soon };
	const expiring = { ...player('Zed#9'), until: new Date(NOW + 30_000).toISOString() };
	const first = diffReady(NO_READY_STATE, [dropped, expiring], NOW).state;
	const { diff } = diffReady(first, [], NOW);
	assert.deepEqual(
		diff?.removed.map((s) => s.battletag),
		['Kanaxz#1234'],
		'only the one with time left on it was a deliberate unflag'
	);
});

test('no change means no notification', () => {
	const first = diffReady(NO_READY_STATE, [player('Kanaxz#1234')], NOW).state;
	assert.equal(diffReady(first, [player('Kanaxz#1234')], NOW).diff, null);
});

test('a recipient is not told about their own flag', () => {
	const first = diffReady(NO_READY_STATE, [], NOW).state;
	const { diff } = diffReady(first, [player('Kanaxz#1234')], NOW);
	assert.equal(readyPayload(diff!, 'acct:Kanaxz#1234'), null);
	assert.match(readyPayload(diff!, 'acct:Someone#1')!.title, /^Kanaxz is ready to play$/);
});

test('an arrival wins over a departure in the same tick', () => {
	const first = diffReady(NO_READY_STATE, [player('Zed#9')], NOW).state;
	const { diff } = diffReady(first, [player('Kanaxz#1234')], NOW);
	const payload = readyPayload(diff!, null);
	assert.match(payload!.title, /Kanaxz is ready to play/);
	assert.equal(payload!.body, '1 player ready to play');
});

test('a battletag stands in when the profile name is unresolved', () => {
	const first = diffReady(NO_READY_STATE, [], NOW).state;
	const { diff } = diffReady(first, [player('Kanaxz#1234', null)], NOW);
	assert.match(readyPayload(diff!, null)!.title, /^Kanaxz#1234 is/);
});

/* ------------------------------------------------------------------ lobby */

const sub = (battletag: string): Subject => ({
	id: `acct:${battletag}`,
	battletag,
	name: battletag.split('#')[0]
});
const GAP = 10 * 60_000;

test('a lobby already open at boot is not news', () => {
	const { members, state } = diffLobby(NO_LOBBY_STATE, [sub('Kanaxz#1234')], NOW, GAP);
	assert.equal(members, null);
	assert.deepEqual(state.known, ['acct:Kanaxz#1234']);
});

test('a lobby appearing fires; a join into an open one does not', () => {
	const empty = diffLobby(NO_LOBBY_STATE, [], NOW, GAP).state;
	const formed = diffLobby(empty, [sub('Kanaxz#1234')], NOW, GAP);
	assert.equal(formed.members?.length, 1);

	const joined = diffLobby(formed.state, [sub('Kanaxz#1234'), sub('Zed#9')], NOW + 30_000, GAP);
	assert.equal(joined.members, null, 'it was announced when it formed');
});

test('a lobby blinking out on a stale heartbeat is not a second lobby', () => {
	const empty = diffLobby(NO_LOBBY_STATE, [], NOW, GAP).state;
	const formed = diffLobby(empty, [sub('Kanaxz#1234')], NOW, GAP);
	const gone = diffLobby(formed.state, [], NOW + 60_000, GAP);
	const back = diffLobby(gone.state, [sub('Kanaxz#1234')], NOW + 120_000, GAP);
	assert.equal(back.members, null, 'same faces inside the gap window');
});

test('the same players forming a genuinely new lobby later does fire', () => {
	const empty = diffLobby(NO_LOBBY_STATE, [], NOW, GAP).state;
	const formed = diffLobby(empty, [sub('Kanaxz#1234')], NOW, GAP);
	const gone = diffLobby(formed.state, [], NOW + GAP + 60_000, GAP);
	const again = diffLobby(gone.state, [sub('Kanaxz#1234')], NOW + GAP + 120_000, GAP);
	assert.equal(again.members?.length, 1);
});

test('nobody is told about a lobby they are standing in', () => {
	const members = [sub('Kanaxz#1234'), sub('Zed#9')];
	assert.equal(lobbyPayload(members, 'acct:Kanaxz#1234'), null);
	assert.equal(lobbyPayload(members, 'acct:Other#7')!.title, 'Kanaxz and Zed are in a lobby');
});

/* ------------------------------------------------------------------ misc */

test('listNames matches the companion’s wording', () => {
	assert.equal(listNames(['A']), 'A');
	assert.equal(listNames(['A', 'B']), 'A and B');
	assert.equal(listNames(['A', 'B', 'C', 'D']), 'A, B and 2 more');
});

test('preferences fall back to on, field by field', () => {
	assert.deepEqual(readPrefs(undefined), DEFAULT_PREFS);
	assert.deepEqual(readPrefs({ ready: false }), { ready: false, lobby: true });
	assert.deepEqual(readPrefs({ ready: 'yes', lobby: 0 }), DEFAULT_PREFS, 'non-booleans ignored');
});
