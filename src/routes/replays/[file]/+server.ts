/**
 * Replay downloads, streamed from the Tigris bucket — same /replays/<file>
 * URLs as when the files were static assets. Replays never change once
 * ingested, hence the immutable cache header.
 */

import { error } from '@sveltejs/kit';
import { getObject } from '$lib/server/replay/s3';
import type { RequestHandler } from './$types';

export const prerender = false;

const NAME = /^\d{8}-\d{4}\.SC2Replay$/;

export const GET: RequestHandler = async ({ params }) => {
	if (!NAME.test(params.file)) error(404, 'Not found');
	const object = await getObject(`replays/${params.file}`);
	if (!object) error(404, 'Not found');
	return new Response(object.body, {
		headers: {
			'Content-Type': 'application/octet-stream',
			'Content-Disposition': `attachment; filename="${params.file}"`,
			'Content-Length': object.headers.get('content-length') ?? '',
			'Cache-Control': 'public, max-age=31536000, immutable'
		}
	});
};
