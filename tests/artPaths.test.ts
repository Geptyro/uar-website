/**
 * Which paths the production server caches for a month.
 *
 * Worth asserting rather than eyeballing, because both ways of being wrong are
 * silent. Too narrow and art quietly ships with no policy at all — which is
 * exactly what happened to the 479 share cards filed under /og/entities/, since
 * the first pattern matched only a single path segment. Too broad and a page or
 * an API response gets told it may be kept for a month, which no test of the
 * art paths alone would ever notice.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isArtPath, ART_CACHE_CONTROL } from '../artPaths.js';

const CACHED = [
	'/icons/btn-amx-tank.png',
	'/camos/armour-invasion2.png',
	'/map/minimap.png',
	'/models/ah42.glb',
	'/og/site.png',
	// filed per subject — the case the first pattern missed
	'/og/entities/40mmGrenade.png',
	'/og/mos/Medic.png'
];

const NOT_CACHED = [
	'/',
	'/replays',
	'/players/2-S2-1-1248928/replays',
	'/api/replays',
	'/api/ready',
	// sirv gives the hashed assets a year of its own; this must not shorten it
	'/_app/immutable/entry/app.CWLK4_JX.js',
	// only the art directories, not everything that happens to be a png
	'/favicon-32.png',
	'/icon-512.png',
	// a directory is not a file
	'/og/entities/'
];

test('generated art is cached', () => {
	for (const p of CACHED) assert.ok(isArtPath(p), `${p} should be cached`);
});

test('pages, API routes and hashed assets are not', () => {
	for (const p of NOT_CACHED) assert.ok(!isArtPath(p), `${p} must NOT be cached`);
});

test('a query string does not lose the policy', () => {
	// a cache-busting suffix must not drop the response to no policy at all
	assert.ok(isArtPath('/icons/btn-amx-tank.png?v=2'));
	assert.ok(isArtPath('/og/entities/40mmGrenade.png?v=2'));
});

test('missing url is handled rather than thrown on', () => {
	assert.equal(isArtPath(undefined), false);
	assert.equal(isArtPath(''), false);
});

test('the policy revalidates rather than claiming immutability', () => {
	// these filenames are stable but their content is regenerated, so a refresh
	// has to be able to reach a browser that already holds one
	assert.match(ART_CACHE_CONTROL, /must-revalidate/);
	assert.doesNotMatch(ART_CACHE_CONTROL, /immutable/);
});
