import { error } from '@sveltejs/kit';
import { allMos, mosById, usableItemsFor, siFor } from '$lib/mos';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => allMos.map((m) => ({ id: m.id }));

export const load: PageLoad = ({ params }) => {
	const mos = mosById.get(params.id);
	if (!mos) error(404, `No MOS class with id "${params.id}"`);
	return { mos, items: usableItemsFor(mos.id), si: siFor(mos.id) };
};
