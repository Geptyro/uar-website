import { redirect } from '@sveltejs/kit';
import { bnetConfigured } from '$lib/server/bnet';
import {
	dbConfigured,
	deleteAccount,
	deletePushSubsForAccount,
	getAccount,
	getPlayerSummary
} from '$lib/server/db';
import { clearSession } from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

// live, per-visitor content — opt out of the site-wide prerender
export const prerender = false;

export interface LinkedToon {
	toon: string;
	/** Profile name reported by Battle.net (region/realm may be inactive). */
	bnetName: string;
	regionId: number;
	/** SC2 portrait (Blizzard CDN URL). */
	avatarUrl: string | null;
	/** In-game identity when the toon has appeared in an ingested replay. */
	player: { name: string; clan: string; gamesPlayed: number; lastSeen: string } | null;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const enabled = bnetConfigured() && dbConfigured();
	const error = url.searchParams.get('error');
	if (!locals.session || !enabled) {
		return { enabled, error, battletag: null, avatar: null, linked: [] as LinkedToon[] };
	}

	const account = await getAccount(locals.session.sub);
	const linked: LinkedToon[] = account
		? await Promise.all(
				account.profiles.map(async (p) => {
					const player = (await getPlayerSummary(p.toon)) as {
						name: string;
						clan: string;
						gamesPlayed: number;
						lastSeen: string;
					} | null;
					return {
						toon: p.toon,
						bnetName: p.name,
						regionId: p.regionId,
						avatarUrl: p.avatarUrl ?? null,
						player
					};
				})
			)
		: [];
	return {
		enabled,
		error,
		battletag: locals.session.battletag,
		avatar: locals.session.avatar ?? null,
		linked
	};
};

export const actions: Actions = {
	logout: async ({ cookies }) => {
		clearSession(cookies);
		redirect(303, '/account');
	},
	unlink: async ({ cookies, locals }) => {
		if (locals.session) {
			await deleteAccount(locals.session.sub);
			// "Disconnect" means the site keeps nothing — and a subscription
			// nobody can turn off from the account page any more would keep
			// notifying a browser whose account is gone
			await deletePushSubsForAccount(locals.session.sub);
		}
		clearSession(cookies);
		redirect(303, '/account');
	}
};
