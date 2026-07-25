import { error } from '@sveltejs/kit';
import { dbConfigured, getPlayers } from '$lib/server/db';
import { buildClans } from '$lib/clans';
import { careerXp, type PlayerProfile } from '$lib/players';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ params }) => {
	if (!dbConfigured()) error(503, 'Player data is not available.');
	const players = (await getPlayers()) as unknown as PlayerProfile[];
	const members = players
		.filter((p) => p.clan === params.tag)
		.sort((a, b) => careerXp(b) - careerXp(a));
	if (!members.length) error(404, `No clan "${params.tag}" in ingested replays`);
	const clan = buildClans(members)[0];
	return { clan, members };
};
