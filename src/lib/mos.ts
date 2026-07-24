import rawMos from '$lib/data/mos.json';
import rawItems from '$lib/data/items.json';
import rawSi from '$lib/data/si.json';
import rawRanks from '$lib/data/ranks.json';
import type { Weapon } from '$lib/units';

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

export interface Mos {
	id: string;
	name: string;
	mos: string;
	role: string;
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
}

export type ItemType = 'weapon' | 'armor' | 'equipment' | 'consumable' | 'supply';

export interface Item {
	id: string;
	name: string;
	unit: string | null;
	class: string;
	kind: string;
	type: ItemType;
	charges: { start: string | null; max: string } | null;
	mods: string[];
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

export interface Rank {
	idx: number;
	icon: string | null;
	xp: number;
	prefix: string;
	name: string;
}

export interface RankTrack {
	track: number;
	name: string;
	ranks: Rank[];
}

export const allMos: Mos[] = rawMos as Mos[];
export const items: Item[] = rawItems as Item[];
export const skillIdentifiers: Si[] = rawSi as Si[];
export const rankTracks: RankTrack[] = rawRanks as RankTrack[];

/** Classes shown in the sidebar / index — the selectable roster. */
export const mosList = allMos.filter((m) => m.id !== 'TemplateMOS' && m.skills.length > 0);

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
	return items.filter((i) => i.allowed === null || i.allowed.includes(mosId));
}

export function siFor(mosId: string): Si[] {
	return skillIdentifiers.filter((s) => s.mos === mosId);
}

/** Short human label for an item's class restriction. */
export function allowedLabel(item: Item): string | null {
	if (item.allowed === null) return null;
	if (item.allowed.length === 1) return `${mosName(item.allowed[0])} only`;
	if (item.allowed.length <= 4) return item.allowed.map(mosName).join(', ');
	return `${item.allowed.length} classes`;
}
