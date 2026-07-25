import { dbConfigured, getPlayers } from '$lib/server/db';
import { buildClans, type ClanSummary } from '$lib/clans';
import type { PlayerProfile } from '$lib/players';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async () => {
	if (!dbConfigured()) return { clans: [] as ClanSummary[], playerCount: 0 };
	const players = (await getPlayers()) as unknown as PlayerProfile[];
	return { clans: buildClans(players), playerCount: players.length };
};
