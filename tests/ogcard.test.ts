/** Unit tests for the share-card model (npm test). */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	displayName,
	entityCard,
	firstSentence,
	fitText,
	mosCard,
	wrapText
} from '../src/lib/ogcard.ts';

const unit = {
	id: 'AA12',
	name: 'AA-12',
	category: 'item / equipment',
	role: '',
	life: null,
	armor: null,
	speed: null,
	weapons: [],
	icon: '/icons/btnaa12.png',
	tooltip: ''
};

test('displayName strips the SC2 markup a few names carry', () => {
	assert.equal(
		displayName('<s val="ModCenterSize16">Outlaw deployment phantom.</s>'),
		'Outlaw deployment phantom.'
	);
	assert.equal(displayName('AA-12'), 'AA-12');
	assert.equal(displayName('  spaced   out '), 'spaced out');
	assert.equal(displayName('<s val="x"></s>'), '');
});

test('fitText keeps short text at full size', () => {
	assert.deepEqual(fitText('AA-12', 720, { max: 72, min: 30, em: 0.6 }), {
		text: 'AA-12',
		size: 72
	});
});

test('fitText shrinks rather than cuts while it can', () => {
	const r = fitText('DestructibleGateStraightHorizontal', 720, { max: 72, min: 30, em: 0.6 });
	assert.equal(r.text, 'DestructibleGateStraightHorizontal');
	assert.ok(r.size < 72 && r.size >= 30);
	// the estimate must actually fit the box it was given
	assert.ok(r.text.length * r.size * 0.6 <= 720);
});

test('fitText cuts once shrinking would go past the floor', () => {
	const r = fitText('x'.repeat(200), 720, { max: 72, min: 30, em: 0.6 });
	assert.equal(r.size, 30);
	assert.ok(r.text.endsWith('…'));
	assert.ok(r.text.length * r.size * 0.6 <= 720);
});

test('wrapText breaks on words and fills the lines it has', () => {
	const lines = wrapText('one two three four five six seven eight', 200, 20, 0.5, 2);
	assert.ok(lines.length <= 2);
	assert.ok(lines.every((l) => l.length <= 20));
	assert.ok(!lines.some((l) => l.startsWith(' ') || l.endsWith(' ')));
});

test('wrapText marks the cut only when there was more to say', () => {
	const cut = wrapText('alpha bravo charlie delta echo foxtrot golf hotel india', 200, 20, 0.5, 2);
	assert.ok(cut[cut.length - 1].endsWith('…'), cut.join(' | '));
	const whole = wrapText('alpha bravo', 200, 20, 0.5, 2);
	assert.deepEqual(whole, ['alpha bravo']);
});

test('wrapText survives a single word longer than the line', () => {
	const lines = wrapText('Supercalifragilisticexpialidocious', 100, 20, 0.5, 2);
	assert.equal(lines.length, 1);
	assert.ok(lines[0].endsWith('…'));
	assert.ok(lines[0].length <= 10);
});

test('wrapText on empty prose gives no lines', () => {
	assert.deepEqual(wrapText('', 200, 20, 0.5, 2), []);
});

test('firstSentence stops at the first full stop', () => {
	assert.equal(firstSentence('One thing. Then another.'), 'One thing.');
	assert.equal(firstSentence('No stop here'), 'No stop here');
	// a decimal is not the end of a sentence
	assert.equal(firstSentence('Deals 2.5 damage per shot. Then reloads.'), 'Deals 2.5 damage per shot.');
});

test('entityCard reads the category as an eyebrow and the stats as chips', () => {
	const card = entityCard(
		{ ...unit, category: 'undead / hostile', life: 12000, armor: 5, weapons: [{}, {}] },
		'It shambles.'
	);
	assert.equal(card.eyebrow, 'UNDEAD');
	assert.equal(card.name, 'AA-12');
	assert.equal(card.prose, 'It shambles.');
	assert.deepEqual(card.chips, ['12,000 life', '5 armor', '2 weapons']);
	assert.equal(card.icon, '/icons/btnaa12.png');
});

test('entityCard leaves out the stats the entity has none of', () => {
	assert.deepEqual(entityCard(unit, '').chips, []);
	assert.equal(entityCard({ ...unit, category: 'brand new' }, '').eyebrow, 'BRAND NEW');
	assert.equal(entityCard({ ...unit, name: '' }, '').name, 'AA12');
});

test('mosCard leads with the MOS code where the class has one', () => {
	const mos = {
		id: 'AutomaticRifleman',
		name: 'Automatic Rifleman',
		mos: '11B',
		role: 'Automatic Rifleman',
		life: 420,
		armor: 1,
		weapons: [{}],
		skills: [{}, {}],
		icon: null,
		tooltip: ''
	};
	const card = mosCard(mos, 'Provides fire support.');
	assert.equal(card.eyebrow, 'MOS 11B');
	assert.deepEqual(card.chips, ['Automatic Rifleman', '420 life', '1 armor', '2 skills']);
	assert.equal(mosCard({ ...mos, mos: '' }, '').eyebrow, 'PLAYER CLASS');
});
