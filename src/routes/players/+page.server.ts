import { dbConfigured, getAvatarsByToon, getPlayersPage, getReplayStats } from '$lib/server/db';
import type { PlayerProfile } from '$lib/players';
import type { PageServerLoad } from './$types';

export const prerender = false;

/**
 * Sortable columns, matching the table headers. The database owns the ordering
 * now (see `getPlayersPage`), so this is only the whitelist that keeps a
 * `?sort=` value from reaching the query — the field each one maps to lives
 * next to the query it builds.
 */
const SORTS = [
	'name',
	'career',
	'xpEn',
	'xpWo',
	'xpCo',
	'prestige',
	'games',
	'wins',
	'revives',
	'avg'
];

export const load: PageServerLoad = async ({ url }) => {
	const key = url.searchParams.get('sort') ?? '';
	const sort = SORTS.includes(key) ? key : 'career';
	const dir = url.searchParams.get('dir') === 'asc' ? 1 : -1;
	const meta = { sort, dir: dir === 1 ? 'asc' : 'desc' };
	if (!dbConfigured()) {
		return {
			players: [] as PlayerProfile[],
			replayCount: 0,
			latest: '',
			avatars: {},
			...meta,
			q: '',
			page: 1,
			pages: 1,
			total: 0
		};
	}
	const q = (url.searchParams.get('q') ?? '').trim();
	// sorted, searched and paged by the database: the leaderboard grows with
	// every new player, and only one screen of it is ever rendered
	const [{ rows, page, pages, total }, replayStats, avatars] = await Promise.all([
		getPlayersPage({ sort, dir, q, page: url.searchParams.get('page') }),
		// the header shows a game count and a date — both are server-side
		// counters, not something to read the archive for
		getReplayStats(),
		getAvatarsByToon()
	]);

	return {
		players: rows as unknown as PlayerProfile[],
		replayCount: replayStats.count,
		latest: replayStats.latest,
		avatars,
		...meta,
		q,
		page,
		pages,
		total
	};
};
