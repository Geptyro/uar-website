/**
 * The guide format for one class, as JSON: what `/mos/<id>/builds/<slug>.json`
 * points at, so that a document and the rules it was written under travel
 * together (see $lib/buildFormat). Static data; served with a day's cache.
 */

import { error, json } from '@sveltejs/kit';
import { mosById } from '$lib/mos';
import { buildFormat } from '$lib/buildFormat';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = ({ url }) => {
	const id = url.searchParams.get('mos') ?? '';
	const mos = mosById.get(id);
	if (!mos || mos.pilotedBy) error(404, `No MOS class with id "${id}". Pass ?mos=<id>.`);
	return json(buildFormat(mos), {
		headers: { 'cache-control': 'public, max-age=3600' }
	});
};
