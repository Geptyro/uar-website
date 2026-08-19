/**
 * Replay upload endpoint.
 *
 * Accepts an .SC2Replay (multipart form, field "replay"), parses and
 * validates it in a worker thread (UAR map title, player save data
 * present) so uploads never block page requests, then:
 * - stores the replay blob in the Tigris bucket (replays/<name>), unless the
 *   retention rule says nobody needs it as a bank backup any more
 * - inserts a replay doc (with parsed sightings) into MongoDB
 * - rebuilds the players collection from all stored sightings
 *
 * Player pages are server-rendered from Mongo, so accepted uploads are
 * visible immediately — no deploy cycle involved.
 */

import { json, error } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import { rateLimiter } from 'sveltekit-commons/rate-limit';
import {
	parseReplayOffThread,
	peekReplayOffThread,
	ReplayWorkerError
} from '$lib/server/replay/offthread';
import { decideIngest, canonicalName } from '$lib/server/replay/ingest';
import { PARSER_GENERATION } from '$lib/server/replay/extract';
import { startedAtOf } from '$lib/gameEnd';
import { deleteObject, putObject } from '$lib/server/replay/s3';
import {
	dbConfigured,
	pruneEnabled,
	replayExists,
	replayExistsBySha,
	replayPinnedOnArrival,
	findReplayBySha,
	getReplayByLobby,
	insertReplayDoc,
	replaceReplayDoc,
	rebuildPlayersSoon
} from '$lib/server/db';
import { withLock } from '$lib/mutex';
import rawMos from '$lib/data/mos.json';
// Shared with every client that decides what to send, rather than spelled out
// again here: the companion filters on MAP_TITLE before a replay leaves a
// player's machine, and so does the browser sync. A copy that drifts either
// uploads replays the client promised not to, or silently stops uploading.
import { MAP_TITLE, MAX_UPLOAD_SIZE as MAX_SIZE } from 'uar-shared/replay';
import type { RequestHandler } from './$types';

export const prerender = false;

const mosIds = new Set((rawMos as { id: string }[]).map((m) => m.id));

// Crude per-IP flood guard; single always-on machine, so in-memory is fine.
// Deliberately loose: a fresh companion install backfills hundreds of past
// games one after another, and that is exactly what we want it to do. This
// only stops something pathological — ingest is serialised and the player
// rebuild is coalesced, so a legitimate backfill costs little.
//
// The ceiling has to be read against how fast a backfill can actually go, and
// that changed underneath it. At 1000/hour it was unreachable while a starved
// machine managed about one upload a minute; on two cores the same backfill
// runs at roughly seventeen, which is the limit almost exactly — so the guard
// had quietly become a thing real backfills hit rather than a guard against
// abuse. A companion that hits it is not refused for good (429 keeps the file
// queued and retries in fifteen minutes) but it does stall for a quarter of an
// hour at a time, and the Companion release that re-offers the games a busy
// server wrongly rejected queues them all at once — precisely the burst most
// likely to run into it.
//
// `hit` — every ATTEMPT is charged, unlike the feedback form, which charges
// only accepted submissions. Here the attempt is the cost: a rejected upload
// has already been read off the wire and peeked at in a worker.
const uploads = rateLimiter({ limit: 5000, windowMs: 60 * 60 * 1000 });

/**
 * Re-raise a parse failure that was ours, not the file's, as a 503.
 *
 * The status is the whole point. A client cannot see why a parse failed, so it
 * goes by the code, and the two answers are not degrees of the same thing: the
 * Companion retries a 5xx a couple of minutes later, and takes 4xx as a verdict
 * on the file — it records the path as skipped and never offers that game
 * again. So while the worker was answering "not a readable replay" whenever it
 * ran out of time under load, a busy minute permanently cost good replays.
 *
 * Only worker failures come through here; a replay the parser genuinely could
 * not read still falls past this to the 400 it deserves.
 */
