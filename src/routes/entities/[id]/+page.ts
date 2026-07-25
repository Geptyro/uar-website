import { error } from '@sveltejs/kit';
import { unitById, units } from '$lib/units';
import models from '$lib/data/models.json';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => units.map((u) => ({ id: u.id }));

export const load: PageLoad = ({ params }) => {
	const unit = unitById.get(params.id);
	if (!unit) error(404, `No unit with id "${params.id}"`);

	const children = units
		.filter((u) => u.parent === unit.id)
		.sort((a, b) => a.id.localeCompare(b.id));

	return { unit, children, modelUrl: (models as Record<string, string>)[unit.id] ?? null };
};
