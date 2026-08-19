import { error } from '@sveltejs/kit';
import { dbConfigured, getAccountByToon, getPlayerSummary } from '$lib/server/db';
import type { PlayerProfile } from '$lib/players';
import type { LayoutServerLoad } from './$types';

/**
 * What every tab of a profile needs: who this is, and the figures the infobox
 * restates beside all four of them.
 *
 * Each tab's own loader adds only its slice — the teammates, the unlock sets,
 * a page of history — so a visitor who came for the ranks never reads the rest.
 * That is the point of the split: this database is throttled on bytes returned
 * (see $lib/server/db.ts), and the profile was fetching every section's data on
 * every view of any of them.
 *
 * Deliberately not the history: it is the one part of a player that grows
 * without bound, and only the Replays tab renders it.
 */
export const prerender = false;

export const load: LayoutServerLoad = async ({ params, locals }) => {
	if (!dbConfigured()) error(503, 'Player data is not available.');
	const [summary, account] = await Promise.all([
		getPlayerSummary(params.toon),
		getAccountByToon(params.toon)
	]);
	if (!summary) error(404, `No player profile for "${params.toon}"`);

	const profile = summary as unknown as Omit<PlayerProfile, 'history'> & {
		historyCount: number;
		classGames: Record<string, number>;
		latestFile: string | null;
	};

	return {
		player: profile,
		toon: params.toon,
		historyCount: profile.historyCount ?? 0,
		classGames: profile.classGames ?? {},
		// empty rather than absent for a profile not rebuilt since it was added,
		// so the overview reads it like classGames and shows a dash
		classSeconds: profile.classSeconds ?? {},
		latestFile: profile.latestFile ?? null,
		// battletag of the Battle.net account that claimed this toon via /account
		verified: account
			? { battletag: account.battletag, isOwner: locals.session?.sub === account._id }
			: null,
		avatarUrl: account?.profiles.find((p) => p.toon === params.toon)?.avatarUrl ?? null
	};
};