function rethrowIfWorkerFailed(e: unknown): void {
	if (!(e instanceof ReplayWorkerError)) return;
	console.error('upload deferred — replay worker unavailable:', e);
	error(503, 'Too busy to process replays right now — this one will be retried automatically.');
}

/** Pre-upload dedupe check: GET /api/replays?sha256=<hex> -> { exists }. */
export const GET: RequestHandler = async ({ url }) => {
	if (!dbConfigured()) return json({ exists: false });
	const sha256 = url.searchParams.get('sha256') ?? '';
	if (!/^[0-9a-f]{64}$/.test(sha256)) error(400, 'Pass sha256=<hex digest>.');
	return json({ exists: await replayExistsBySha(sha256) });
};

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (!dbConfigured()) error(503, 'Uploads are not configured on this deployment.');
	if (!uploads.hit(getClientAddress())) error(429, 'Too many uploads — try again later.');

	const contentLength = Number(request.headers.get('content-length') ?? 0);
	if (contentLength > MAX_SIZE + 4096) error(413, 'Replay too large.');

	const form = await request.formData().catch(() => null);
	const file = form?.get('replay');
	if (!(file instanceof File)) error(400, 'Send the replay as form field "replay".');
	if (file.size > MAX_SIZE) error(413, 'Replay too large.');

	const data = new Uint8Array(await file.arrayBuffer());
	const sha256 = createHash('sha256').update(data).digest('hex');
	// Known files stay known after their blob is pruned — the sha is on the
	// doc, not the bucket. Say "processed" rather than "stored" so a player
	// whose file we no longer keep is not told it never arrived.
	const known = await findReplayBySha(sha256);
	if (known) {
		error(
			409,
			known.blobPruned
				? `This replay was already processed (${known.startedAt}). The file itself is no longer stored — every player in that game has a more recent replay — but the game is on record.`
				: 'This exact replay file is already ingested.'
		);
	}

	// cheap header/details peek: validate + dedupe before decoding megabytes
	// of game events
	let peeked;
	try {
		peeked = await peekReplayOffThread(data);
	} catch (e) {
		rethrowIfWorkerFailed(e);
		console.warn('upload peek failed:', e);
		error(400, 'Not a readable StarCraft II replay.');
	}
	if (peeked.title !== MAP_TITLE) {
		error(400, `Not an Undead Assault Reborn replay (map: "${peeked.title}").`);
	}

	// Everyone in a lobby records their own copy of the same game, so two
	// players uploading at once arrive with different files but the same
	// lobby id. Decide and write under a lock, or both would look new and
	// collide on the document id; the second now sees the first's result
	// and answers duplicate/replace like any later upload.
	const { name, parsed, stored, existed, playerCount } = await withLock('replay-ingest', async () => {
		const existing = await getReplayByLobby(peeked.lobbyId);
		const decision = decideIngest(
			peeked,
			existing,
			existing ? false : await replayExists(canonicalName(peeked.playedAt))
		);
		if (decision.kind === 'duplicate') {
			error(
				409,
				existing?.blobPruned
					? `This game (${startedAtOf(peeked.playedAt, peeked.durationLoops)}) was already processed. The replay file is no longer stored — every player in it has a more recent replay — but the game is on record.`
					: `This game (${startedAtOf(peeked.playedAt, peeked.durationLoops)}) is already ingested.`
			);
		}
		const name = decision.name;

		let parsed;
		try {
			parsed = await parseReplayOffThread(name, data, mosIds);
		} catch (e) {
			rethrowIfWorkerFailed(e);
			console.warn('upload parse failed:', e);
			error(400, 'Not a readable StarCraft II replay.');
		}
		if (!parsed.sightings.length) {
			error(400, 'No player save data in this replay (empty or corrupted bank preload).');
		}

		// Would the sweep drop this file the moment it landed? A backfilled game
		// whose players have all moved on would be stored and deleted again for
		// nothing, and a companion's first run is hundreds of those. Asked with
		// the same rule the sweep uses, so the two can never disagree about a
		// file — and only while pruning is on, or this would prune by omission
		// while REPLAY_PRUNE says not to.
		const keepBlob =
			!pruneEnabled() ||
			(await replayPinnedOnArrival(
				parsed.sightings.map((s) => s.toon),
				parsed.playedAt
			));

		if (keepBlob) {
			// blob first — an orphaned blob is harmless, a doc without its blob is not
			await putObject(`replays/${name}`, data, 'application/octet-stream');
		} else if (decision.kind === 'replace') {
			// The doc below describes *this* file (sha256, size), so the shorter
			// recording still sitting under that key would be bytes that no longer
			// match their own record. Drop it rather than serve the mismatch.
			await deleteObject(`replays/${name}`);
		}
		const doc = {
			_id: name,
			playedAt: parsed.playedAt,
			// playedAt is when the recording stopped, so the start is derived
			// rather than read — see lib/gameEnd.ts
			startedAt: startedAtOf(parsed.playedAt, parsed.durationLoops),
			title: parsed.title,
			baseBuild: parsed.baseBuild,
			size: data.length,
			players: parsed.sightings.length,
			sha256,
			lobbyId: parsed.lobbyId,
			durationLoops: parsed.durationLoops,
			// equal to durationLoops unless this client idled in the finished map
			gameLoops: parsed.gameLoops,
			// only when the recording saw the game end; games it cannot answer
			// are settled later from the players' save-file win counters
			...(parsed.outcome ? { outcome: parsed.outcome } : {}),
			// likewise the mode: only when the recording lasted past the vote
			...(parsed.mode ? { mode: parsed.mode } : {}),
			...(parsed.modifiersRead ? { modifiers: parsed.modifiers } : {}),
			// the sweep would take it on its next pass anyway; recording it now
			// keeps the page, the download and the dedupe message honest from the
			// first moment instead of for the next hour
			...(keepBlob ? {} : { blobPrunedAt: new Date().toISOString() }),
			// so a later backfill knows which readable docs a newer parser has
			// not seen (see PARSER_GENERATION)
			parser: PARSER_GENERATION,
			sightings: parsed.sightings
		};
		// replaceReplayDoc writes the doc whole, so blobPrunedAt is whatever was
		// decided just above: cleared when a longer recording restored the bytes
		// of a pruned game, set again when this recording was not worth keeping.
		if (decision.kind === 'replace') await replaceReplayDoc(doc);
		else await insertReplayDoc(doc);
		return {
			name,
			parsed,
			stored: keepBlob,
			existed: Boolean(existing),
			// only the players in this game can have changed, so the rebuild is
			// told who rather than re-deriving the whole collection
			playerCount: await rebuildPlayersSoon(parsed.sightings.map((s) => s.toon))
		};
	});
	const existing = existed;
	console.log(
		`upload ${existing ? 'replaced' : 'accepted'}: ${name} (${parsed.sightings.length} profiles, ${stored ? 'blob kept' : 'blob not kept'}, ${playerCount === null ? 'rebuild queued' : playerCount + ' profiles rebuilt'})`
	);

	return json({
		ok: true,
		file: name,
		// the game's start, which is what the uploader recognises as "the game
		// I just played" — parsed.playedAt is when their recording stopped
		startedAt: startedAtOf(parsed.playedAt, parsed.durationLoops),
		playedAt: parsed.playedAt,
		profiles: parsed.sightings.length,
		protocolExact: parsed.protocolExact,
		replaced: Boolean(existing),
		/** Whether the file itself was kept, as opposed to only the game's record. */
		stored,
		message: !stored
			? 'Game recorded — every player in it already has a more recent replay, so the file itself was not kept.'
			: existing
				? 'Longer recording of a known game — replaced the stored replay.'
				: 'Replay accepted — profiles are live now.'
	});
};
