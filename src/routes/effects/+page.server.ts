import behaviors from '$lib/data/behaviors.json';
import type { Effect } from '$lib/effects';
import type { PageServerLoad } from './$types';

/**
 * The effects catalog: every buff, debuff, status and ailment the site names,
 * read from behaviors.json at build time. Server load, so the catalog stays out
 * of the client bundle; the page is prerendered like the rest of the wiki.
 */
export const load: PageServerLoad = () => ({ effects: behaviors as Effect[] });
