/**
 * Unit tests for what this site puts in the command palette (npm test).
 *
 * The ranking and the keyboard rules moved to `sveltekit-commons/palette` and
 * are tested there. What is left here is the mapping onto its row model — and
 * one test that the weights those builders assign still produce the order the
 * palette is meant to have, since that is the part a reader notices.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankRows, type PaletteRow } from 'sveltekit-commons/palette';
import {
	browseRows,
	entityRows,
	mosRows,
	pageRows,
	playerRows,
	shortCategory,
	siRows,
	triggerRows
} from '../src/lib/palette.ts';

const labels = (rows: PaletteRow[]) => rows.map((r) => r.label);

test('among equal matches a page comes before a class, and a class before an entity', () => {
	const rows = [
		...entityRows([{ i: 'MedicDrone', n: 'Medic drone', c: 'deployable' }]),
		...pageRows([{ href: '/medic', label: 'Medic pages' }]),
		...mosRows([{ id: 'Medic', name: 'Medic class', mos: '', role: '', icon: null }])
	];
	assert.deepEqual(
		rankRows(rows, 'medic').map((r) => r.kind),
		['page', 'mos', 'entity']
	);
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
		{
			id: 'AlligatorLK19',
			name: 'Alligator LK19',
			mos: 'LK19',
			role: 'Combat Helicopter',
			icon: null
		}
	]);
	assert.equal(rows[0].href, '/mos/AlligatorLK19');
	assert.equal(rows[0].note, 'LK19');
	assert.equal(rankRows(rows, 'helicopter').length, 1);
	assert.equal(rankRows(rows, 'lk19').length, 1);
});

test('a class with a vehicle gets a row for it, pointing at its vehicle tab', () => {
	const rows = mosRows([
		{
			id: 'AssaultEngineer',
			name: 'Assault Engineer',
			mos: '12H',
			role: 'Assault Engineer',
			icon: null,
			vehicle: { id: 'Goliath2', name: 'Predator', icon: '/icons/predator.png' }
		}
	]);
	assert.equal(rows.length, 2);
	assert.equal(rows[1].href, '/mos/AssaultEngineer/predator');
	assert.equal(rows[1].label, 'Predator');
	assert.equal(rankRows(rows, 'predator')[0]?.href, '/mos/AssaultEngineer/predator');
});

test('an SI deep-links to its card and matches on its code', () => {
	const rows = siRows([{ num: 1, name: 'Reactive Fire', code: 'RF', icon: null }]);
	assert.equal(rows[0].href, '/career/si#si-1');
	assert.equal(rankRows(rows, 'rf').length, 1);
});

test('a page matches on an alias the label does not carry, and carries the sidebar mark', () => {
	const rows = pageRows([
		{ href: '/players', label: 'Players', alias: ['leaderboard'], icon: '<svg/>' }
	]);
	assert.equal(rankRows(rows, 'leaderboard').length, 1);
	assert.equal(rows[0].href, '/players');
	assert.equal(rows[0].glyph, '<svg/>');
});

test('a player row shows the clan tag, and falls back to the toon when unnamed', () => {
	const rows = playerRows([
		{ toon: '2-S2-1-123', name: 'Znimu', clan: 'UAR', avatarUrl: '/a.png' },
		{ toon: '2-S2-1-999', name: '' }
	]);
	assert.equal(rows[0].href, '/players/2-S2-1-123');
	assert.equal(rows[0].note, '<UAR>');
	assert.ok(rows[0].round, 'a portrait is a face, so it is drawn round');
	assert.equal(rows[1].label, '2-S2-1-999');
	assert.equal(rows[1].note, 'player');
	assert.equal(rows[1].icon, null);
});

test('the browse rows carry the typed term through to the list pages', () => {
	const rows = browseRows('  sniper rifle  ');
	assert.deepEqual(
		rows.map((r) => r.href),
		['/entities?q=sniper%20rifle', '/players?q=sniper%20rifle']
	);
	assert.ok(rows.every((r) => r.muted));
	assert.deepEqual(labels(rows), [
		'All entities matching “sniper rifle”',
		'All players matching “sniper rifle”'
	]);
});

test('nothing typed is nothing to browse', () => {
	assert.deepEqual(browseRows('   '), []);
});

test('trigger group rows link to the group and answer to their outcomes and triggers', () => {
	const rows = triggerRows(
		[{ g: 'mule', n: 'MULE', t: 'mechanic', k: 4, a: ['EngineersActivatetheMULE'] }],
		'<svg/>'
	);
	assert.equal(rows[0].href, '/triggers/mule');
	assert.equal(rows[0].note, 'mechanic · 4 triggers');
	assert.deepEqual(labels(rankRows(rows, 'activate', 5)), ['MULE']);
});
