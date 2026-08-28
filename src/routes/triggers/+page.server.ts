import { groupOfTrigger } from '$lib/groups';
import { allTriggers } from '$lib/server/triggers';
import type { PageServerLoad } from './$types';

/* The triggers armed by a fixed game time, for the index's timeline: only
   the ones that belong to a group, since those are the ones with a page. */
export const load: PageServerLoad = () => {
	const scheduled = allTriggers()
		.flatMap((n) =>
			n.events
				.filter((e) => e.type === 'TimeElapsed' && typeof e.arg === 'number')
				.map((e) => ({ at: e.arg as number, id: n.id, name: n.name, group: groupOfTrigger.get(n.id) ?? null }))
		)
		.filter((s) => s.group)
		.sort((a, b) => a.at - b.at || a.name.localeCompare(b.name));
	return { scheduled };
};
