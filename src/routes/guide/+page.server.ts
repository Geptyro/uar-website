import behaviors from '$lib/data/behaviors.json';
import type { Effect } from '$lib/effects';
import { rules } from '$lib/mechanics';
import type { PageServerLoad } from './$types';

/**
 * The carry cap's states, as the Effects catalog has them. The guide draws
 * them as reference chips, and a chip's hover card wants the panel's own
 * words, which the slim client-side index does not carry. Server load, so
 * the full catalog stays out of the client bundle.
 */
export const load: PageServerLoad = () => {
	const wanted = new Set(rules.ammo.tiers.map((t) => t.behavior));
	return {
		tierEffects: (behaviors as Effect[])
			.filter((e) => wanted.has(e.id))
			.map((e) => ({ id: e.id, tooltip: e.tooltip }))
	};
};
