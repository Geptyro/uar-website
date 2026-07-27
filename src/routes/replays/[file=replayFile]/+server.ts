/**
 * Replay downloads, streamed from the Tigris bucket — same /replays/<file>
 * URLs as when the files were static assets. Replays never change once
 * ingested, hence the immutable cache header.
 */

import { error } from '@sveltejs/kit';
import { getObject } from '$lib/server/replay/s3';
import { dbConfigured, getReplay } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const prerender = false;

const NAME = /^\d{8}-\d{4}(-\d+)?\.SC2Replay$/;

export const GET: RequestHandler = async ({ params }) => {
	if (!NAME.test(params.file)) error(404, 'Not found');
	const object = await getObject(`replays/${params.file}`);
	if (!object) {
		// Distinguish "we deliberately dropped the bytes" from "never heard of
		// it": the game's record still exists, so 410 rather than 404.
		if (dbConfigured()) {
			const doc = await getReplay(params.file);
			if (doc?.blobPruned) {
				error(
					410,
					'This replay file is no longer stored — every player in it has a more recent replay. The game is still on record.'
				);
			}
		}
		error(404, 'Not found');
	}
	return new Response(object.body, {
		headers: {
			'Content-Type': 'application/octet-stream',
			'Content-Disposition': `attachment; filename="${params.file}"`,
			'Content-Length': object.headers.get('content-length') ?? '',
			'Cache-Control': 'public, max-age=31536000, immutable'
		}
	});
};
