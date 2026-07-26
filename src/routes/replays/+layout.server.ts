import { dbConfigured, getReplaysList } from '$lib/server/db';
import type { ReplayMeta } from '$lib/players';
import { paginate } from '$lib/paging';
import type { LayoutServerLoad } from './$types';

export const prerender = false;

// the replay list is layout data so it stays visible — and navigable —
// on both the index page and the individual /replays/[id] pages
export const load: LayoutServerLoad = async ({ url }) => {
	if (!dbConfigured()) return { replays: [] as ReplayMeta[], page: 1, pages: 1, total: 0 };
	// newest first, one page at a time — the list grows with every game
	const all = ((await getReplaysList()) as ReplayMeta[]).slice().reverse();
	const { rows, page, pages, total } = paginate(all, url.searchParams.get('page'));
	return { replays: rows, page, pages, total };
};
