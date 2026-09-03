import raw from '$lib/data/skillstats.json';
import type { ClassStats } from '$lib/skillstats';

/** Every class's level rows, kept server-side: a page gets its own class's slice. */
const all = raw as Record<string, ClassStats>;

export function skillStatsFor(mosId: string): ClassStats {
	return all[mosId] ?? {};
}
