/** Unit tests for the server's portrait check (npm test). */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
	deadPortraits,
	dropDeadPortraits,
	forgetPortraitVerdicts,
	portraitAlive
} from '../src/lib/server/portraits.ts';

const CDN = 'https://static.starcraft2.com/starport/bda9a860/portraits/';
const LIVE = `${CDN}13-6.jpg`;
/** Row 16: a sheet Blizzard never published, 403 on every build id. */
const DEAD = `${CDN}16-6.jpg`;

/** A CDN that answers by url, and remembers what it was asked. */
function cdn(answer: (url: string) => number | Error) {
	const calls: { url: string; method?: string }[] = [];
	const fn = (async (input: string | URL | Request, init?: RequestInit) => {
		const url = String(input);
		calls.push({ url, method: init?.method });
		const a = answer(url);
		if (a instanceof Error) throw a;
		return new Response(null, { status: a });
	}) as typeof fetch;
	return { fn, calls };
}

beforeEach(() => forgetPortraitVerdicts());

test('a portrait the CDN serves is alive, one it refuses is dead', async () => {
	const { fn, calls } = cdn((u) => (u === DEAD ? 403 : 200));
	assert.equal(await portraitAlive(LIVE, fn), true);
	assert.equal(await portraitAlive(DEAD, fn), false);
	assert.deepEqual(await deadPortraits([LIVE, DEAD, LIVE], fn), [DEAD]);
	// asked with HEAD: the picture itself is never downloaded
	assert.ok(calls.every((c) => c.method === 'HEAD'));
});

test('a verdict is reached once per process', async () => {
	const { fn, calls } = cdn(() => 403);
	await deadPortraits([DEAD], fn);
	await deadPortraits([DEAD], fn);
	assert.equal(await portraitAlive(DEAD, fn), false);
	assert.equal(calls.length, 1);
});

test('a CDN that gives no answer condemns nothing, and is asked again', async () => {
	const flaky = cdn((u) => (u.endsWith('1.jpg') ? 503 : new Error('timeout')));
	const a = `${CDN}1-1.jpg`;
	const b = `${CDN}1-2.jpg`;
	assert.equal(await portraitAlive(a, flaky.fn), null);
	assert.equal(await portraitAlive(b, flaky.fn), null);
	assert.deepEqual(await deadPortraits([a, b], flaky.fn), []);
	assert.equal(flaky.calls.length, 4);
});

test('dropDeadPortraits forgets the dead portrait, key and all, and touches nothing else', async () => {
	const { fn } = cdn((u) => (u === DEAD ? 403 : 200));
	type Profile = { toon: string; name: string; avatarUrl?: string };
	const kept: Profile = { toon: '2-S2-1-1', name: 'A', avatarUrl: LIVE };
	const bare: Profile = { toon: '2-S2-1-2', name: 'B' };
	const doomed: Profile = { toon: '2-S2-1-3', name: 'C', avatarUrl: DEAD };
	const out = await dropDeadPortraits([kept, bare, doomed], fn);
	assert.equal(out[0], kept);
	assert.equal(out[1], bare);
	assert.deepEqual(out[2], { toon: '2-S2-1-3', name: 'C' });
	assert.equal('avatarUrl' in out[2], false);
});

test('dropDeadPortraits hands the list back untouched when every portrait is alive', async () => {
	const { fn } = cdn(() => 200);
	const profiles = [{ toon: '2-S2-1-1', name: 'A', avatarUrl: LIVE }];
	assert.equal(await dropDeadPortraits(profiles, fn), profiles);
});
