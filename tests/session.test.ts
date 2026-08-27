/** Unit tests for the signed session cookie and its sliding expiry (npm test). */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Cookies } from '@sveltejs/kit';
import {
	createSession,
	sessionExpiry,
	sessionRenewal,
	signSession,
	verifySession,
	type Session
} from '../src/lib/server/session.ts';

const KEY = 'test-secret';
const DAY = 24 * 3600 * 1000;
const T0 = Date.parse('2026-08-26T12:00:00Z');
const ME: Session = { sub: 'bnet-1', battletag: 'Kanax#2515' };

/**
 * Enough of Kit's Cookies for these two functions: `set` has to feed `get`,
 * which is what makes "a route that set the cookie itself wins" testable.
 */
function fakeCookies(initial: Record<string, string> = {}) {
	const jar = new Map(Object.entries(initial));
	const setCalls: string[] = [];
	const cookies = {
		get: (name: string) => jar.get(name),
		getAll: () => [...jar].map(([name, value]) => ({ name, value })),
		set: (name: string, value: string) => {
			jar.set(name, value);
			setCalls.push(name);
		},
		delete: (name: string) => {
			jar.set(name, '');
		},
		serialize: (name: string, value: string, opts: { path: string; maxAge?: number }) =>
			`${name}=${value}; Path=${opts.path}; Max-Age=${opts.maxAge}`
	} as unknown as Cookies;
	return { cookies, setCalls, jar };
}

function issued(at: number, session: Session = ME): string {
	return signSession(session, KEY, at + 30 * DAY);
}

test('a signed session round-trips and rejects a tampered payload', () => {
	const value = issued(T0);
	assert.deepEqual(verifySession(value, KEY, T0), ME);
	assert.equal(verifySession(value, 'other-secret', T0), null);
	assert.equal(verifySession(value.replace(/^./, 'X'), KEY, T0), null);
});

test('a session past its exp no longer verifies', () => {
	const value = issued(T0);
	assert.notEqual(verifySession(value, KEY, T0 + 30 * DAY - 1), null);
	assert.equal(verifySession(value, KEY, T0 + 30 * DAY + 1), null);
});

test('sessionExpiry reads exp without needing the key', () => {
	assert.equal(sessionExpiry(issued(T0)), T0 + 30 * DAY);
	assert.equal(sessionExpiry('not-a-cookie'), null);
	assert.equal(sessionExpiry('bm90LWpzb24.c2ln'), null);
});

test('a young session is left alone, one past half its life is renewed', () => {
	process.env.AUTH_SECRET = KEY;
	// 29 days left of 30: nothing to do
	const young = fakeCookies({ uar_session: issued(T0) });
	assert.equal(sessionRenewal(young.cookies, ME, T0 + 1 * DAY), null);
	// exactly half spent is still inside the window
	const half = fakeCookies({ uar_session: issued(T0) });
	assert.equal(sessionRenewal(half.cookies, ME, T0 + 15 * DAY), null);
	// a day later it is due, and comes back as a full new term
	const old = fakeCookies({ uar_session: issued(T0) });
	const header = sessionRenewal(old.cookies, ME, T0 + 16 * DAY);
	assert.ok(header !== null);
	assert.match(header, /^uar_session=/);
	const renewed = header.slice('uar_session='.length, header.indexOf(';'));
	assert.equal(sessionExpiry(renewed), T0 + 16 * DAY + 30 * DAY);
	assert.deepEqual(verifySession(renewed, KEY, T0 + 16 * DAY), ME);
});

test('a session the route just re-issued is not renewed over', () => {
	process.env.AUTH_SECRET = KEY;
	// stale cookie on the request, but the route (sign-in, or the /api/me
	// profile backfill) set a fresh one during it
	const { cookies } = fakeCookies({ uar_session: issued(T0) });
	const withToon: Session = { ...ME, toon: '2-S2-1-1809580' };
	createSession(cookies, withToon);
	assert.equal(sessionRenewal(cookies, ME, T0 + 16 * DAY), null);
});

test('a session the route cleared is not renewed back into place', () => {
	process.env.AUTH_SECRET = KEY;
	const { cookies } = fakeCookies({ uar_session: issued(T0) });
	cookies.delete('uar_session', { path: '/' });
	assert.equal(sessionRenewal(cookies, ME, T0 + 16 * DAY), null);
});

test('no cookie at all means nothing to renew', () => {
	process.env.AUTH_SECRET = KEY;
	const { cookies } = fakeCookies();
	assert.equal(sessionRenewal(cookies, ME, T0), null);
});
