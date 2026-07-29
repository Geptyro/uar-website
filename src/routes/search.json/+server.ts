/**
 * The command palette's entity index: GET /search.json.
 *
 * Prerendered, and fetched by the palette on its first open rather than at
 * page load — it is ~35 KB of names most visits never search, and the palette
 * is useful the moment it opens without it (pages, classes and SIs are already
 * in the layout's bundle, because the sidebar needs them anyway).
 *
 * Only the entities are here for that reason: units.json is 200 KB, and the
 * four fields a palette row shows are a fraction of it.
 */

import { json } from '@sveltejs/kit';
import { units } from '$lib/units';
import { mosList } from '$lib/mos';
import { shortCategory, type EntityIndexRow } from '$lib/palette';
import type { RequestHandler } from './$types';

export const prerender = true;

/** Classes get a `/mos/<id>` row of their own — richer page, same subject. */
const hasClassPage = new Set(mosList.map((m) => m.id));

export const GET: RequestHandler = () => {
	const index: EntityIndexRow[] = units
		.filter((u) => !hasClassPage.has(u.id))
		.map((u) => ({
			i: u.id,
			n: u.name,
			c: shortCategory(u.category),
			...(u.icon ? { p: u.icon } : {})
		}));
	return json(index);
};
