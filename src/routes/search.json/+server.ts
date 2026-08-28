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
import { listedUnits as units } from '$lib/units';
import { mosList } from '$lib/mos';
import { groups } from '$lib/groups';
import { triggerById } from '$lib/server/triggers';
import { shortCategory, type IndexRow } from '$lib/palette';
import type { RequestHandler } from './$types';

export const prerender = true;

/** Classes get a `/mos/<id>` row of their own — richer page, same subject. */
const hasClassPage = new Set(mosList.map((m) => m.id));

export const GET: RequestHandler = () => {
	const index: IndexRow[] = [
		...units
			.filter((u) => !hasClassPage.has(u.id))
			.map((u) => ({
				i: u.id,
				n: u.name,
				c: shortCategory(u.category),
				...(u.icon ? { p: u.icon } : {})
			})),
		/* the trigger groups, by name, and by what a reader remembers of them:
		   an outcome's words, a trigger's name */
		...groups.map((g) => ({
			g: g.id,
			n: g.name,
			t: g.type,
			k: g.triggers.length,
			a: [...new Set([...g.outcomes.map((o) => o.name), ...g.triggers.map((t) => triggerById(t)?.name ?? t)])]
		}))
	];
	return json(index);
};
