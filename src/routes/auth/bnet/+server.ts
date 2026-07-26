/**
 * Kicks off the Battle.net login: stores a CSRF state cookie and redirects to
 * Blizzard's authorize page. The callback route completes the link.
 */
import { error, redirect } from '@sveltejs/kit';
import { authorizeUrl, bnetConfigured } from '$lib/server/bnet';
import { newState } from '$lib/server/session';
import { redirectUri } from './redirect-uri';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = ({ url, cookies }) => {
	if (!bnetConfigured()) error(503, 'Battle.net login is not configured.');
	const state = newState();
	cookies.set('bnet_state', state, { path: '/auth/bnet', maxAge: 600, sameSite: 'lax' });
	redirect(302, authorizeUrl(redirectUri(url), state));
};
