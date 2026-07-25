/**
 * Per-class leaderboard: GET /api/mos-players/<mosId> -> { players: MosTopPlayer[] },
 * top players by recorded time on that class. MOS pages are prerendered, so
 * they fetch this client-side; without a DB the list is just empty.
 */

import { json, error } from '@sveltejs/kit';
import { mosById } from '$lib/mos';
import { dbConfigured, getMosTopPlayers } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	if (!mosById.has(params.id)) error(404, `No MOS class with id "${params.id}"`);
	if (!dbConfigured()) return json({ players: [] });
	return json({ players: await getMosTopPlayers(params.id) });
};
