import { error } from '@sveltejs/kit';
import behaviors from '$lib/data/behaviors.json';
import ailmentRules from '$lib/data/ailment-rules.json';
import type { Effect } from '$lib/effects';
import type { AilmentRules } from '$lib/rolls';
import { unitById } from '$lib/units';
import { unitLine } from '$lib/buildRefs';
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

/** Every effect prerenders its own page. */
export const entries: EntryGenerator = () => all.map((e) => ({ id: e.id }));

export const load: PageServerLoad = ({ params }) => {
	const effect = byId.get(params.id);
	if (!effect) error(404, `No effect "${params.id}"`);
	const keys = new Set<string>([`effect:${effect.id}`, ...ailments.map((a) => `effect:${a.id}`)]);
	if (effect.ailment) collect(rules, null, keys);
	collect(effect.outcomes ?? [], null, keys);
	const tips = Object.fromEntries([...keys].map((k) => [k, tipOf(k)]).filter(([, t]) => t));
	return { effect, rules, ailments, tips };
};
