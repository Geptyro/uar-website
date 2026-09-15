/**
 * Rolls, read rather than retold: the gates and dice between a hit and an ailment
 * (ailment-rules.json, the extractor's reading of gt_Ailments) and what an effect
 * does when it ticks, runs out or ends (an entry's `outcomes`, from the data's
 * effect trees with every Chance multiplied down). One model, so every way a page
 * draws a roll shows the same numbers, and every number is computed here.
 *
 * Pure: the caller hands in the JSON, so the tests can run it without Vite.
 */

import type { Effect } from './effects.ts';

export interface Ref {
	id: string;
	name: string;
	icon?: string | null;
	/** Units: an entity page exists. */
	page?: boolean;
}

export type Gate =
	| { kind: 'minDamage'; value: number }
	| { kind: 'effect'; is: boolean; effects: (Ref & { behavior?: Ref })[] }
	| { kind: 'playerUnit' }
	| { kind: 'targetAttr'; attr: string; is: boolean; classes: { of: number; lacking: Ref[] } }
	| { kind: 'targetHas'; is: boolean; behaviors: Ref[] }
	| { kind: 'sourceType'; is: boolean; units: Ref[] }
	| { kind: 'sourceSide'; is: boolean; player: number; side?: string }
	| { kind: 'raw'; text: string };

export interface AilmentRules {
	/** Every one must hold for the trigger to roll at all. */
	gates: Gate[];
	/** The global 1 in N, as each mode sets it. */
	global?: { base: number | null; byMode: Record<string, number> };
	/** A hit matching any of these picks one of the indexes at random instead (the venoms). */
	pick?: { indexes: number[]; any: Gate[] };
	/** Every other hit rolls the indexes in order; the first to land is applied. */
	order?: {
		from: number;
		to: number | null;
		firstWins: boolean;
		/** Landing on one of these indexes without its needs ends the loop with nothing. */
		stops: { indexes: number[]; need: Gate[] }[];
	};
}

export type EffectOutcomeWhen = 'start' | 'tick' | 'refresh' | 'expire' | 'end';

export interface EffectOutcome {
	when: EffectOutcomeWhen;
	/** 0..1, every Chance on the way down multiplied. */
	chance: number;
	/** Ticks: seconds between two. */
	period?: number;
	kills?: boolean;
	spawns?: (Ref & { side?: string; script?: boolean })[];
	applies?: Ref[];
	removes?: Ref[];
	curesAilments?: boolean;
}

export interface LadderRow {
	effect: Pick<Effect, 'id' | 'name' | 'icon'>;
	index: number;
	/** Its own 1 in N. */
	n: number;
	/** Chance its roll is reached: every roll above it missed. */
	reach: number;
	/** Chance it is the one applied, once the global roll passed. */
	lands: number;
	/** What must hold for it to apply; landing without them ends the loop. */
	need: Gate[];
	/** The ailment the chain is for. */
	self: boolean;
}

export interface AilmentChain {
	gates: Gate[];
	/** The global roll's N for the mode asked, null when the script has none. */
	global: number | null;
	route: 'pick' | 'order';
	/** Pick route: who triggers it and the ailments it picks among. */
	pick?: { any: Gate[]; among: LadderRow[] };
	/** Order route: the whole loop, the target row, and the rows it never reaches. */
	order?: { rows: LadderRow[]; target: LadderRow };
	/** Once the global roll passed: pick share, or the target's `lands`. */
	afterGlobal: number;
	/** Per qualifying hit, the global roll included. */
	perHit: number;
}

/** The global roll's N on a mode (1..12), falling back to the script's first value. */
export function globalN(rules: AilmentRules, mode: number): number | null {
	const g = rules.global;
	if (!g) return null;
	return g.byMode[String(mode)] ?? g.base;
}

/** The chain of gates and rolls that puts this ailment on a hero, for one mode. */
export function ailmentChain(
	effect: Effect,
	rules: AilmentRules,
	ailments: Pick<Effect, 'id' | 'name' | 'icon' | 'ailment'>[],
	mode: number
): AilmentChain | null {
	const own = effect.ailment;
	if (!own) return null;
	const N = globalN(rules, mode);
	const g = N ? 1 / N : 1;
	const byIndex = new Map(ailments.filter((a) => a.ailment).map((a) => [a.ailment!.index, a]));
	const row = (index: number, reach: number, need: Gate[]): LadderRow | null => {
		const a = byIndex.get(index);
		if (!a?.ailment) return null;
		const n = a.ailment.chance;
		return {
			effect: { id: a.id, name: a.name, icon: a.icon },
			index,
			n,
			reach,
			lands: reach / n,
			need,
			self: a.id === effect.id
		};
	};

	if (rules.pick?.indexes.includes(own.index)) {
		const share = 1 / rules.pick.indexes.length;
		const among = rules.pick.indexes
			.map((i) => row(i, 1, []))
			.filter((r): r is LadderRow => !!r)
			.map((r) => ({ ...r, lands: share }));
		return {
			gates: rules.gates,
			global: N,
			route: 'pick',
			pick: { any: rules.pick.any, among },
			afterGlobal: share,
			perHit: g * share
		};
	}

	const o = rules.order;
	if (!o) return null;
	const to = o.to ?? Math.max(...byIndex.keys());
	const rows: LadderRow[] = [];
	let reach = 1;
	for (let i = o.from; i <= to; i++) {
		const need = o.stops.find((s) => s.indexes.includes(i))?.need ?? [];
		const r = row(i, reach, need);
		if (!r) continue;
		rows.push(r);
		// the loop moves on only when this roll missed, needs or not: a landed roll
		// either applies (and the loop ends) or stops the loop with nothing
		if (o.firstWins) reach *= 1 - 1 / r.n;
	}
	const target = rows.find((r) => r.self);
	if (!target) return null;
	return {
		gates: rules.gates,
		global: N,
		route: 'order',
		order: { rows, target },
		afterGlobal: target.lands,
		perHit: g * target.lands
	};
}

