/**
 * The effects catalog (behaviors.json): what a buff, debuff, status or ailment
 * does, how long it lasts, what puts it on you and what takes it off. Built by
 * the extractor from the behaviour catalog and the map script's ailment table.
 */

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
		index: number;
		/** One in this many, on a hit that passed the global roll. */
		chance: number;
		globalChance: number | null;
		/** The two venoms: only from the spiders, the crab and a Swollen's burst. */
		venom: boolean;
		/** Only from the undead's own attacks. */
		undeadOnly: boolean;
		/** Never on a heroic unit. */
		sparesHeroic: boolean;
		/** Dying with it raises the hero as a Risen. */
		risen?: boolean;
	};
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

/** The sentence an ailment's rules make. */
export function ailmentRule(e: Effect): string {
	const a = e.ailment;
	if (!a) return '';
	const gate = a.globalChance ? `passes a 1 in ${a.globalChance} roll, then ` : '';
	const own = `1 in ${a.chance}`;
	if (a.venom) {
		return `A bite of the Tarantula, the Arachnid Mother or the Crab, or a Swollen's burst, ${gate}one of the two venoms.`;
	}
	const who = a.undeadOnly ? "an undead's own attack" : 'any hit of 15 or more damage';
	const spare = a.sparesHeroic ? ', never on a heroic unit' : '';
	const risen = a.risen ? ' A hero who dies with it rises as a Risen.' : '';
	return `${who[0].toUpperCase()}${who.slice(1)} on a biological hero without a plasma shield ${gate}${own} for this one${spare}.${risen}`;
}
