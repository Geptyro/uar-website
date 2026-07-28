/**
 * Modifier vote reading (node:test, `npm test`).
 *
 * The dialog's control ids move between games, so the reader derives where it
 * landed instead of assuming — that derivation is the first thing under test.
 * The rest is the map's own counting: half the lobby rather than a majority,
 * which ballots it refuses, and which modifiers exclude which.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveBase, tallyModifiers, type ModifierEvent } from '../src/lib/server/replay/modifiers.ts';

const BASE = 834;
const CONFIRM = BASE + 40;
const NO_MODS = BASE + 43;
/** checkbox control id for a gv_modifiervote id, at a given dialog base */
const BOX_ORDER = [13, 1, 3, 4, 2, 10, 11, 6, 12, 5, 7, 8, 9];
const box = (id: number, base = BASE) => base + BOX_ORDER.indexOf(id) * 3;

/** one player ticking `ids` and confirming */
function ballot(user: number, ids: number[], base = BASE): ModifierEvent[] {
	return [
		...ids.map((id) => ({ user, control: box(id, base), type: 1, checked: true })),
		{ user, control: base + 40, type: 0 }
	];
}

test('the dialog base is derived from where the checkboxes sit', () => {
	assert.equal(deriveBase(ballot(0, [1, 4, 12])), BASE);
	// and it follows the dialog when the map numbers it differently
	assert.equal(deriveBase(ballot(0, [1, 4], 840)), 840);
});

test('the confirm button is told from "no modifiers" by who ticked', () => {
	// a lobby that unanimously ticks one box leaves a single checkbox, which
	// fits both buttons — the tickers' own confirm click is what breaks it
	const events: ModifierEvent[] = [
		...ballot(0, [1]),
		...ballot(1, [1]),
		{ user: 2, control: NO_MODS, type: 0 }
	];
	assert.equal(deriveBase(events), BASE);
	assert.deepEqual(tallyModifiers(events, 4, 4), [1]);
});

test('with nothing ticked there is no dialog to place, and no modifiers', () => {
	assert.equal(deriveBase([{ user: 0, control: NO_MODS, type: 0 }]), null);
	assert.deepEqual(tallyModifiers([{ user: 0, control: NO_MODS, type: 0 }], 4, 4), []);
});

test('half the lobby carries a modifier — a majority is not needed', () => {
	// 5 of 10 is half, and the map asks for >= not >
	const events = [0, 1, 2, 3, 4].flatMap((u) => ballot(u, [1]));
	assert.deepEqual(tallyModifiers(events, 10, 4), [1]);
	// 4 of 10 is short
	const fewer = [0, 1, 2, 3].flatMap((u) => ballot(u, [1]));
	assert.deepEqual(tallyModifiers(fewer, 10, 4), []);
});

test('several modifiers can carry at once', () => {
	const events = [0, 1, 2, 3].flatMap((u) => ballot(u, [1, 4, 12]));
	assert.deepEqual(tallyModifiers(events, 6, 4), [1, 4, 12]);
});

test('unticking before confirming takes the vote back', () => {
	const events: ModifierEvent[] = [
		{ user: 0, control: box(1), type: 1, checked: true },
		{ user: 0, control: box(12), type: 1, checked: true },
		{ user: 0, control: box(1), type: 1, checked: false },
		{ user: 0, control: CONFIRM, type: 0 },
		...ballot(1, [12])
	];
	// Outbreak was reached for and put back, so only Infested is on the ballot
	assert.deepEqual(tallyModifiers(events, 2, 4), [12]);
});

test('"no modifiers" is a ballot, and the buttons go dead after one', () => {
	const events: ModifierEvent[] = [
		{ user: 0, control: box(1), type: 1, checked: true },
		{ user: 0, control: NO_MODS, type: 0 },
		{ user: 0, control: CONFIRM, type: 0 }, // ignored — already voted
		...ballot(1, [1])
	];
	// one for, one against, in a two-player lobby: threshold is 1, so it carries
	assert.deepEqual(tallyModifiers(events, 2, 4), [1]);
});

test('Tier 1 is refused on a ballot that also asks for Outbreak', () => {
	const events = [0, 1].flatMap((u) => ballot(u, [1, 3]));
	assert.deepEqual(tallyModifiers(events, 2, 4), [1]);
	// on its own it carries
	const alone = [0, 1].flatMap((u) => ballot(u, [3]));
	assert.deepEqual(tallyModifiers(alone, 2, 4), [3]);
});

test('1 life needs three players', () => {
	assert.deepEqual(tallyModifiers([0, 1].flatMap((u) => ballot(u, [4])), 2, 4), []);
	assert.deepEqual(tallyModifiers([0, 1, 2].flatMap((u) => ballot(u, [4])), 3, 4), [4]);
});

test('the training options only count when training mode itself is ticked', () => {
	// the map hides and force-unchecks them otherwise, without an event
	const without = [0, 1].flatMap((u) => ballot(u, [7, 8]));
	assert.deepEqual(tallyModifiers(without, 2, 4), []);
	const with_ = [0, 1].flatMap((u) => ballot(u, [5, 7, 8]));
	assert.deepEqual(tallyModifiers(with_, 2, 4), [5, 7, 8]);
});

test('Rifle beats Sushis beats Classical', () => {
	const all = [0, 1].flatMap((u) => ballot(u, [2, 10, 11]));
	assert.deepEqual(tallyModifiers(all, 2, 4), [2]);
	const noRifle = [0, 1].flatMap((u) => ballot(u, [10, 11]));
	assert.deepEqual(tallyModifiers(noRifle, 2, 4), [10]);
	const onlyClassical = [0, 1].flatMap((u) => ballot(u, [11]));
	assert.deepEqual(tallyModifiers(onlyClassical, 2, 4), [11]);
});

test('Sushis is off the table on the special modes', () => {
	// the map gates it on gv_gamemode < 6, and falls through to Classical
	const events = [0, 1].flatMap((u) => ballot(u, [10, 11]));
	assert.deepEqual(tallyModifiers(events, 2, 8), [11]);
});

test('no ballots at all means no modifiers, not a guess', () => {
	assert.deepEqual(tallyModifiers([], 8, 4), []);
});
