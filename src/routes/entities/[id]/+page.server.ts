import { error, redirect } from '@sveltejs/kit';
import { unitById, units, type Unit, type UnitAbility } from '$lib/units';
import { scriptRefs, type RefRole } from '$lib/refs';
import { triggerSubgraph } from '$lib/server/triggers';
import { eventLabel, flowById } from '$lib/flow';
import { modelVariants } from '$lib/models';
import abilities from '$lib/data/abilities.json';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => units.map((u) => ({ id: u.id }));

/** One trigger's dealings with the unit, ready to print. */
export interface ScriptRef {
	id: string;
	name: string;
	/** What makes the trigger fire; empty when it is only ever run by another trigger. */
	when: string[];
	/** On the /flow graph, so the name can link there. */
	flow: boolean;
	roles: RefRole[];
	via: string | null;
}

// Server load, not universal: abilities.json, refs.json and the trigger catalogue
// are big and the page only needs its own slice; the pages are prerendered, so
// this runs at build time.
export const load: PageServerLoad = ({ params }) => {
	const unit = unitById.get(params.id);
	if (!unit) error(404, `No unit with id "${params.id}"`);
	// a pickup form has no page of its own: it is folded into the unit it deploys as
	if (unit.deploys && unitById.has(unit.deploys)) redirect(301, `/entities/${unit.deploys}`);

	const children = units
		.filter((u) => u.parent === unit.id)
		.sort((a, b) => a.id.localeCompare(b.id));

	// the merged page speaks for the pickup forms too: their triggers (the item spawn
	// tables, the placing trigger) belong here, once each
	const rows = [unit.id, ...(unit.pickups ?? [])]
		.flatMap((id) => scriptRefs(id))
		.filter((r, i, all) => all.findIndex((o) => o.t === r.t) === i);
	const nodes = new Map(triggerSubgraph(rows.map((r) => r.t)).map((n) => [n.id, n]));
	const refs: ScriptRef[] = rows.flatMap((r) => {
		const n = nodes.get(r.t);
		if (!n) return [];
		const when = n.events.length
			? [...new Set(n.events.map(eventLabel))]
			: n.armed
				? []
				: ['chained from another trigger'];
		return [{ id: n.id, name: n.name, when, flow: flowById.has(n.id), roles: r.roles, via: r.via }];
	});

	const pickups = (unit.pickups ?? []).map((id) => unitById.get(id)).filter((u): u is Unit => !!u);

	return {
		unit,
		pickups: pickups.map((p) => ({ id: p.id, name: p.name || p.id })),
		children,
		models: modelVariants(unit.id),
		abilities: (abilities as Record<string, UnitAbility[]>)[unit.id] ?? [],
		refs
	};
};
