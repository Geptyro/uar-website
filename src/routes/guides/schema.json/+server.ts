/** The guide document's JSON Schema (see $lib/buildSchema). One for every class. */

import { json } from '@sveltejs/kit';
import { buildSchema } from '$lib/buildSchema';
import type { RequestHandler } from './$types';

export const prerender = true;

export const GET: RequestHandler = () =>
	json(buildSchema(), { headers: { 'cache-control': 'public, max-age=86400' } });
