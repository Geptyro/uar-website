// Clan aggregation over player profiles. A player's clan is the tag from
// their newest sighting (same snapshot semantics as name/camo), so clans are
// derived entirely from the players collection — no extra replay parsing.
import { careerXp, totalWins } from './xp.ts';
import type { PlayerProfile } from './players.ts';

/**
 * The profile fields the clan pages need (structural subset): what the
 * aggregation below sums, plus what a member row renders. It is also the
 * projection the database read asks for, so widening this widens that — keep
 * it to what is actually displayed.
 */
export type ClanMember = Pick<
	PlayerProfile,
	| 'name'
	| 'clan'
	| 'toon'
	| 'xpEn'
	| 'xpWo'
	| 'xpCo'
	| 'prestige'
	| 'gamesPlayed'
	| 'revives'
	| 'avgGameTime'
	| 'winsByMode'
	| 'lastSeen'
>;

export interface ClanSummary {
	tag: string;
	members: number;
	/** Summed career XP of all members. */
	careerXp: number;
	games: number;
	wins: number;
	revives: number;
	/** Highest-career-XP member. */
	top: { name: string; toon: string };
	/** Newest lastSeen across members. */
	lastSeen: string;
}

/** Group players by clan tag (players without a clan are ignored), ordered by
 * summed career XP. */
export function buildClans(players: ClanMember[]): ClanSummary[] {
	const byTag = new Map<string, ClanMember[]>();
	for (const p of players) {
		if (!p.clan) continue;
		if (!byTag.has(p.clan)) byTag.set(p.clan, []);
		byTag.get(p.clan)!.push(p);
	}

	const clans: ClanSummary[] = [];
	for (const [tag, members] of byTag) {
		const top = members.reduce((a, b) => (careerXp(b) > careerXp(a) ? b : a));
		clans.push({
			tag,
			members: members.length,
			careerXp: members.reduce((sum, m) => sum + careerXp(m), 0),
			games: members.reduce((sum, m) => sum + m.gamesPlayed, 0),
			wins: members.reduce((sum, m) => sum + totalWins(m), 0),
			revives: members.reduce((sum, m) => sum + m.revives, 0),
			top: { name: top.name, toon: top.toon },
			lastSeen: members.reduce((a, m) => (m.lastSeen > a ? m.lastSeen : a), '')
		});
	}

	clans.sort((a, b) => b.careerXp - a.careerXp);
	return clans;
}

/** The `?sort=` values the clan list answers to, matching its table headers. */
export const CLAN_SORTS = [
	'tag',
	'members',
	'career',
	'games',
	'wins',
	'revives',
	'top',
	'seen'
] as const;
export type ClanSort = (typeof CLAN_SORTS)[number];

const CLAN_SORT_VALUE: Record<ClanSort, (c: ClanSummary) => number | string> = {
	tag: (c) => c.tag.toLowerCase(),
	members: (c) => c.members,
	career: (c) => c.careerXp,
	games: (c) => c.games,
	wins: (c) => c.wins,
	revives: (c) => c.revives,
	top: (c) => c.top.name.toLowerCase(),
	seen: (c) => c.lastSeen
};

/**
 * A copy of `clans` in the order a `?sort=` asks for. Ties fall back to career
 * XP and then to the tag, so the order is total: once the list is paged, a
 * clan cannot land on two pages or on none.
 */
export function sortClans(clans: ClanSummary[], sort: ClanSort, dir: 1 | -1): ClanSummary[] {
	const value = CLAN_SORT_VALUE[sort];
	return [...clans].sort((a, b) => {
		const x = value(a);
		const y = value(b);
		const cmp = typeof x === 'number' ? x - (y as number) : String(x).localeCompare(String(y));
		return cmp * dir || b.careerXp - a.careerXp || a.tag.localeCompare(b.tag);
	});
}

/** The clans whose tag or top player matches `q`, case-insensitively. */
export function searchClans(clans: ClanSummary[], q: string): ClanSummary[] {
	const needle = q.trim().toLowerCase();
	if (!needle) return clans;
	return clans.filter(
		(c) => c.tag.toLowerCase().includes(needle) || c.top.name.toLowerCase().includes(needle)
	);
}
