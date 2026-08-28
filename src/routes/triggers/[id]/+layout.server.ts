import { error } from '@sveltejs/kit';
import { groupById, groupOfTrigger } from '$lib/groups';
import { gatesInto, gatesWithin, triggerById, triggerSubgraph } from '$lib/server/triggers';
import { units } from '$lib/units';
import type { LayoutServerLoad } from './$types';

/* What every tab of a group page needs: the group's triggers, cut out of
   the full graph here with everything they reference, so the browser only
   ever sees the handful this page is about. Context — what armed it, what it
   waits for — comes with the trigger that does it and the group that trigger
   belongs to, if any. */
export const load: LayoutServerLoad = ({ params }) => {
	const group = groupById.get(params.id);
	if (!group) error(404, `No trigger group "${params.id}"`);
	const flow = triggerSubgraph(group.triggers);
	const gates = gatesWithin(group.triggers);
	const context = (id: string) => {
		const t = triggerById(id);
		return {
			id,
			name: t?.name ?? id,
			events: t?.events ?? [],
			group: groupOfTrigger.get(id) ?? null
		};
	};
	const armedBy = group.armedBy.map((a) => context(a.id));
	const waits = gatesInto(group.triggers)
		.filter((g, i, all) => all.findIndex((o) => o.from.id === g.from.id && o.via === g.via) === i)
		.map((g) => ({ from: context(g.from.id), to: g.to, via: g.via }));
	/* the names of the unit types on the page, for the map's labels; only
	   those, so the page does not carry the whole unit list */
	const types = new Set(
		flow.flatMap((n) => [
			...(n.refs?.spawns.map((s) => s.type) ?? []),
			...(n.refs?.units.map((u) => u.type) ?? []),
			...(n.refs?.actors.flatMap((a) => (a.type ? [a.type] : [])) ?? [])
		])
	);
	const unitNames: Record<string, string> = {};
	const unitIcons: Record<string, string> = {};
	for (const u of units) {
		if (!types.has(u.id)) continue;
		if (u.name) unitNames[u.id] = u.name;
		if (u.icon) unitIcons[u.id] = u.icon;
	}
	return { group, flow, gates, armedBy, waits, unitNames, unitIcons };
};
