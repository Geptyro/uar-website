// Clan aggregation over player profiles. A player's clan is the tag from
// their newest sighting (same snapshot semantics as name/camo), so clans are
// derived entirely from the players collection — no extra replay parsing.
import { careerXp, totalWins } from './xp.ts';
import type { PlayerProfile } from './players.ts';

/** The profile fields clan aggregation actually reads (structural subset). */
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
