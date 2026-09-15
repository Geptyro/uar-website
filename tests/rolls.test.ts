/** Unit tests for the roll model (lib/rolls) against the extracted ailment rules (npm test). */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ailmentChain, every, globalN, pct, type AilmentRules } from '../src/lib/rolls.ts';
import type { Effect } from '../src/lib/effects.ts';

const data = (f: string) => JSON.parse(readFileSync(new URL(`../src/lib/data/${f}`, import.meta.url), 'utf8'));
const rules: AilmentRules = data('ailment-rules.json');
const effects: Effect[] = data('behaviors.json');
const ailments = effects.filter((e) => e.ailment);
const byId = (id: string) => effects.find((e) => e.id === id)!;
const NORMAL = 2;
const APOCALYPSE = 12;

test('the global roll follows the mode, not the script default', () => {
	assert.equal(globalN(rules, 1), 10, 'Recruit keeps 1 in 10');
	assert.equal(globalN(rules, NORMAL), 9);
	assert.equal(globalN(rules, APOCALYPSE), 5);
});

test('the first ailment in the loop lands on its own roll', () => {
	const c = ailmentChain(byId('MinorLacerations'), rules, ailments, NORMAL)!;
	assert.equal(c.route, 'order');
	assert.equal(c.afterGlobal, 1 / 4);
	assert.equal(c.perHit, 1 / 9 / 4);
});

test('a later ailment needs every roll above it to miss', () => {
	const c = ailmentChain(byId('InfectedBite'), rules, ailments, NORMAL)!;
	// Minor Lacerations 1/4, four at 1/5, Energy Leak 1/6, then Infected Bite 1/5
	const reach = (3 / 4) * (4 / 5) ** 4 * (5 / 6);
	assert.ok(Math.abs(c.afterGlobal - reach / 5) < 1e-12);
	assert.ok(Math.abs(c.perHit - reach / 5 / 9) < 1e-12);
	assert.equal(pct(c.perHit), '0.57%');
	assert.equal(c.order!.target.need.some((g) => g.kind === 'sourceSide'), true, 'only from the undead');
});

test('the venoms are a coin flip among two after the global roll', () => {
	const c = ailmentChain(byId('NecroticVenom'), rules, ailments, APOCALYPSE)!;
	assert.equal(c.route, 'pick');
	assert.equal(c.pick!.among.length, 2);
	assert.equal(c.perHit, 1 / 5 / 2);
});

test('Infected Bite kills on 33% of the times it runs out, and a Risen spawns', () => {
	const o = byId('InfectedBite').outcomes!;
	assert.equal(o.length, 1);
	assert.equal(o[0].when, 'expire');
	assert.equal(o[0].chance, 0.33);
	assert.equal(o[0].kills, true);
	assert.equal(o[0].spawns?.[0].id, 'Risen');
});

test('chances read as people say them', () => {
	assert.equal(pct(0.33), '33%');
	assert.equal(pct(0.0512), '5.1%');
	assert.equal(pct(0.005689), '0.57%');
});

test('a small chance also reads as how often', () => {
	assert.equal(every(0.005689), '1 every 176');
	assert.equal(every(0.005689 * 0.33), '1 every 533');
	assert.equal(every(0), 'never');
});
