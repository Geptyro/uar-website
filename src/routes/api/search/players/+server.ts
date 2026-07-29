/**
 * Player lookup for the command palette: GET /api/search/players?q=<term>
 * -> { players: PlayerHit[] }, the best few by career XP.
 *
 * The palette's static half (pages, classes, SIs, entities) is prerendered and
 * needs no server; players cannot be, so they arrive here. The palette debounces
 * and only asks from two characters up, and every distinct query is cached in
 * `$lib/server/db`, so the steady-state cost of a visitor typing a name is one
 * narrow read — see `searchPlayers` for what keeps it narrow.
 *
 * Without a database this answers with an empty list rather than an error: the
 * rest of the palette still works, and the local dev rig often has no Mongo.
 */

import { json, error } from '@sveltejs/kit';
import { rateLimiter } from 'sveltekit-commons/rate-limit';
import { dbConfigured, getAvatarsByToon, searchPlayers } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const prerender = false;

/** As many rows as the palette shows; asking for more would only be discarded. */
const LIMIT = 6;
/** Longer than any battletag, and short enough to bound the regex it becomes. */
const MAX_Q = 40;

/**
 * A flood guard, not a quota. Generous enough that a fast typist with the
 * debounce defeated (holding backspace, say) never meets it, tight enough that
 * a script cannot walk the collection a query at a time. In memory, so a
 * restart forgets it — fine for this, see the helper's own note.
 */
const queries = rateLimiter({ limit: 240, windowMs: 60_000 });

export const GET: RequestHandler = async ({ url, getClientAddress }) => {
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, MAX_Q);
	if (q.length < 2) return json({ players: [] });
	if (!queries.hit(getClientAddress())) error(429, 'Too many searches — try again in a minute.');
	if (!dbConfigured()) return json({ players: [] });

	const [rows, avatars] = await Promise.all([searchPlayers(q, LIMIT), getAvatarsByToon()]);
	return json({
		players: rows.map((p) => ({
			toon: p.toon as string,
			name: (p.name as string) ?? '',
			clan: (p.clan as string) ?? '',
			avatarUrl: avatars[p.toon as string] ?? null
		}))
	});
};
