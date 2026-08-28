/**
 * Rank-track shapes and the pure math over them.
 *
 * Dependency-free (no JSON imports, no $lib chain) so plain node:test can load it —
 * same reason `xp.ts` exists. `mos.ts` binds these to the generated ranks.json.
 */

/** Something a single rank hands a class — an ability, a passive, or a free unit. */
export interface RankReward {
	mos: string;
	id: string;
	kind: 'ability' | 'passive' | 'unit';
	name: string;
	icon: string | null;
	tooltip: string;
}

export interface Rank {
	idx: number;
	icon: string | null;
	xp: number;
	prefix: string;
	name: string;
	rewards?: RankReward[];
}

/**
 * The hidden `RankModifier` buff the map stacks on the hero at spawn, once per rank.
 * Enlisted stacks `idx - 1`; Warrant and Commissioned stack `idx + 4`, so both start
 * five stacks ahead of a fresh Private.
 */
export interface RankBonus {
	offset: number;
	speed: number;
	rangedDamage: number;
	life: number;
}

export interface RankTrack {
	track: number;
	name: string;
	/** Track wireframe portrait from the in-game rank-set choice dialog. */
	icon: string | null;
	bonus?: RankBonus;
	ranks: Rank[];
}

export interface RankBonusTotals {
	stacks: number;
	speed: number;
	rangedDamage: number;
	life: number;
}

/** Stacks of the buff a hero carries at this rank. Never negative — a rank-1 Private has none. */
export function rankStacks(track: RankTrack, idx: number): number {
	if (!track.bonus) return 0;
	return Math.max(0, idx + track.bonus.offset);
}

/** What the buff is worth at a given rank, or null when the track carries no buff. */
export function rankBonusAt(track: RankTrack, idx: number): RankBonusTotals | null {
	const per = track.bonus;
	if (!per) return null;
	const stacks = rankStacks(track, idx);
	return {
		stacks,
		speed: round(per.speed * stacks, 4),
		rangedDamage: round(per.rangedDamage * stacks, 4),
		life: round(per.life * stacks, 4)
	};
}

export interface MosRankReward extends RankReward {
	track: number;
	trackName: string;
	rankIdx: number;
	rankPrefix: string;
	rankName: string;
	xp: number;
}

/** Every rank reward a class earns, in track then rank order. */
export function rankRewardsForMos(tracks: RankTrack[], mosId: string): MosRankReward[] {
	const out: MosRankReward[] = [];
	for (const track of tracks) {
		for (const rank of track.ranks) {
			for (const reward of rank.rewards ?? []) {
				if (reward.mos !== mosId) continue;
				out.push({
					...reward,
					track: track.track,
					trackName: track.name,
					rankIdx: rank.idx,
					rankPrefix: rank.prefix,
					rankName: rank.name,
					xp: rank.xp
				});
			}
		}
	}
	return out;
}

function round(v: number, places: number): number {
	const f = 10 ** places;
	return Math.round(v * f) / f;
}

/* ---------- the three tracks, by key ---------- */

/** The rank tracks as the data keys them: Enlisted, Warrant Officer, Commissioned Officer. */
export type RankKey = 'en' | 'wo' | 'co';
export const RANK_KEYS: readonly RankKey[] = ['en', 'wo', 'co'];
export const RANK_TRACK_NAMES: Record<RankKey, string> = {
	en: 'Enlisted',
	wo: 'Warrant Officer',
	co: 'Commissioned Officer'
};
export const RANK_TRACK_SHORT: Record<RankKey, string> = { en: 'EN', wo: 'WO', co: 'CO' };
/** ranks.json numbers its tracks 1..3 in the same order. */
export const RANK_KEY_OF_TRACK: Record<number, RankKey> = { 1: 'en', 2: 'wo', 3: 'co' };

export function isRankKey(v: unknown): v is RankKey {
	return v === 'en' || v === 'wo' || v === 'co';
}

/**
 * The tracks an SI is sold on: its XP threshold per track, where 0 means the
 * track never offers it (1 is "free", -1 an achievement unlock, both offered).
 */
export function siTracks(xp: Record<RankKey, number>): RankKey[] {
	return RANK_KEYS.filter((k) => xp[k] !== 0);
}

/** The tracks a class can be played on: those its unlock names; a class with no unlock is open to all. */
export function mosTracks(unlock: Partial<Record<RankKey, unknown>> | null | undefined): RankKey[] {
	if (!unlock) return [...RANK_KEYS];
	return RANK_KEYS.filter((k) => unlock[k] != null);
}
