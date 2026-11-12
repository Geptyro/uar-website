/** Unit tests for the sign-in return path (npm test). */

import test from 'node:test';
import assert from 'node:assert/strict';
import { safeNext, signInHref } from '../src/lib/signin.ts';

test('safeNext keeps a path on this site', () => {
	assert.equal(safeNext('/mos/CombatEngineer/guides/the-combat-engineer-played'), '/mos/CombatEngineer/guides/the-combat-engineer-played');
	assert.equal(safeNext('/players/2-S2-1-123?tab=games#top'), '/players/2-S2-1-123?tab=games#top');
});

test('safeNext refuses anything that leaves the site or loops', () => {
	for (const bad of [
		null,
		undefined,
		'',
		'https://evil.example/x',
		'//evil.example/x',
		'/\\evil.example/x',
		'\\\\evil.example',
		'javascript:alert(1)',
		'mos/relative',
		'/auth/bnet',
		'/auth/bnet/callback?code=x',
		'/auth',
		'/x\nSet-Cookie: a=b',
		'/' + 'a'.repeat(600)
	]) {
		assert.equal(safeNext(bad), null, String(bad));
	}
});

test('signInHref carries the path, or none when it is not safe', () => {
	assert.equal(signInHref('/mos/Medic/guides/x'), '/auth/bnet?next=%2Fmos%2FMedic%2Fguides%2Fx');
	assert.equal(signInHref('//evil.example'), '/auth/bnet');
});
