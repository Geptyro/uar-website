/**
 * Battle.net OAuth callback: verifies state, trades the code for a user token,
 * reads the battletag + SC2 profiles, stores the link in `accounts`, and opens
 * a session. All failure modes land on /account?error=… — never a bare 500.
 */
import { redirect } from '@sveltejs/kit';
import { bnetConfigured, exchangeCode, fetchSc2Profiles, fetchUserInfo } from '$lib/server/bnet';
import { dbConfigured, pickPrimaryProfile, upsertAccount } from '$lib/server/db';
import { createSession } from '$lib/server/session';
import { redirectUri } from '../redirect-uri';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async ({ url, cookies }) => {
	if (!bnetConfigured() || !dbConfigured()) redirect(302, '/account?error=unavailable');

	const expected = cookies.get('bnet_state');
	cookies.delete('bnet_state', { path: '/auth/bnet' });

	if (url.searchParams.get('error')) redirect(302, '/account?error=denied');

	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	if (!code || !state || !expected || state !== expected) redirect(302, '/account?error=state');

	let ok = false;
	let profilesFailed = false;
	try {
		const token = await exchangeCode(code, redirectUri(url));
		const { sub, battletag } = await fetchUserInfo(token);
		const profiles = await fetchSc2Profiles(token, sub);
		profilesFailed = profiles === null;
		await upsertAccount(sub, battletag, profiles);
		// primary profile = the one the top-bar button links to
		const primary = await pickPrimaryProfile(profiles ?? []);
		createSession(cookies, {
			sub,
			battletag,
			avatar: primary?.avatarUrl ?? profiles?.find((p) => p.avatarUrl)?.avatarUrl,
			toon: primary?.toon
		});
		ok = true;
	} catch (e) {
		console.error('bnet callback failed:', e);
	}
	if (!ok) redirect(302, '/account?error=bnet');
	redirect(302, profilesFailed ? '/account?error=profiles' : '/account');
};
