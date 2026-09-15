/**
 * The effects catalog (behaviors.json): what a buff, debuff, status or ailment
 * does, how long it lasts, what puts it on you and what takes it off. Built by
 * the extractor from the behaviour catalog and the map script's ailment table.
 */

import type { EffectOutcome } from './rolls.ts';

export type EffectKind = 'ailment' | 'debuff' | 'buff' | 'status';

export interface EffectRef {
	kind: 'skill' | 'command' | 'entity' | 'weapon' | 'item';
	owner: string;
	ownerName: string;
	ability: string;
	abilityName: string;
	/** The level of the ability that applies it, when it has levels. */
	level?: number;
	/** Items: the entity page of the item's unit, when it has one. */
	unit?: string;
	/** The ability's own art, and the class's or unit's. */
	abilityIcon?: string | null;
	ownerIcon?: string | null;
}

export interface Effect {
	id: string;
	name: string;
	kind: EffectKind;
	icon: string | null;
	tooltip: string;
	effects: string[];
	/** The game hides it from the unit's status bar. */
	hidden: boolean;
	dur?: number;
	/** The duration is rolled ± this many seconds. */
	durSpread?: number;
	stacks?: number;
	ailment?: {
		/** Its slot in the script's ailment table: the order the loop rolls them in. */
		index: number;
		/** Its own 1 in N, once the global roll passed. The rest of the roll is ailment-rules.json. */
		chance: number;
	};
	/** What it does when it ticks, runs out or ends, where that rolls, kills, spawns or cures (lib/rolls). */
	outcomes?: EffectOutcome[];
	appliedBy: EffectRef[];
	curedBy: EffectRef[];
}

export const KIND_LABELS: Record<EffectKind, { label: string; note: string }> = {
	ailment: {
		label: 'Ailments',
		note: 'Wounds and infections the map rolls on a hero who takes a hit. A medic cures them.'
	},
	debuff: { label: 'Debuffs', note: 'What hostile hits and your own weapons put on their targets.' },
	buff: { label: 'Buffs', note: 'What skills, commands and items put on you and your allies.' },
	status: { label: 'Statuses', note: 'States with no side: a stance, a mode, a marker the script reads.' }
};

export const KIND_ORDER: EffectKind[] = ['ailment', 'debuff', 'buff', 'status'];

/** An effect's own page. */
export function effectHref(id: string): string {
	return `/effects/${encodeURIComponent(id)}`;
}

/** Where a reference points: the ability's card on its class or entity page. */
export function refHref(r: EffectRef): string | null {
	switch (r.kind) {
		case 'skill':
			return `/mos/${r.owner}#skill-${r.ability}`;
		case 'command':
			return `/mos/${r.owner}#cmd-${r.ability}`;
		case 'entity':
			return `/entities/${r.owner}#abil-${r.ability}`;
		case 'weapon':
			return r.owner.startsWith('/') ? r.owner : `/entities/${r.owner}`;
		case 'item':
			return r.unit ? `/entities/${r.unit}` : null;
	}
}

/** The page of the class, unit or item the reference sits on. */
export function ownerHref(r: EffectRef, isClass: (id: string) => boolean): string | null {
	switch (r.kind) {
		case 'skill':
		case 'command':
			return `/mos/${r.owner}`;
		case 'entity':
			return `/entities/${encodeURIComponent(r.owner)}`;
		case 'weapon':
			return isClass(r.owner) ? `/mos/${r.owner}` : `/entities/${encodeURIComponent(r.owner)}`;
		case 'item':
			return r.unit ? `/entities/${encodeURIComponent(r.unit)}` : null;
	}
}

/** One ability in an "applied by" or "cured by" list, with every class and unit that has it. */
export interface RefGroup {
	key: string;
	name: string;
	icon: string | null;
	/** Where the name links: a class's card before a unit's. */
	first: EffectRef;
	/** How it comes (standard ability, ability, item…), in order of first appearance. */
	kinds: EffectRef['kind'][];
	/** The levels of the ability that do it; empty unless every reference has one, since
	    a level on one class's copy says nothing about the others. */
	levels: number[];
	classes: EffectRef[];
	units: EffectRef[];
}

/**
 * References grouped by the ability's name, the way a reader sees it: every
 * class's Perform Self-Aid, and the copy the data keeps under another id for
 * twenty-eight NPC units, is one row. Owners split into classes and other units,
 * each listed once, in the order the extractor found them.
 */
export function groupRefs(refs: EffectRef[], isClass: (id: string) => boolean): RefGroup[] {
	const by = new Map<string, RefGroup>();
	const unleveled = new Set<string>();
	for (const r of refs) {
		const key = r.abilityName.trim().toLowerCase();
		let g = by.get(key);
		if (!g) {
			g = { key, name: r.abilityName, icon: r.abilityIcon ?? null, first: r, kinds: [], levels: [], classes: [], units: [] };
			by.set(key, g);
		}
		const cls = r.kind !== 'item' && isClass(r.owner);
		if (cls && !(g.first.kind !== 'item' && isClass(g.first.owner))) g.first = r;
		if (!g.icon && r.abilityIcon) g.icon = r.abilityIcon;
		if (!g.kinds.includes(r.kind)) g.kinds.push(r.kind);
		if (!r.level) unleveled.add(key);
		else if (!g.levels.includes(r.level)) g.levels.push(r.level);
		const side = cls ? g.classes : g.units;
		if (!side.some((o) => o.owner === r.owner)) side.push(r);
	}
	for (const g of by.values()) g.levels = unleveled.has(g.key) ? [] : g.levels.sort((a, b) => a - b);
	return [...by.values()];
}
