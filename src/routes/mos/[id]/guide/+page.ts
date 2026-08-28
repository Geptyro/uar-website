import { redirect } from '@sveltejs/kit';
import { mosTabHref } from '$lib/mosTabs';
import type { PageLoad } from './$types';

/**
 * Where the hand-written class guides used to be. The players' guides took
 * the name and the tab, so the old address moves there for good.
 */
export const prerender = false;

export const load: PageLoad = ({ params }) => {
	redirect(308, mosTabHref(params.id, 'guides'));
};
