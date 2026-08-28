/**
 * A guide's picture, streamed from the bucket. The id is minted at upload and
 * the bytes never change afterwards (a re-upload is a new id), hence the
 * immutable cache header: a reader coming back to a guide fetches nothing.
 */

import { error } from '@sveltejs/kit';
import { getObject } from '$lib/server/replay/s3';
import { imageKey } from '$lib/server/builds';
import type { RequestHandler } from './$types';

export const prerender = false;

const NAME = /^([0-9a-f]{16})\.webp$/;

export const GET: RequestHandler = async ({ params }) => {
	const m = NAME.exec(params.file);
	if (!m) error(404, 'Not found');
	const object = await getObject(imageKey(m[1]));
	if (!object) error(404, 'Not found');
	return new Response(object.body, {
		headers: {
			'Content-Type': 'image/webp',
			'Content-Length': object.headers.get('content-length') ?? '',
			'Cache-Control': 'public, max-age=31536000, immutable'
		}
	});
};
