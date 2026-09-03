import { error } from '@sveltejs/kit';
import behaviors from '$lib/data/behaviors.json';
import type { Effect } from '$lib/effects';
import type { EntryGenerator, PageServerLoad } from './$types';

const all = behaviors as Effect[];
const byId = new Map(all.map((e) => [e.id, e]));

/** Every effect prerenders its own page. */
export const entries: EntryGenerator = () => all.map((e) => ({ id: e.id }));

export const load: PageServerLoad = ({ params }) => {
	const effect = byId.get(params.id);
	if (!effect) error(404, `No effect "${params.id}"`);
	return { effect };
};
