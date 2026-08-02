import { getPlayerAwards, getReplayFacts, type ReplayFacts } from '$lib/server/db';
import type { Award } from '$lib/awards';
import type { PageServerLoad } from './$types';

/** Games shown before the feed asks you to read the replay list instead. */
const LIMIT = 60;

export const prerender = false;

export const load: PageServerLoad = async ({ params }) => {
	const rows = (await getPlayerAwards(params.toon, LIMIT)) as unknown as {
		file: string;
		playedAt: string;
		awards: Award[];
		mos: string[];
		gamesPlayed: number;
		span: number;
	}[];

	// mode, outcome and the real start time, for exactly the games on the feed
	const facts = await getReplayFacts(
		`awards:${params.toon}`,
		rows.map((r) => r.file)
	);

	return {
		games: rows,
		replayFacts: facts as Record<string, ReplayFacts>,
		truncated: rows.length >= LIMIT
	};
};
