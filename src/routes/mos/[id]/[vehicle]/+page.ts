import { error } from '@sveltejs/kit';
import { allMos, mosById, usableItemsFor } from '$lib/mos';
import { vehicleSlug } from '$lib/mosTabs';
import type { EntryGenerator, PageLoad } from './$types';

/**
 * Only the classes that bring a vehicle have this tab, and each has it under
 * the vehicle's own name — /mos/AssaultEngineer/predator. The folder is a
 * parameter so the name is not spelled out in the route table; the loader
 * turns away any other value, so it does not become a catch-all.
 */
export const entries: EntryGenerator = () =>
	allMos
		.filter((m) => m.vehicle && mosById.get(m.vehicle))
		.map((m) => ({ id: m.id, vehicle: vehicleSlug(mosById.get(m.vehicle!)!.name) }));

export const load: PageLoad = ({ params, parent }) =>
	parent().then(({ mos, vehicle }) => {
		if (!vehicle || vehicleSlug(vehicle.name) !== params.vehicle) {
			error(404, `No "${params.vehicle}" tab on the ${mos.name}`);
		}
		return { vehicle, vehicleItems: usableItemsFor(vehicle.id) };
	});
