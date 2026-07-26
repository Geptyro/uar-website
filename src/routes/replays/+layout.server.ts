import { dbConfigured, getReplaysList } from '$lib/server/db';
import type { ReplayMeta } from '$lib/players';
import type { LayoutServerLoad } from './$types';

export const prerender = false;

// the replay list is layout data so it stays visible — and navigable —
// on both the index page and the individual /replays/[id] pages
export const load: LayoutServerLoad = async () => {
	if (!dbConfigured()) return { replays: [] as ReplayMeta[] };
	return { replays: (await getReplaysList()) as ReplayMeta[] };
};
