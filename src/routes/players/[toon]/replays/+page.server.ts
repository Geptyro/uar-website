import { getPlayerHistoryPage, getReplayFacts, type ReplayFacts } from '$lib/server/db';
import type { Sighting } from '$lib/players';
import type { PageServerLoad } from './$types';

/**
 * One page of this player's games.
 *
 * History is the only part of a profile that grows without bound, which is
 * why it is neither on the layout nor on any other tab: a reader who came for
 * a rank or a medal never pays for it.
 */
export const prerender = false;

export const load: PageServerLoad = async ({ params, url, parent }) => {
	const { historyCount } = await parent();

	const { rows, lead, page, pages } = await getPlayerHistoryPage(
		params.toon,
		url.searchParams.get('h'),
		historyCount
	);
	const history = rows as unknown as Sighting[];
	// only the games this page renders — neither the read nor the payload grows
	// with how long the player has been playing
	const replayFacts = await getReplayFacts(
		`${params.toon}:${page}`,
		history.map((h) => h.file)
	);

	return {
		history,
		// rows beyond this one are the extra newer sighting each page carries so
		// its top row still has a next game to diff against — not a row itself
		historyRows: history.length - lead,
		historyPage: page,
		historyPages: pages,
		historyTotal: historyCount,
		replayFacts: replayFacts as Record<string, ReplayFacts>
	};
};
