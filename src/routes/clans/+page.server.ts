import { countPlayers, dbConfigured, getClanMembers } from '$lib/server/db';
import {
	buildClans,
	searchClans,
	sortClans,
	CLAN_SORTS,
	type ClanMember,
	type ClanSort,
	type ClanSummary
} from '$lib/clans';
import { PER_PAGE, paginate } from 'sveltekit-commons/paging';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ url }) => {
	const key = url.searchParams.get('sort') ?? '';
	const sort: ClanSort = (CLAN_SORTS as readonly string[]).includes(key)
		? (key as ClanSort)
		: 'career';
	const dir = url.searchParams.get('dir') === 'asc' ? 1 : -1;
	const q = (url.searchParams.get('q') ?? '').trim();
	const meta = { sort, dir: dir === 1 ? 'asc' : 'desc', q };
	if (!dbConfigured()) {
		return {
			clans: [] as ClanSummary[],
			playerCount: 0,
			inClans: 0,
			...meta,
			page: 1,
			pages: 1,
			total: 0,
			perPage: PER_PAGE
		};
	}
	// only the eleven fields the aggregation sums, and only players in a clan;
	// the headline count is a counter, not a reason to read every profile
	const [members, playerCount] = await Promise.all([getClanMembers(), countPlayers()]);
	const clans = buildClans(members as unknown as ClanMember[]);
	// unlike /players, the whole list is already in hand: it is one aggregation
	// over the clan members, so searching, sorting and paging happen here
	const { rows, page, pages, total, perPage } = paginate(
		sortClans(searchClans(clans, q), sort, dir),
		url.searchParams.get('page')
	);
	return {
		clans: rows,
		playerCount,
		inClans: members.length,
		...meta,
		page,
		pages,
		total,
		perPage
	};
};
