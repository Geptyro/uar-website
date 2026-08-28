import { redirect } from '@sveltejs/kit';
import { careerHref } from '$lib/careerTabs';
import type { PageLoad } from './$types';

/**
 * Where this list used to live before the career section gathered the four
 * of them under one frame. Bookmarks and the old sitemap still know this
 * address, so it moves for good rather than vanishing.
 */
export const prerender = false;

export const load: PageLoad = () => {
	redirect(308, careerHref(''));
};