/** A chance as a percent a person reads: two significant digits under 10%, whole above. */
export function pct(p: number): string {
	const v = p * 100;
	if (v === 0) return '0%';
	if (v >= 10) return `${Math.round(v)}%`;
	if (v >= 1) return `${v.toFixed(1).replace(/\.0$/, '')}%`;
	return `${v.toPrecision(2)}%`;
}

/** A chance as "1 every N", N rounded: how often it happens, in hits or tries. */
export function every(p: number): string {
	return p > 0 ? `1 every ${Math.round(1 / p).toLocaleString('en')}` : 'never';
}

export const WHEN_LABEL: Record<EffectOutcomeWhen, string> = {
	start: 'When it starts',
	tick: 'Every tick',
	refresh: 'When it is applied again',
	expire: 'When it runs out',
	end: 'When it ends'
};

/** The heading an outcome sits under ("Every 3 s" for a tick with a period). */
export function whenLabel(o: EffectOutcome): string {
	return o.when === 'tick' && o.period ? `Every ${o.period} s` : WHEN_LABEL[o.when];
}

/** What an expire outcome skips: the timer has to run out, so any removal avoids it. */
export function whenNote(o: EffectOutcome): string | null {
	if (o.when === 'expire') return 'Only if it runs its full course: a cure or a revive removes it with no roll.';
	if (o.when === 'end') return 'However it ends, cured or run out.';
	return null;
}

/** Distinct names in order: seven Plasma Shield behaviours read as one, the one
 * `prefer` picks when there is one (the catalog's, which has a page and a text). */
export function uniqueByName<T extends Ref>(refs: T[], prefer?: (r: T) => boolean): T[] {
	const byName = new Map<string, T>();
	for (const r of refs) {
		const had = byName.get(r.name);
		if (!had || (prefer && !prefer(had) && prefer(r))) byName.set(r.name, r);
	}
	return [...byName.values()];
}

/** "a, b or c" / "a, b and c". */
export function list(words: string[], last: 'or' | 'and'): string {
	if (words.length < 2) return words[0] ?? '';
	return `${words.slice(0, -1).join(', ')} ${last} ${words[words.length - 1]}`;
}

/** A gate as one plain sentence fragment, for places with no room for chips. */
export function gateText(g: Gate): string {
	switch (g.kind) {
		case 'minDamage':
			return `a hit of ${g.value}+ damage`;
		case 'effect': {
			const names = uniqueByName(g.effects.map((e) => e.behavior ?? e)).map((r) => r.name);
			return g.is ? `by ${list(names, 'or')}` : `not a ${list(names, 'or')} tick`;
		}
		case 'playerUnit':
			return "a player's unit";
		case 'targetAttr':
			return `the hero is ${g.is ? '' : 'not '}${g.attr.toLowerCase()}`;
		case 'targetHas': {
			const names = uniqueByName(g.behaviors).map((r) => r.name);
			return g.is ? `under ${list(names, 'or')}` : `no ${list(names, 'or')}`;
		}
		case 'sourceType': {
			const names = uniqueByName(g.units).map((r) => r.name);
			return g.is ? `from a ${list(names, 'or')}` : `not from a ${list(names, 'or')}`;
		}
		case 'sourceSide':
			return `${g.is ? 'from' : 'not from'} ${g.side ? `the ${g.side}` : `player ${g.player}`}`;
		case 'raw':
			return g.text;
	}
}

/** The short rule a list row carries: the global roll and this ailment's share of it. */
export function ailmentSummary(chain: AilmentChain): string {
	const global = chain.global ? `1 in ${chain.global} qualifying hits roll an ailment` : 'Every qualifying hit rolls';
	if (chain.route === 'pick') {
		const from = chain.pick!.any.map(gateText).join(', or ');
		return `${global}; a hit ${from} picks one of ${chain.pick!.among.length} at random. ${pct(chain.perHit)} per hit.`;
	}
	const t = chain.order!.target;
	return `${global}; this one is roll ${chain.order!.rows.indexOf(t) + 1} of ${chain.order!.rows.length}, ${pct(chain.afterGlobal)} of those. ${pct(chain.perHit)} per hit.`;
}
