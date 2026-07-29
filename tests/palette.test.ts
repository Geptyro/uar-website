/** Unit tests for the command palette's row model and ranking (npm test). */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	entityRows,
	mosRows,
	pageRows,
	playerRows,
	rankRows,
	shortCategory,
	siRows,
	step,
	type PaletteRow
} from '../src/lib/palette.ts';

const row = (over: Partial<PaletteRow>): PaletteRow => ({
	kind: 'entity',
	id: 'x',
	href: '/x',
	label: 'X',
	...over
});

const labels = (rows: PaletteRow[]) => rows.map((r) => r.label);

test('a prefix beats a word start, which beats a match mid-word', () => {
	const rows = [
		row({ id: 'c', label: 'Ripsniper' }),
		row({ id: 'b', label: 'Undead Sniper' }),
		row({ id: 'a', label: 'Sniper' })
	];
	assert.deepEqual(labels(rankRows(rows, 'snip')), ['Sniper', 'Undead Sniper', 'Ripsniper']);
});

test('the label outranks an alias, however well the alias matches', () => {
	const rows = [
		row({ id: 'a', label: 'Zealot', alias: ['SiegeTank'] }),
		row({ id: 'b', label: 'Siege engine' })
	];
	assert.deepEqual(labels(rankRows(rows, 'siege')), ['Siege engine', 'Zealot']);
});

test('among equal matches a page comes before a class, and a class before an entity', () => {
	const rows = [
		row({ kind: 'entity', id: 'a', label: 'Medic drone' }),
		row({ kind: 'page', id: 'b', label: 'Medic pages' }),
		row({ kind: 'mos', id: 'c', label: 'Medic class' })
	];
	assert.deepEqual(
		rankRows(rows, 'medic').map((r) => r.kind),
		['page', 'mos', 'entity']
	);
});

test('among equals the shorter name wins', () => {
	const rows = [
		row({ id: 'a', label: 'Sniper Rifle Ammo Crate' }),
		row({ id: 'b', label: 'Sniper Rifle' })
	];
	assert.deepEqual(labels(rankRows(rows, 'sniper')), ['Sniper Rifle', 'Sniper Rifle Ammo Crate']);
});

test('folds case and accents', () => {
	const rows = [row({ label: 'Détecteur' })];
	assert.equal(rankRows(rows, 'DETEC').length, 1);
});

test('an empty or blank query matches nothing — the caller shows its own default', () => {
	const rows = [row({ label: 'Sniper' })];
	assert.deepEqual(rankRows(rows, ''), []);
	assert.deepEqual(rankRows(rows, '   '), []);
});

test('honours the limit', () => {
	const rows = Array.from({ length: 30 }, (_, i) => row({ id: `u${i}`, label: `Undead ${i}` }));
	assert.equal(rankRows(rows, 'undead', 7).length, 7);
});

test('step wraps at both ends and survives an empty list', () => {
	assert.equal(step(0, -1, 5), 4);
	assert.equal(step(4, 1, 5), 0);
	assert.equal(step(0, 1, 0), 0);
});

test('shortCategory folds the long category names, and passes others through', () => {
	assert.equal(shortCategory('undead / hostile'), 'hostile');
	assert.equal(shortCategory('item / equipment'), 'item');
	assert.equal(shortCategory('projectile'), 'projectile');
	assert.equal(shortCategory('brand / new category'), 'brand');
});

test('an unnamed entity falls back to its id, and a named one keeps the id as an alias', () => {
	const [named, unnamed] = entityRows([
		{ i: 'SiegeTank', n: 'AMX S-880', c: 'class', p: '/icons/tank.png' },
		{ i: 'DoodadRock', n: '', c: 'prop' }
	]);
	assert.equal(named.label, 'AMX S-880');
	assert.deepEqual(named.alias, ['SiegeTank']);
	assert.equal(named.href, '/entities/SiegeTank');
	assert.equal(named.icon, '/icons/tank.png');

	assert.equal(unnamed.label, 'DoodadRock');
	assert.equal(unnamed.icon, null);
	// searching the id still finds it — via the label, which *is* the id
	assert.equal(rankRows([unnamed], 'doodad').length, 1);
});

test('an id with a slash in it survives the round trip into an href', () => {
	const [r] = entityRows([{ i: 'Weird/Id', n: 'Weird', c: 'prop' }]);
	assert.equal(r.href, '/entities/Weird%2FId');
});

test('a class matches on its in-game code and on its role', () => {
	const rows = mosRows([
		{ id: 'AlligatorLK19', name: 'Alligator LK19', mos: 'LK19', role: 'Combat Helicopter', icon: null }
	]);
	assert.equal(rows[0].href, '/mos/AlligatorLK19');
	assert.equal(rows[0].note, 'LK19');
	assert.equal(rankRows(rows, 'helicopter').length, 1);
	assert.equal(rankRows(rows, 'lk19').length, 1);
});

test('an SI deep-links to its card and matches on its code', () => {
	const rows = siRows([{ num: 1, name: 'Reactive Fire', code: 'RF', icon: null }]);
	assert.equal(rows[0].href, '/si#si-1');
	assert.equal(rankRows(rows, 'rf').length, 1);
});

test('a page matches on an alias the label does not carry', () => {
	const rows = pageRows([{ href: '/players', label: 'Players', alias: ['leaderboard'] }]);
	assert.equal(rankRows(rows, 'leaderboard').length, 1);
	assert.equal(rows[0].href, '/players');
});

test('a player row shows the clan tag, and falls back to the toon when unnamed', () => {
	const rows = playerRows([
		{ toon: '2-S2-1-123', name: 'Znimu', clan: 'UAR', avatarUrl: '/a.png' },
		{ toon: '2-S2-1-999', name: '' }
	]);
	assert.equal(rows[0].href, '/players/2-S2-1-123');
	assert.equal(rows[0].note, '<UAR>');
	assert.equal(rows[1].label, '2-S2-1-999');
	assert.equal(rows[1].note, 'player');
	assert.equal(rows[1].icon, null);
});
