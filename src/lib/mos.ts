import rawMos from '$lib/data/mos.json';
import rawItems from '$lib/data/items.json';
import rawSi from '$lib/data/si.json';
import rawRanks from '$lib/data/ranks.json';
import type { Weapon } from '$lib/units';
import { rankRewardsForMos, type MosRankReward, type RankTrack } from './ranks';

export interface Skill {
	id: string;
	name: string;
	levels: number | null;
	icon: string | null;
	tooltip: string;
}

export interface CommonAbility {
	id: string;
	name: string;
	icon: string | null;
	tooltip: string;
}

/** Requirement to pick a class while playing one rank track. */
export interface UnlockReq {
	/** XP needed on that track (0 = from the start); null = unresolved. */
	xp: number | null;
	/** Rank reached at that XP, when the gate is a regular rank. */
	rank?: string;
	/** Robot: the XP is needed on every track at once, not just this one. */
	everyTrack?: boolean;
}

export interface MosUnlock {
	/** How many players can pick this class per game. */
	charges: number;
	en: UnlockReq | null;
	wo: UnlockReq | null;
	co: UnlockReq | null;
	/** Medals that must ALSO be earned, on top of the rank requirement. */
	medals?: number;
	/** Game modes the class exists in (absent = all). */
	modes?: string[];
}

export interface Mos {
	id: string;
	name: string;
	mos: string;
	role: string;
	/** Biological / Mechanical, from the unit's Attributes flags. */
	unitType: string;
	life: number | null;
	armor: number | null;
	speed: number | null;
	energy: number | null;
	weapons: Weapon[];
	icon: string | null;
	tooltip: string;
	skills: Skill[];
	common: CommonAbility[];
	inventory: { abil: string | null; slots: number; classes: string[] };
	/** Absent for classes outside the selection dialog (Sushi transformations). */
	unlock?: MosUnlock;
	/**
	 * false = not a hero-selection slot: a vehicle another class enters in play. It gets
	 * a class page and counts for item usability, but stays out of the roster and pickers.
	 */
	selectable?: boolean;
	/** Vehicle only: the class that pilots it. */
	pilotedBy?: string;
	/** Pilot only: the vehicle it brings, which has its own page. */
	vehicle?: string;
}

export type ItemType = 'weapon' | 'armor' | 'equipment' | 'consumable' | 'supply';

/** A stat modification from one of an item's carry buffs. */
export interface ItemMod {
	text: string;
	/** MOS unit ids the buff actually applies to; absent = every carrier. */
	scope?: string[];
	/** Annotation for class-free views, e.g. "bio carriers only". */
	note?: string;
}

/** Mod texts that actually apply to the given class (for class-scoped views). */
export function modsFor(item: Item, mosId: string): string[] {
	return item.mods.filter((m) => !m.scope || m.scope.includes(mosId)).map((m) => m.text);
}

export interface Item {
	id: string;
	name: string;
	unit: string | null;
	class: string;
	kind: string;
	type: ItemType;
	/** false = NPC-only gear (e.g. UT Army armor), never carried by players. */
	playable: boolean;
	/** Trigger names that spawn this item — mission scripts or item-cache tables. */
	sources: string[];
	charges: { start: string | null; max: string } | null;
	mods: ItemMod[];
	/** Weapons this item grants when carried, with resolved stats. */
	grants: Weapon[];
	/** MOS unit ids that can use this item; null = everyone. Derived from carry-buff validators. */
	allowed: string[] | null;
	/** Equipment-state rules, e.g. "not with MP75 R equipped". */
	conflicts: string[];
	icon: string | null;
	tooltip: string;
}

export const itemTypeLabels: Record<ItemType, string> = {
	weapon: 'Weapons',
	armor: 'Armor',
	equipment: 'Equipment',
	consumable: 'Consumables & deployables',
	supply: 'Mission & supplies'
};

export const itemTypeOrder: ItemType[] = ['weapon', 'armor', 'equipment', 'consumable', 'supply'];

export interface Si {
	num: number;
	name: string;
	code: string;
	xp: { en: number; wo: number; co: number };
	/** MOS unit id this SI is designed for, or null if universal. */
	mos: string | null;
	icon: string | null;
	desc: string;
	/** Position in the in-game SI dialog. */
	order: number;
	/** Bottom row in the dialog — special/achievement unlocks. */
	special: boolean;
}

