import { mapRegions } from '$lib/map';
import { groupById, groupOfTrigger } from '$lib/groups';
import { allTriggers } from '$lib/server/triggers';
import type { PageServerLoad } from './$types';

export interface RegionUse {
	/** The group, and which of its triggers name the region. */
	id: string;
	name: string;
	type: string;
	triggers: string[];
}

/* Which trigger groups name each region, from the triggers' own references
   (RegionFromId in their block) and the regions their events listen on. A
   real link, not a name match; only groups with a page count. */
export const load: PageServerLoad = () => {
	const idByName = new Map(mapRegions.map((r) => [r.name, r.id]));
	const uses: Record<number, RegionUse[]> = {};
	for (const n of allTriggers()) {
		const gid = groupOfTrigger.get(n.id);
		if (!gid) continue;
		const g = groupById.get(gid)!;
		const regions = new Set<number>(n.refs?.regions ?? []);
		for (const e of n.events)
			if (e.type === 'UnitRegion' && typeof e.arg === 'string') {
				const id = idByName.get(e.arg);
				if (id !== undefined) regions.add(id);
			}
		for (const rid of regions) {
			const list = (uses[rid] ??= []);
			let u = list.find((x) => x.id === gid);
			if (!u) list.push((u = { id: gid, name: g.name, type: g.type, triggers: [] }));
			if (!u.triggers.includes(n.name)) u.triggers.push(n.name);
		}
	}
	return { uses };
};
