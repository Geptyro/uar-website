import { skillStatsFor } from '$lib/server/skillstats';
import type { PageServerLoad } from './$types';

/** The overview's own slice: the level rows of this class's skills and commands. */
export const load: PageServerLoad = ({ params }) => ({ stats: skillStatsFor(params.id) });
