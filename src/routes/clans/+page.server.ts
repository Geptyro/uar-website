import { countPlayers, dbConfigured, getClanMembers } from '$lib/server/db';
import { buildClans, type ClanMember, type ClanSummary } from '$lib/clans';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async () => {
	if (!dbConfigured()) return { clans: [] as ClanSummary[], playerCount: 0 };
	// only the eleven fields the aggregation sums, and only players in a clan;
	// the headline count is a counter, not a reason to read every profile
	const [members, playerCount] = await Promise.all([getClanMembers(), countPlayers()]);
	return { clans: buildClans(members as unknown as ClanMember[]), playerCount };
};
