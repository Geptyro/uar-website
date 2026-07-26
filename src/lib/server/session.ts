/**
 * Stateless login sessions: an HMAC-signed cookie carrying the Battle.net
 * account id + battletag. No session collection — Battle.net access tokens
 * are only needed during the one-shot link flow and are never stored.
 *
 * Cookie value is `base64url(payload).base64url(hmac-sha256(payload))`,
 * signed with AUTH_SECRET. Rotating AUTH_SECRET signs everyone out.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';

const COOKIE = 'uar_session';
const MAX_AGE_S = 30 * 24 * 3600;

export interface Session {
	/** Battle.net account id (the OAuth `sub` claim). */
	sub: string;
	battletag: string;
	/** SC2 portrait of the primary linked profile (Blizzard CDN URL). */
	avatar?: string;
	/** Toon handle of the primary linked profile — the user's player page. */
	toon?: string;
}

function secret(): string {
	const s = process.env.AUTH_SECRET;
	if (!s) throw new Error('AUTH_SECRET is not set');
	return s;
}

function hmac(payload: string, key: string): Buffer {
	return createHmac('sha256', key).update(payload).digest();
}

/** Random value for the OAuth `state` parameter. */
export function newState(): string {
	return randomBytes(16).toString('hex');
}

export function signSession(session: Session, key: string, expiresAt: number): string {
	const payload = Buffer.from(JSON.stringify({ ...session, exp: expiresAt })).toString('base64url');
	return `${payload}.${hmac(payload, key).toString('base64url')}`;
}

export function verifySession(value: string, key: string, now = Date.now()): Session | null {
	const dot = value.lastIndexOf('.');
	if (dot < 0) return null;
	const payload = value.slice(0, dot);
	const expected = hmac(payload, key);
	let actual: Buffer;
	try {
		actual = Buffer.from(value.slice(dot + 1), 'base64url');
	} catch {
		return null;
	}
	if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
	try {
		const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
			sub?: string;
			battletag?: string;
			avatar?: string;
			toon?: string;
			exp?: number;
		};
		if (!data.sub || !data.battletag || !data.exp || data.exp < now) return null;
		return {
			sub: data.sub,
			battletag: data.battletag,
			...(typeof data.avatar === 'string' ? { avatar: data.avatar } : {}),
			...(typeof data.toon === 'string' ? { toon: data.toon } : {})
		};
	} catch {
		return null;
	}
}

export function createSession(cookies: Cookies, session: Session): void {
	cookies.set(COOKIE, signSession(session, secret(), Date.now() + MAX_AGE_S * 1000), {
		path: '/',
		maxAge: MAX_AGE_S,
		sameSite: 'lax'
	});
}

/** The logged-in user, or null — never throws (AUTH_SECRET may be unset). */
export function readSession(cookies: Cookies): Session | null {
	const value = cookies.get(COOKIE);
	if (!value || !process.env.AUTH_SECRET) return null;
	return verifySession(value, process.env.AUTH_SECRET);
}

export function clearSession(cookies: Cookies): void {
	cookies.delete(COOKIE, { path: '/' });
}
