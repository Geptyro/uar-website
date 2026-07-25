import { error } from '@sveltejs/kit';
import { dbConfigured, getPlayer } from '$lib/server/db';
import type { PlayerProfile } from '$lib/players';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ params }) => {
	if (!dbConfigured()) error(503, 'Player data is not available.');
	const player = await getPlayer(params.toon);
	if (!player) error(404, `No player profile for "${params.toon}"`);
	return { player: player as unknown as PlayerProfile };
};
