import test from 'node:test';
import assert from 'node:assert/strict';
import { isRankKey, mosTracks, siTracks } from '../src/lib/ranks.ts';

test('an SI is sold on the tracks whose threshold is not zero; free and achievement unlocks count', () => {
	assert.deepEqual(siTracks({ en: 600, wo: 1, co: 1 }), ['en', 'wo', 'co']);
	assert.deepEqual(siTracks({ en: 0, wo: 4000, co: 8000 }), ['wo', 'co']);
	assert.deepEqual(siTracks({ en: 0, wo: 0, co: 15000 }), ['co']);
	assert.deepEqual(siTracks({ en: -1, wo: -1, co: -1 }), ['en', 'wo', 'co']);
});

test('a class is open to the tracks its unlock names, and to all when it has none', () => {
	assert.deepEqual(mosTracks({ en: { xp: 0 }, wo: null, co: null }), ['en']);
	assert.deepEqual(mosTracks({ en: null, wo: null, co: { xp: 90000 } }), ['co']);
	assert.deepEqual(mosTracks(undefined), ['en', 'wo', 'co']);
	assert.deepEqual(mosTracks(null), ['en', 'wo', 'co']);
	assert.equal(isRankKey('wo'), true);
	assert.equal(isRankKey('nco'), false);
});
