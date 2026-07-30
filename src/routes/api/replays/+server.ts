/**
 * Replay upload endpoint.
 *
 * Accepts an .SC2Replay (multipart form, field "replay"), parses and
 * validates it in a worker thread (UAR map title, player save data
 * present) so uploads never block page requests, then:
 * - stores the replay blob in the Tigris bucket (replays/<name>)
 * - inserts a replay doc (with parsed sightings) into MongoDB
 * - rebuilds the players collection from all stored sightings
 *
 * Player pages are server-rendered from Mongo, so accepted uploads are
 * visible immediately — no deploy cycle involved.
 */

import { json, error } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import { rateLimiter } from 'sveltekit-commons/rate-limit';
import { parseReplayOffThread, peekReplayOffThread } from '$lib/server/replay/offthread';
import { decideIngest, canonicalName } from '$lib/server/replay/ingest';
import { startedAtOf } from '$lib/gameEnd';
import { putObject } from '$lib/server/replay/s3';
import {
	dbConfigured,
	replayExists,
	replayExistsBySha,
	findReplayBySha,
	getReplayByLobby,
	insertReplayDoc,
	replaceReplayDoc,
	rebuildPlayersSoon
} from '$lib/server/db';
import { withLock } from '$lib/mutex';
import rawMos from '$lib/data/mos.json';
import type { RequestHandler } from './$types';

export const prerender = false;

const MAP_TITLE = 'Undead Assault reborn';
const MAX_SIZE = 16 * 1024 * 1024;

const mosIds = new Set((rawMos as { id: string }[]).map((m) => m.id));

// Crude per-IP flood guard; single always-on machine, so in-memory is fine.
// Deliberately loose: a fresh companion install backfills hundreds of past
// games one after another, and that is exactly what we want it to do. This
// only stops something pathological — ingest is serialised and the player
// rebuild is coalesced, so a legitimate backfill costs little.
//
// `hit` — every ATTEMPT is charged, unlike the feedback form, which charges
// only accepted submissions. Here the attempt is the cost: a rejected upload
// has already been read off the wire and peeked at in a worker.
const uploads = rateLimiter({ limit: 1000, windowMs: 60 * 60 * 1000 });

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
	const { name, parsed, existed, playerCount } = await withLock('replay-ingest', async () => {
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
			console.warn('upload parse failed:', e);
			error(400, 'Not a readable StarCraft II replay.');
		}
		if (!parsed.sightings.length) {
			error(400, 'No player save data in this replay (empty or corrupted bank preload).');
		}

		// blob first — an orphaned blob is harmless, a doc without its blob is not
		await putObject(`replays/${name}`, data, 'application/octet-stream');
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
			sightings: parsed.sightings
		};
		// replaceReplayDoc writes the doc whole, so a longer recording of a
		// game whose blob was pruned drops blobPrunedAt along with it — the
		// putObject above has already restored the bytes it refers to.
		if (decision.kind === 'replace') await replaceReplayDoc(doc);
		else await insertReplayDoc(doc);
		return {
			name,
			parsed,
			existed: Boolean(existing),
			// only the players in this game can have changed, so the rebuild is
			// told who rather than re-deriving the whole collection
			playerCount: await rebuildPlayersSoon(parsed.sightings.map((s) => s.toon))
		};
	});
	const existing = existed;
	console.log(
		`upload ${existing ? 'replaced' : 'accepted'}: ${name} (${parsed.sightings.length} profiles, ${playerCount === null ? 'rebuild queued' : playerCount + ' profiles rebuilt'})`
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
		message: existing
			? 'Longer recording of a known game — replaced the stored replay.'
			: 'Replay accepted — profiles are live now.'
	});
};