export type {
	Rank,
	RankBonus,
	RankBonusTotals,
	RankReward,
	RankTrack,
	MosRankReward
} from './ranks';
export { rankBonusAt, rankStacks } from './ranks';

export const allMos: Mos[] = rawMos as Mos[];
export const items: Item[] = rawItems as Item[];
export const skillIdentifiers: Si[] = rawSi as Si[];
export const rankTracks: RankTrack[] = rawRanks as RankTrack[];

/** Rank rewards this class earns, across all three tracks. */
export function rankRewardsFor(mosId: string): MosRankReward[] {
	return rankRewardsForMos(rankTracks, mosId);
}

/** Everything with a class page — the sidebar, the index and the comparisons. */
export const mosList = allMos.filter((m) => m.id !== 'TemplateMOS');

/**
 * …of which these are the ones a player picks in the hero dialog. Only for counting the
 * roster and for "can everybody use this item": a piloted vehicle is neither a slot in
 * the lobby nor a carrier that a class-restriction chip is measured against.
 */
export const pickableMos = mosList.filter((m) => m.selectable !== false);

export const mosById = new Map(allMos.map((m) => [m.id, m]));

export function mosName(id: string): string {
	if (id === 'SiegeTankSieged') return 'AMX S-880 (sieged)';
	return mosById.get(id)?.name ?? id;
}

/** Class-page id for a MOS unit id, or null when no page exists (e.g. variants). */
export function mosPageId(id: string): string | null {
	if (mosById.has(id)) return id;
	if (id === 'SiegeTankSieged') return 'SiegeTank';
	return null;
}

export function usableItemsFor(mosId: string): Item[] {
	return items.filter((i) => i.playable && (i.allowed === null || i.allowed.includes(mosId)));
}

/** Short availability label: mission-specific items name their mission. */
export function sourceLabel(item: Item): string | null {
	const missionSources = item.sources.filter((s) => !/^item spawn|^game start/i.test(s));
	const cacheSources = item.sources.length !== missionSources.length;
	if (!missionSources.length) return null;
	if (cacheSources) return null; // also in the generic caches — not mission-locked
	return missionSources[0].split(' - ')[0];
}

export function siFor(mosId: string): Si[] {
	return skillIdentifiers.filter((s) => s.mos === mosId);
}

/**
 * The per-track XP an SI costs, as "EN 600 · WO 1,200". A threshold of 1 means
 * "no gate on that track", so it is left out; an empty string means the SI is
 * not bought with XP at all (the special-achievement row).
 */
export function siXpLabel(si: Si): string {
	return (
		[
			['EN', si.xp.en],
			['WO', si.xp.wo],
			['CO', si.xp.co]
		] as const
	)
		.filter(([, v]) => v > 1)
		.map(([t, v]) => `${t} ${v.toLocaleString('en')}`)
		.join(' · ');
}

// hybrids (Cyborg, Prototype: Biological · Mechanical) group with the infantry;
// "Mechanical classes" means the pure vehicles
const BIO_IDS = allMos.filter((m) => m.unitType !== 'Mechanical').map((m) => m.id);
const MECH_IDS = [
	...allMos.filter((m) => m.unitType === 'Mechanical').map((m) => m.id),
	'SiegeTankSieged'
];

/** Short human label for an item's class restriction. */
export function allowedLabel(item: Item): string | null {
	if (item.allowed === null) return null;
	const set = new Set(item.allowed);
	// every class you can actually pick — a piloted vehicle being left out (the Predator is
	// not Heroic, so Heroic-filtered items skip it) is not a restriction worth a chip
	if (pickableMos.every((m) => set.has(m.id))) return null;
	if (BIO_IDS.length && BIO_IDS.every((id) => set.has(id)) && !MECH_IDS.some((id) => set.has(id)))
		return 'Biological classes';
	if (MECH_IDS.some((id) => set.has(id)) && !BIO_IDS.some((id) => set.has(id)))
		return 'Mechanical classes';
	if (item.allowed.length === 1) return `${mosName(item.allowed[0])} only`;
	if (item.allowed.length <= 4) return item.allowed.map(mosName).join(', ');
	return `${item.allowed.length} classes`;
}
