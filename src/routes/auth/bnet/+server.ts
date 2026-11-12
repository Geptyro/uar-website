/**
 * Kicks off the Battle.net login: stores a CSRF state cookie and redirects to
 * Blizzard's authorize page. The callback route completes the link. A `next`
 * path (a guide's "sign in to vote") rides along in a cookie of its own, so
 * the callback can send the reader back there instead of to /account.
 */
import { error, redirect } from '@sveltejs/kit';
import { authorizeUrl, bnetConfigured } from '$lib/server/bnet';
import { newState } from '$lib/server/session';
import { redirectUri } from './redirect-uri';
import { safeNext } from '$lib/signin';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = ({ url, cookies }) => {
	if (!bnetConfigured()) error(503, 'Battle.net login is not configured.');
	const state = newState();
	cookies.set('bnet_state', state, { path: '/auth/bnet', maxAge: 600, sameSite: 'lax' });
	const next = safeNext(url.searchParams.get('next'));
	if (next) cookies.set('bnet_next', next, { path: '/auth/bnet', maxAge: 600, sameSite: 'lax' });
	else cookies.delete('bnet_next', { path: '/auth/bnet' });
	redirect(302, authorizeUrl(redirectUri(url), state));
};
