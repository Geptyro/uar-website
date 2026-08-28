import { error, redirect } from '@sveltejs/kit';
import { mosById, mosCapabilities, usableItemsFor, siFor } from '$lib/mos';
import { mosTabHref, tabsFor, vehicleSlug } from '$lib/mosTabs';
import type { LayoutLoad } from './$types';

/**
 * What every tab of a class page needs: the class, what it can use, and which
 * tabs it has. Each tab's own loader adds only its slice.
 *
 * A piloted vehicle has no page of its own any more — it is a tab of the
 * class that brings it — so its old URL sends the reader there. Permanent, so
 * a search engine moves its listing rather than keeping a stub.
 */
export const load: LayoutLoad = ({ params }) => {
	const mos = mosById.get(params.id);
	if (!mos) error(404, `No MOS class with id "${params.id}"`);
	if (mos.pilotedBy) redirect(308, mosTabHref(mos.pilotedBy, vehicleSlug(mos.name)));

	const vehicle = mos.vehicle ? (mosById.get(mos.vehicle) ?? null) : null;
	const capabilities = mosCapabilities(mos.id);
	return {
		mos,
		vehicle,
		items: usableItemsFor(mos.id),
		si: siFor(mos.id),
		capabilities,
		tabs: tabsFor(capabilities, vehicle)
	};
};
