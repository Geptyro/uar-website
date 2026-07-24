import rawMos from '$lib/data/mos.json';
import rawItems from '$lib/data/items.json';
import type { Weapon } from '$lib/units';

export interface Skill {
	id: string;
	name: string;
	levels: number | null;
	tooltip: string;
}

export interface CommonAbility {
	id: string;
	name: string;
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
	tooltip: string;
	skills: Skill[];
	common: CommonAbility[];
	inventory: { abil: string | null; slots: number; classes: string[] };
}

export interface ItemRestriction {
	kind: 'only' | 'not' | 'raw';
	units: string[];
	raw: string;
}

export interface Item {
	id: string;
	name: string;
	unit: string | null;
	class: string;
	kind: string;
	charges: { start: string | null; max: string } | null;
	mods: string[];
	restrictions: ItemRestriction[];
	tooltip: string;
}

export const allMos: Mos[] = rawMos as Mos[];
export const items: Item[] = rawItems as Item[];

/** Classes shown in the sidebar / index — the selectable roster. */
export const mosList = allMos.filter((m) => m.id !== 'TemplateMOS' && m.skills.length > 0);

export const mosById = new Map(allMos.map((m) => [m.id, m]));

/**
 * Item usability for one class, derived from the carry-buff validators.
 * 'yes'   — no restriction blocks this class
 * 'cond'  — has a restriction we can't fully resolve (shown with its raw name)
 * 'no'    — explicitly excluded ("only X" for another class, or "not [...]" listing it)
 */
export function itemUsability(item: Item, mosName: string): 'yes' | 'cond' | 'no' {
	// The sieged tank shares the AMX S-880 identity.
	const aliases = mosName === 'AMX S-880' ? [mosName, 'Siege Tank Sieged'] : [mosName];
	let conditional = false;
	for (const r of item.restrictions) {
		if (r.kind === 'only' && !r.units.some((u) => aliases.includes(u))) return 'no';
		if (r.kind === 'not' && r.units.some((u) => aliases.includes(u))) return 'no';
		if (r.kind === 'raw') conditional = true;
	}
	return conditional ? 'cond' : 'yes';
}

export function usableItemsFor(mosName: string): { sure: Item[]; conditional: Item[] } {
	const sure: Item[] = [];
	const conditional: Item[] = [];
	for (const item of items) {
		const u = itemUsability(item, mosName);
		if (u === 'yes') sure.push(item);
		else if (u === 'cond') conditional.push(item);
	}
	return { sure, conditional };
}

export function restrictionLabel(r: ItemRestriction): string {
	if (r.kind === 'only') return `Only: ${r.units.join(', ')}`;
	if (r.kind === 'not') return `Not: ${r.units.join(', ')}`;
	return r.raw;
}
