import { error } from '@sveltejs/kit';
import { dbConfigured, getReplay } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	if (!dbConfigured()) error(503, 'Replay data is not available.');
	const replay = await getReplay(`${params.id}.SC2Replay`);
	if (!replay) error(404, `No ingested replay "${params.id}"`);
	return { replay };
};
