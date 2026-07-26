/** Unit tests for the weapon-jam probability model (npm test). */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jamChance, jamChanceRange, oddsAfter, shotsPerJam, type PityStep } from '../src/lib/jam.ts';

// the map's table: risk climbs the longer a player goes without jamming
const PITY: PityStep[] = [
	{ after: 100, odds: 5 },
	{ after: 90, odds: 6 },
	{ after: 80, odds: 8 },
	{ after: 70, odds: 11 },
	{ after: 60, odds: 15 },
	{ after: 50, odds: 20 }
];
const DEFAULT_ODDS = 30;

const odds = (seconds: number) => oddsAfter(PITY, DEFAULT_ODDS, seconds);

test('odds follow the trigger chain, taking the highest matching step', () => {
	assert.equal(odds(0), 30);
	assert.equal(odds(50), 30, 'the step needs > 50, not >=');
	assert.equal(odds(50.1), 20);
	assert.equal(odds(65), 15);
	assert.equal(odds(95), 6);
	assert.equal(odds(100), 6, 'still the 90s step exactly at 100');
	assert.equal(odds(101), 5);
	assert.equal(odds(10_000), 5, 'risk stops climbing at the last step');
});

test('a shot needs both rolls, so the chance is the product of the two', () => {
	// RandomInt(0, N) has N+1 outcomes, hence the +1 on each side
	assert.equal(jamChance(60, 30), 1 / 61 / 31);
	assert.equal(jamChance(60, 5), 1 / 61 / 6);
});

test('smaller magazines jam more often per shot', () => {
	const sdm = jamChance(35, 5); // Squad Designated Marksman
	const rifleman = jamChance(60, 5);
	assert.ok(sdm > rifleman);
	assert.equal(Math.round((sdm / rifleman) * 100) / 100, 1.69);
});

test('the range spans just-jammed to pity-capped', () => {
	const { min, max } = jamChanceRange(60, PITY, DEFAULT_ODDS);
	assert.equal(min, jamChance(60, 30));
	assert.equal(max, jamChance(60, 5));
	assert.ok(max > min);
});

test('expected shots between jams inverts the chance', () => {
	assert.equal(Math.round(shotsPerJam(jamChance(60, 5))), 366);
	assert.equal(shotsPerJam(0), Infinity);
});
