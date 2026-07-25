import { dbConfigured, getReplaysList } from '$lib/server/db';
import type { ReplayMeta } from '$lib/players';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async () => {
	if (!dbConfigured()) return { replays: [] as ReplayMeta[] };
	return { replays: (await getReplaysList()) as ReplayMeta[] };
};
