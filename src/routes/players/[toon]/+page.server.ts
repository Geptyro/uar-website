import { error } from '@sveltejs/kit';
import {
	dbConfigured,
	getAccountByToon,
	getAvatarsByToon,
	getPlayerHistoryPage,
	getPlayerSummary,
	getReplayFacts,
	getTeammates
} from '$lib/server/db';
import type { PlayerProfile, Sighting } from '$lib/players';
import type { Outcome } from '$lib/outcome';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ params, url, locals }) => {
	if (!dbConfigured()) error(503, 'Player data is not available.');
	// the profile without its history: that array is the only part of a player
	// that grows without bound, and the page shows one page of it at a time
	const [summary, account, teammates, avatars] = await Promise.all([
		getPlayerSummary(params.toon),
		getAccountByToon(params.toon),
		getTeammates(params.toon),
		getAvatarsByToon()
	]);
	if (!summary) error(404, `No player profile for "${params.toon}"`);
	const profile = summary as unknown as Omit<PlayerProfile, 'history'> & {
		historyCount: number;
		classGames: Record<string, number>;
		latestFile: string | null;
	};

	const { rows, lead, page, pages } = await getPlayerHistoryPage(
		params.toon,
		url.searchParams.get('h'),
		profile.historyCount ?? 0
	);
	const history = rows as unknown as Sighting[];
	// only the games this page renders — neither the read nor the payload grows
	// with how long the player has been playing
	const replayFacts = await getReplayFacts(
		`${params.toon}:${page}`,
		history.map((h) => h.file)
	);

	return {
		player: { ...profile, history },
		// rows beyond this one are the extra newer sighting each page carries so
		// its top row still has a next game to diff against — not a row itself
		historyRows: history.length - lead,
		historyPage: page,
		historyPages: pages,
		historyTotal: profile.historyCount ?? 0,
		latestFile: profile.latestFile ?? null,
		classGames: profile.classGames ?? {},
		replayFacts: replayFacts as Record<string, { durationLoops: number; outcome?: Outcome }>,
		// battletag of the Battle.net account that claimed this toon via /account
		verified: account
			? { battletag: account.battletag, isOwner: locals.session?.sub === account._id }
			: null,
		avatarUrl: account?.profiles.find((p) => p.toon === params.toon)?.avatarUrl ?? null,
		teammates: teammates.map((t) => ({ ...t, avatarUrl: avatars[t.toon] ?? null }))
	};
};
