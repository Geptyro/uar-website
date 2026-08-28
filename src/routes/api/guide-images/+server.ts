/**
 * Picture upload for community guides.
 *
 * POST multipart, field "image". The bytes are re-encoded (see
 * server/images.ts), put in the bucket under builds/<id>.webp, and recorded
 * against the account, which is what later lets a guide show the picture
 * and lets the sweep drop it when no build does. Answers with the id and the
 * markdown the editor pastes in.
 *
 * Signed in only, and only from the editor: the custom header is what a
 * cross-site form cannot send, so a page elsewhere cannot upload on a
 * visitor's behalf. The daily count lives in the store rather than in memory,
 * because a limit on stored bytes has to survive a restart.
 */

import { error, json } from '@sveltejs/kit';
import { randomBytes } from 'node:crypto';
import { rateLimiter } from 'sveltekit-commons/rate-limit';
import { dbConfigured } from '$lib/server/db';
import { bucketConfigured, putObject } from '$lib/server/replay/s3';
import { countImagesSince, imageKey, recordImage } from '$lib/server/builds';
import { NotAnImage, reencodeImage } from '$lib/server/images';
import { BUILD_LIMITS, imageRef, imageUrl } from '$lib/builds';
import type { RequestHandler } from './$types';

export const prerender = false;

/** The header the editor sends; see above. */
const UPLOAD_HEADER = 'x-uar-upload';

/** Pictures one account may send in a day: a guide holds twelve, this is a few guides' worth. */
const PER_DAY = 60;

// per address, in memory: what stops a loop, not what enforces the quota
const bursts = rateLimiter({ limit: 30, windowMs: 10 * 60 * 1000 });

export const POST: RequestHandler = async ({ request, locals, getClientAddress }) => {
	const session = locals.session;
	if (!session) error(401, 'Sign in with Battle.net to upload a picture.');
	if (request.headers.get(UPLOAD_HEADER) !== '1') error(403, 'Uploads come from the editor.');
	if (!dbConfigured() || !bucketConfigured()) error(503, 'Uploads are not configured here.');
	if (!bursts.hit(getClientAddress())) error(429, 'Too many uploads at once. Give it a few minutes.');

	const contentLength = Number(request.headers.get('content-length') ?? 0);
	if (contentLength > BUILD_LIMITS.imageBytes + 4096) error(413, 'That picture is too large.');

	const form = await request.formData().catch(() => null);
	const file = form?.get('image');
	if (!(file instanceof File)) error(400, 'Send the picture as form field "image".');
	if (file.size > BUILD_LIMITS.imageBytes) error(413, 'That picture is too large.');

	const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
	if ((await countImagesSince(session.sub, since)) >= PER_DAY) {
		error(429, 'That is a lot of pictures for one day. Try again tomorrow.');
	}

	let encoded;
	try {
		encoded = await reencodeImage(new Uint8Array(await file.arrayBuffer()));
	} catch (e) {
		if (e instanceof NotAnImage) error(400, 'That file is not a picture the site can read.');
		throw e;
	}

	const id = randomBytes(8).toString('hex');
	await putObject(imageKey(id), encoded.data, 'image/webp');
	await recordImage({
		_id: id,
		sub: session.sub,
		bytes: encoded.data.length,
		width: encoded.width,
		height: encoded.height,
		createdAt: new Date().toISOString()
	});
	return json(
		{
			id,
			url: imageUrl(id),
			width: encoded.width,
			height: encoded.height,
			markdown: `![](${imageRef(id)})`
		},
		{ status: 201 }
	);
};
