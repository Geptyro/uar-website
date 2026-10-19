/** Unit tests for the SC2 profile lookup and its app-token retry (npm test). */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
	appToken,
	fetchSc2Profiles,
	forgetAppToken,
	lookupSc2Profiles
} from '../src/lib/server/bnet.ts';

process.env.BNET_CLIENT_ID = 'id';
process.env.BNET_CLIENT_SECRET = 'secret';

const SABRE = [
	{ name: 'Sabre', regionId: 1, realmId: 1, profileId: '7214881' },
	{ name: 'Sabre', regionId: 2, realmId: 1, profileId: 6307567, avatarUrl: 'https://x/15-16.jpg' }
];

/**
 * A Blizzard that answers the player endpoint by bearer token: `user` and
 * `app` say what each token gets, a status or an error. Remembers each call.
 */
function blizzard(user: number | Error, app: number | Error = 200) {
	const calls: string[] = [];
	const fn = (async (input: string | URL | Request, init?: RequestInit) => {
		const url = String(input);
		calls.push(url);
		if (url.endsWith('/token')) {
			return Response.json({ access_token: 'APP', expires_in: 86400 });
		}
		const auth = new Headers(init?.headers).get('Authorization');
		const a = auth === 'Bearer APP' ? app : user;
		if (a instanceof Error) throw a;
		return a === 200 ? Response.json(SABRE) : new Response(null, { status: a });
	}) as typeof fetch;
	return { fn, calls };
}

beforeEach(() => forgetAppToken());

test('profiles merge across hosts into toon handles', async () => {
	const { fn } = blizzard(200);
	const got = await fetchSc2Profiles('USER', '1', fn);
	assert.deepEqual(
		got?.map((p) => p.toon),
		['1-S2-1-7214881', '2-S2-1-6307567']
	);
	assert.equal(got?.[1].avatarUrl, 'https://x/15-16.jpg');
});

test('every host failing is null, not an empty list', async () => {
	const { fn } = blizzard(503);
	assert.equal(await fetchSc2Profiles('USER', '1', fn), null);
});

test('the user token answering means no app token is asked for', async () => {
	const { fn, calls } = blizzard(200);
	assert.equal((await lookupSc2Profiles('USER', '1', fn))?.length, 2);
	assert.ok(!calls.some((u) => u.endsWith('/token')));
});

test('every host refusing the user token is retried with the app token', async () => {
	const { fn, calls } = blizzard(new DOMException('timed out', 'TimeoutError'));
	const got = await lookupSc2Profiles('USER', '1', fn);
	assert.deepEqual(
		got?.map((p) => p.toon),
		['1-S2-1-7214881', '2-S2-1-6307567']
	);
	assert.equal(calls.filter((u) => u.endsWith('/token')).length, 1);
});

test('both tokens failing is still null, so stored toons are kept', async () => {
	const { fn } = blizzard(403, 500);
	assert.equal(await lookupSc2Profiles('USER', '1', fn), null);
});

test('the app token is reused until a minute before it expires', async () => {
	const { fn, calls } = blizzard(200);
	const t0 = 1_000_000;
	await appToken(fn, t0);
	await appToken(fn, t0 + 86_000_000);
	assert.equal(calls.length, 1);
	await appToken(fn, t0 + 86_341_000);
	assert.equal(calls.length, 2);
});
