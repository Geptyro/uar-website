/**
 * Search-term escaping (node:test, `npm test`).
 *
 * The leaderboard search became a Mongo `$regex` when sorting and paging moved
 * into the database, so a player typing regex punctuation must still get a
 * literal substring match — and must not be able to hand the database a
 * pattern of their own.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeRegex } from '../src/lib/search.ts';

test('regex metacharacters survive as literals', () => {
	// a real clan tag on the site is non-ASCII; punctuation in names is common
	for (const [term, subject] of [
		['a.b', 'a.b'],
		['x(y)', 'x(y)'],
		['50%+', '50%+'],
		['C++', 'C++'],
		['[iSAR]', '[iSAR]'],
		['a|b', 'a|b'],
		['back\\slash', 'back\\slash']
	]) {
		assert.match(subject, new RegExp(escapeRegex(term)), `${term} should match itself`);
	}
});

test('a metacharacter does not match what it would as a pattern', () => {
	// unescaped, "a.c" matches "abc" — that is the bug this prevents
	assert.doesNotMatch('abc', new RegExp(escapeRegex('a.c')));
	assert.doesNotMatch('aaa', new RegExp(escapeRegex('a+')));
	assert.doesNotMatch('anything', new RegExp(escapeRegex('.*')));
});

test('ordinary terms are left alone', () => {
	assert.equal(escapeRegex('Znimu'), 'Znimu');
	assert.equal(escapeRegex('2-S2-1-1288335'), '2-S2-1-1288335');
	assert.equal(escapeRegex(''), '');
});
