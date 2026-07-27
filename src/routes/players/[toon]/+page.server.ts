import { error } from '@sveltejs/kit';
import {
	dbConfigured,
	getAccountByToon,
	getAvatarsByToon,
	getPlayer,
	getReplayFacts,
	getTeammates
} from '$lib/server/db';
import type { PlayerProfile } from '$lib/players';
import type { Outcome } from '$lib/outcome';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!dbConfigured()) error(503, 'Player data is not available.');
	const [player, account, teammates, avatars, replayFacts] = await Promise.all([
		getPlayer(params.toon),
		getAccountByToon(params.toon),
		getTeammates(params.toon),
		getAvatarsByToon(),
		getReplayFacts()
	]);
	if (!player) error(404, `No player profile for "${params.toon}"`);
	const profile = player as unknown as PlayerProfile;
	return {
		player: profile,
		// length and result of each game in the history — narrowed to this
		// player's own replays so the payload does not grow with the archive
		replayFacts: Object.fromEntries(
			profile.history.map((h) => [h.file, replayFacts[h.file]]).filter(([, f]) => f)
		) as Record<string, { durationLoops: number; outcome?: Outcome }>,
		// battletag of the Battle.net account that claimed this toon via /account
		verified: account
			? { battletag: account.battletag, isOwner: locals.session?.sub === account._id }
			: null,
		avatarUrl: account?.profiles.find((p) => p.toon === params.toon)?.avatarUrl ?? null,
		teammates: teammates.map((t) => ({ ...t, avatarUrl: avatars[t.toon] ?? null }))
	};
};
