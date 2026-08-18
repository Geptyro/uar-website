import test from 'node:test';
import assert from 'node:assert/strict';
import { hasFailed } from '../src/lib/portrait.ts';

// $lib/portrait re-exports uar-shared/portrait, so this also guards the
// installed shared package: a bad publish fails here rather than in a browser.

/** Minimal stand-in for the parts of HTMLImageElement `hasFailed` reads. */
function img(src: string | null, complete: boolean, naturalWidth: number) {
	return { complete, naturalWidth, getAttribute: () => src };
}

test('a portrait that loaded is not a failure', () => {
	assert.equal(hasFailed(img('https://static.starcraft2.com/x/15-0.jpg', true, 95)), false);
});

test('a portrait still loading is not yet a failure', () => {
	assert.equal(hasFailed(img('https://static.starcraft2.com/x/16-6.jpg', false, 0)), false);
});

test('a portrait that finished with no pixels has failed', () => {
	// exoris: Blizzard hands out sheet 16, which it never published (403).
	assert.equal(hasFailed(img('https://static.starcraft2.com/x/16-6.jpg', true, 0)), true);
});

test('an <img> with no src is an empty slot, not a failure', () => {
	// Guards the breadcrumb icon, which renders src={undefined} off a profile.
	assert.equal(hasFailed(img(null, true, 0)), false);
	assert.equal(hasFailed(img('', true, 0)), false);
});

test('falls back to the src property when getAttribute is absent', () => {
	assert.equal(hasFailed({ complete: true, naturalWidth: 0, src: '/a.jpg' }), true);
	assert.equal(hasFailed({ complete: true, naturalWidth: 0, src: '' }), false);
});
