import { mosById } from '$lib/mos';
import { skillStatsFor } from '$lib/server/skillstats';
import type { PageServerLoad } from './$types';

/** The vehicle's level rows — its commands are the vehicle's, not the pilot's. */
export const load: PageServerLoad = ({ params }) => {
	const pilot = mosById.get(params.id);
	return { vehicleStats: pilot?.vehicle ? skillStatsFor(pilot.vehicle) : {} };
};
