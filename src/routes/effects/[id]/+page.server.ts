import { error } from '@sveltejs/kit';
import behaviors from '$lib/data/behaviors.json';
import ailmentRules from '$lib/data/ailment-rules.json';
import type { Effect } from '$lib/effects';
import type { AilmentRules } from '$lib/rolls';
import { unitById } from '$lib/units';
import { unitLine } from '$lib/buildRefs';
import { items, mosById, pickableMos, skillIdentifiers } from '$lib/mos';
import { skillStatsFor } from '$lib/server/skillstats';
import { classLines, hitLines, split, type DamageLine, type LineChip, type RowLike } from '$lib/damageKinds';
import type { EntryGenerator, PageServerLoad } from './$types';

const all = behaviors as Effect[];
const byId = new Map(all.map((e) => [e.id, e]));
const rules = ailmentRules as AilmentRules;
/** The loop's table, slim: an ailment page works out its odds against every other one. */
const ailments = all.filter((e) => e.ailment).map(({ id, name, icon, ailment }) => ({ id, name, icon, ailment }));

/* Which keys of the rules and outcomes hold chips of which kind. */
const UNIT_KEYS = new Set(['units', 'spawns']);
const EFFECT_KEYS = new Set(['behaviors', 'behavior', 'applies', 'removes']);

function collect(v: unknown, kind: 'unit' | 'effect' | null, out: Set<string>): void {
	if (Array.isArray(v)) {
		for (const x of v) collect(x, kind, out);
		return;
	}
	if (!v || typeof v !== 'object') return;
	const o = v as Record<string, unknown>;
	if (kind && typeof o.id === 'string') out.add(`${kind}:${o.id}`);
	for (const [k, x] of Object.entries(o)) {
		collect(x, UNIT_KEYS.has(k) ? 'unit' : EFFECT_KEYS.has(k) ? 'effect' : null, out);
	}
}

/** The card text a chip shows: the same the guides' chips carry. */
function tipOf(key: string): string {
	const [kind, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
	if (kind === 'unit') {
		const u = unitById.get(id);
		return u ? u.tooltip || unitLine(u) : '';
	}
	const e = byId.get(id);
	return e ? e.tooltip || e.effects.join(', ') : '';
}

/** What a buff that raises or cuts a damage kind does to each class's hits. */
export interface BoostRow {
	id: string;
	name: string;
	icon: string | null;
	href: string;
	raised: LineChip[];
	not: LineChip[];
}

const lineCache = new Map<string, DamageLine[]>();

/** A class's hits: its weapons, then every skill and command that deals damage. */
function linesOf(id: string): DamageLine[] {
	let out = lineCache.get(id);
	if (!out) {
		const m = mosById.get(id)!;
		const abilities = [
			...m.skills.map((s) => ({ id: s.id, name: s.name, section: 'skill' as const })),
			...m.common.map((c) => ({ id: c.id, name: c.name, section: 'cmd' as const }))
		];
		out = classLines(`/mos/${id}`, m.weapons, abilities, skillStatsFor(id) as Record<string, RowLike[]>);
		lineCache.set(id, out);
	}
	return out;
}

/**
 * The classes that can carry the buff, or null when that is no class (an undead's
 * mutation, a debuff a class's gun puts on its target). An SI goes on whoever picks it
 * (or the one class it is made for); an ailment on any hero; a buff a class's own skill
 * or command puts on that class, or on anyone when it lands on a target (an ally).
 */
function holders(e: Effect): string[] | null {
	const everyone = pickableMos.map((m) => m.id);
	if (e.si) {
		const si = skillIdentifiers.find((s) => s.num === e.si!.num);
		return si?.mos ? [si.mos] : everyone;
	}
	if (e.ailment) return everyone;
	if (e.kind === 'debuff') return null;
	const refs = e.appliedBy.filter((r) => (r.kind === 'skill' || r.kind === 'command') && mosById.has(r.owner));
	if (!refs.length) return null;
	if (refs.some((r) => !r.self)) return everyone;
	return [...new Set(refs.map((r) => r.owner))];
}

function boostsOf(e: Effect) {
	if (!e.dmgKinds?.length) return null;
	const who = holders(e);
	if (!who) return null;
	const kinds = new Set(e.dmgKinds.map((m) => m.kind));
	const rows: BoostRow[] = [];
	for (const id of who) {
		const m = mosById.get(id);
		const lines = linesOf(id);
		if (!m || !lines.length) continue;
		rows.push({ id, name: m.name, icon: m.icon, href: `/mos/${id}`, ...split(lines, e.id, kinds) });
	}
	// the item guns any of them can pick up, once
	const itemLines = items
		.filter((i) => i.playable && i.grants.length && (i.allowed === null || i.allowed.some((a) => who.includes(a))))
		.flatMap((i) => i.grants.flatMap((g) => hitLines(g, i.name, i.unit ? `/entities/${i.unit}` : '')));
	const dummy = rows.some((r) => [...r.raised, ...r.not].some((c) => c.dummy));
	return {
		kinds: e.dmgKinds,
		rows,
		items: itemLines.length ? split(itemLines, e.id, kinds) : null,
		dummy
	};
}

/** Every effect prerenders its own page. */
export const entries: EntryGenerator = () => all.map((e) => ({ id: e.id }));

export const load: PageServerLoad = ({ params }) => {
	const effect = byId.get(params.id);
	if (!effect) error(404, `No effect "${params.id}"`);
	const keys = new Set<string>([`effect:${effect.id}`, ...ailments.map((a) => `effect:${a.id}`)]);
	if (effect.ailment) collect(rules, null, keys);
	collect(effect.outcomes ?? [], null, keys);
	const tips = Object.fromEntries([...keys].map((k) => [k, tipOf(k)]).filter(([, t]) => t));
	return { effect, rules, ailments, tips, boosts: boostsOf(effect) };
};
