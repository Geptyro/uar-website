import { error } from '@sveltejs/kit';
import { unitById } from '$lib/units';
import type { LayoutLoad } from './$types';

/**
 * What every tab of an entity page needs: the entity, for the bar's name.
 * The overview's own loader adds its slice (the model, the abilities, the
 * script references) and the comments tab adds the thread.
 */
export const load: LayoutLoad = ({ params }) => {
	const unit = unitById.get(params.id);
	if (!unit) error(404, `No unit with id "${params.id}"`);
	return { unit };
};
