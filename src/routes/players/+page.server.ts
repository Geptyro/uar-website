import { dbConfigured, getAvatarsByToon, getPlayersLite, getReplaysList } from '$lib/server/db';
import { careerXp, totalWins, type PlayerProfile } from '$lib/players';
import { paginate } from '$lib/paging';
import type { PageServerLoad } from './$types';

export const prerender = false;

/** Sortable columns, matching the table headers. */
const SORTS: Record<string, (p: PlayerProfile) => number | string> = {
	name: (p) => p.name.toLowerCase(),
	career: (p) => careerXp(p),
	xpEn: (p) => p.xpEn,
	xpWo: (p) => p.xpWo,
	xpCo: (p) => p.xpCo,
	prestige: (p) => p.prestige,
	games: (p) => p.gamesPlayed,
	wins: (p) => totalWins(p),
	revives: (p) => p.revives,
	avg: (p) => p.avgGameTime
};

export const load: PageServerLoad = async ({ url }) => {
	const key = url.searchParams.get('sort') ?? '';
	const sort = SORTS[key] ? key : 'career';
	const dir = url.searchParams.get('dir') === 'asc' ? 1 : -1;
	const meta = { sort, dir: dir === 1 ? 'asc' : 'desc' };
	if (!dbConfigured()) {
		return {
			players: [] as PlayerProfile[],
			replayCount: 0,
			latest: '',
			avatars: {},
			...meta,
			page: 1,
			pages: 1,
			total: 0
		};
	}
	const [all, replays, avatars] = await Promise.all([
		getPlayersLite() as unknown as Promise<PlayerProfile[]>,
		getReplaysList(),
		getAvatarsByToon()
	]);

	// sort and page here, so the response carries one screen of rows rather
	// than the whole leaderboard with every player's history attached
	const value = SORTS[sort];
	const sorted = [...all].sort((a, b) => {
		const x = value(a);
		const y = value(b);
		const cmp = typeof x === 'number' ? x - (y as number) : String(x).localeCompare(String(y));
		return cmp * dir || careerXp(b) - careerXp(a);
	});
	const { rows, page, pages, total } = paginate(sorted, url.searchParams.get('page'));

	return {
		players: rows,
		replayCount: replays.filter((r) => r.players > 0).length,
		latest: replays.at(-1)?.playedAt?.slice(0, 10) ?? '',
		avatars,
		...meta,
		page,
		pages,
		total
	};
};
