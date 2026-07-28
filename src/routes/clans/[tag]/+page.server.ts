import { error } from '@sveltejs/kit';
import { dbConfigured, getClanMembers } from '$lib/server/db';
import { buildClans, type ClanMember } from '$lib/clans';
import { careerXp } from '$lib/players';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ params }) => {
	if (!dbConfigured()) error(503, 'Player data is not available.');
	// this clan's roster only — a handful of documents, not the whole collection
	const members = (await getClanMembers(params.tag)) as unknown as ClanMember[];
	if (!members.length) error(404, `No clan "${params.tag}" in ingested replays`);
	members.sort((a, b) => careerXp(b) - careerXp(a));
	return { clan: buildClans(members)[0], members };
};
