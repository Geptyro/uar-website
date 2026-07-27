import { error } from '@sveltejs/kit';
import {
	dbConfigured,
	getAccountByToon,
	getAvatarsByToon,
	getPlayer,
	getTeammates
} from '$lib/server/db';
import type { PlayerProfile } from '$lib/players';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!dbConfigured()) error(503, 'Player data is not available.');
	const [player, account, teammates, avatars] = await Promise.all([
		getPlayer(params.toon),
		getAccountByToon(params.toon),
		getTeammates(params.toon),
		getAvatarsByToon()
	]);
	if (!player) error(404, `No player profile for "${params.toon}"`);
	return {
		player: player as unknown as PlayerProfile,
		// battletag of the Battle.net account that claimed this toon via /account
		verified: account
			? { battletag: account.battletag, isOwner: locals.session?.sub === account._id }
			: null,
		avatarUrl: account?.profiles.find((p) => p.toon === params.toon)?.avatarUrl ?? null,
		teammates: teammates.map((t) => ({ ...t, avatarUrl: avatars[t.toon] ?? null }))
	};
};
