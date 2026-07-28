/** Unit tests for the page title/description templates (npm test). */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	DESC_MAX,
	GAME,
	HOME_TITLE,
	clampText,
	clanDescription,
	fullTitle,
	mosDescription,
	playerDescription,
	tooltipProse,
	unitDescription
} from '../src/lib/seo.ts';

const unit = {
	id: 'AA12',
	name: 'AA-12',
	category: 'item / equipment',
	role: '',
	life: null,
	armor: null,
	weapons: [{}],
	tooltip: ''
};

test('fullTitle leads with the page, and the homepage with the brand', () => {
	assert.equal(fullTitle(), HOME_TITLE);
	assert.equal(fullTitle('AA-12'), 'AA-12 — Undead Assault Reborn unit database');
	// an empty title is the homepage's case, not a page called ""
	assert.equal(fullTitle(''), HOME_TITLE);
});

test('clampText cuts on a word and marks the cut', () => {
	assert.equal(clampText('short enough'), 'short enough');
	const long = 'word '.repeat(60);
	const cut = clampText(long);
	assert.ok(cut.length <= DESC_MAX);
	assert.ok(cut.endsWith('…'));
	assert.ok(!cut.includes('  '), 'collapses runs of whitespace');
});

test('clampText takes a hard cut rather than losing most of the budget', () => {
	const cut = clampText('x'.repeat(300), 20);
	assert.equal(cut.length, 20);
	assert.ok(cut.endsWith('…'));
});

test('clampText flattens the newlines of a template literal', () => {
	assert.equal(clampText('one\n\ttwo   three'), 'one two three');
});

test('tooltipProse drops the MOS/rank header the page already shows', () => {
	const tip =
		'MOS: 11B (Infantry) Role: Automatic Rifleman\n' +
		'Enlisted - Warrant Officer - Comissionned Officer\n' +
		'The automatic rifleman provides fire support.';
	assert.equal(tooltipProse(tip), 'The automatic rifleman provides fire support.');
});

test('tooltipProse leaves a tooltip that is prose all the way down', () => {
	const tip = 'The Armored Personnel Carrier is a medium vehicle.';
	assert.equal(tooltipProse(tip), tip);
});

test('tooltipProse survives a tooltip that is nothing but header', () => {
	assert.equal(tooltipProse('MOS: 18O Role: Cyborg\nEnlisted'), '');
	assert.equal(tooltipProse(''), '');
});

test('unitDescription names the entity and what it is', () => {
	const d = unitDescription(unit);
	assert.ok(d.startsWith('AA-12 — item in ' + GAME + '.'), d);
	assert.ok(d.length <= DESC_MAX);
});

test('unitDescription falls back to the stat line without prose', () => {
	const turret = {
		...unit,
		name: 'Sentry Gun',
		category: 'deployable / drone',
		role: 'Automated Turret',
		life: 1200,
		armor: 2,
		weapons: [{}, {}]
	};
	const d = unitDescription(turret);
	assert.ok(d.includes('deployable'), d);
	assert.ok(d.includes('1,200 life'), d);
	assert.ok(d.includes('2 armor'), d);
	assert.ok(d.includes('2 weapons'), d);
});

test('unitDescription prefers the map’s own prose over the stat line', () => {
	const d = unitDescription({ ...unit, life: 500, tooltip: 'A drum-fed combat shotgun.' });
	assert.ok(d.includes('A drum-fed combat shotgun.'), d);
	assert.ok(!d.includes('500 life'), d);
});

test('unitDescription falls back to the id for an unnamed entity', () => {
	assert.ok(unitDescription({ ...unit, name: '' }).startsWith('AA12 — '));
});

test('unitDescription names an unknown category generically', () => {
	assert.ok(unitDescription({ ...unit, category: 'something new' }).includes('— entity in'));
});

test('mosDescription carries the MOS code when it differs from the name', () => {
	const mos = {
		id: 'AutomaticRifleman',
		name: 'Automatic Rifleman',
		mos: '11B',
		role: 'Automatic Rifleman',
		life: 420,
		armor: 1,
		weapons: [{}],
		skills: [{}, {}, {}],
		tooltip: ''
	};
	const d = mosDescription(mos);
	assert.ok(d.startsWith('Automatic Rifleman (MOS 11B) — player class in'), d);
	assert.ok(d.includes('3 skills'), d);
	// a class whose code *is* its name should not say it twice
	assert.ok(!mosDescription({ ...mos, mos: 'Automatic Rifleman' }).includes('(MOS'));
});

test('playerDescription counts games and mentions a clan only when there is one', () => {
	const p = { name: 'Znimu', clan: 'UAR', gamesPlayed: 1200, prestige: 2, wins: 340 };
	const d = playerDescription(p);
	assert.ok(d.startsWith('Znimu of <UAR> —'), d);
	assert.ok(d.includes('1,200 games'), d);
	assert.ok(d.includes('prestige 2'), d);
	assert.ok(playerDescription({ ...p, clan: '' }).startsWith('Znimu — '));
	assert.ok(playerDescription({ ...p, prestige: 0 }).includes('prestige') === false);
	assert.ok(playerDescription({ ...p, gamesPlayed: 1 }).includes('1 game ·'));
});

test('clanDescription counts members and games', () => {
	const d = clanDescription({ tag: 'UAR', members: 12, games: 3400, wins: 900 });
	assert.ok(d.startsWith('<UAR> —'), d);
	assert.ok(d.includes('12 members'), d);
	assert.ok(d.includes('3,400 games'), d);
	assert.ok(clanDescription({ tag: 'X', members: 1, games: 0, wins: 0 }).includes('1 member ·'));
});
