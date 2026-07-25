/**
 * Replay upload endpoint.
 *
 * Accepts an .SC2Replay (multipart form, field "replay"), parses and
 * validates it in-process (UAR map title, player save data present), then:
 * - stores the replay blob in the Tigris bucket (replays/<name>)
 * - inserts a replay doc (with parsed sightings) into MongoDB
 * - rebuilds the players collection from all stored sightings
 *
 * Player pages are server-rendered from Mongo, so accepted uploads are
 * visible immediately — no deploy cycle involved.
 */

import { json, error } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import { parseReplay, peekReplay } from '$lib/server/replay/extract';
import { decideIngest, canonicalName } from '$lib/server/replay/ingest';
import { putObject } from '$lib/server/replay/s3';
import {
	dbConfigured,
	replayExists,
	replayExistsBySha,
	getReplayByLobby,
	insertReplayDoc,
	replaceReplayDoc,
	rebuildPlayers
} from '$lib/server/db';
import rawMos from '$lib/data/mos.json';
import type { RequestHandler } from './$types';

export const prerender = false;

const MAP_TITLE = 'Undead Assault reborn';
const MAX_SIZE = 16 * 1024 * 1024;

const mosIds = new Set((rawMos as { id: string }[]).map((m) => m.id));

// crude per-IP rate limits; single always-on machine, so in-memory is fine.
// Attempts (invalid files, duplicates) get a generous cap; only ACCEPTED
// ingests consume the strict one — a failed try must not lock players out.
const ACCEPT_LIMIT = 5;
const ATTEMPT_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const attemptsByIp = new Map<string, number[]>();
const acceptsByIp = new Map<string, number[]>();

function recent(map: Map<string, number[]>, ip: string): number[] {
	const list = (map.get(ip) ?? []).filter((t) => Date.now() - t < RATE_WINDOW_MS);
	map.set(ip, list);
	return list;
}

function rateLimited(ip: string): boolean {
	const attempts = recent(attemptsByIp, ip);
	if (attempts.length >= ATTEMPT_LIMIT) return true;
	if (recent(acceptsByIp, ip).length >= ACCEPT_LIMIT) return true;
	attempts.push(Date.now());
	return false;
}

function recordAccept(ip: string): void {
	recent(acceptsByIp, ip).push(Date.now());
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
	if (rateLimited(getClientAddress())) error(429, 'Too many uploads — try again later.');

	const contentLength = Number(request.headers.get('content-length') ?? 0);
	if (contentLength > MAX_SIZE + 4096) error(413, 'Replay too large.');

	const form = await request.formData().catch(() => null);
	const file = form?.get('replay');
	if (!(file instanceof File)) error(400, 'Send the replay as form field "replay".');
	if (file.size > MAX_SIZE) error(413, 'Replay too large.');

	const data = new Uint8Array(await file.arrayBuffer());
	const sha256 = createHash('sha256').update(data).digest('hex');
	if (await replayExistsBySha(sha256)) {
		error(409, 'This exact replay file is already ingested.');
	}

	// cheap header/details peek: validate + dedupe before decoding megabytes
	// of game events
	let peeked;
	try {
		peeked = peekReplay(data);
	} catch (e) {
		console.warn('upload peek failed:', e);
		error(400, 'Not a readable StarCraft II replay.');
	}
	if (peeked.title !== MAP_TITLE) {
		error(400, `Not an Undead Assault Reborn replay (map: "${peeked.title}").`);
	}

	// identity = lobby id (see ingest.ts): duplicates 409, longer recordings
	// of a known game replace the stored one, name clashes get a suffix
	const existing = await getReplayByLobby(peeked.lobbyId);
	const decision = decideIngest(
		peeked,
		existing,
		existing ? false : await replayExists(canonicalName(peeked.playedAt))
	);
	if (decision.kind === 'duplicate') {
		error(409, `This game (${peeked.playedAt}) is already ingested.`);
	}
	const name = decision.name;

	let parsed;
	try {
		parsed = parseReplay(name, data, mosIds);
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
		title: parsed.title,
		baseBuild: parsed.baseBuild,
		size: data.length,
		players: parsed.sightings.length,
		sha256,
		lobbyId: parsed.lobbyId,
		durationLoops: parsed.durationLoops,
		sightings: parsed.sightings
	};
	if (decision.kind === 'replace') await replaceReplayDoc(doc);
	else await insertReplayDoc(doc);
	const playerCount = await rebuildPlayers();
	recordAccept(getClientAddress());
	console.log(
		`upload ${existing ? 'replaced' : 'accepted'}: ${name} (${parsed.sightings.length} profiles, ${playerCount} players total)`
	);

	return json({
		ok: true,
		file: name,
		playedAt: parsed.playedAt,
		profiles: parsed.sightings.length,
		protocolExact: parsed.protocolExact,
		replaced: Boolean(existing),
		message: existing
			? 'Longer recording of a known game — replaced the stored replay.'
			: 'Replay accepted — profiles are live now.'
	});
};
