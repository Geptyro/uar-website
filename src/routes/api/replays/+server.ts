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
import { parseReplay } from '$lib/server/replay/extract';
import { putObject } from '$lib/server/replay/s3';
import { dbConfigured, replayExists, insertReplayDoc, rebuildPlayers } from '$lib/server/db';
import rawMos from '$lib/data/mos.json';
import type { RequestHandler } from './$types';

export const prerender = false;

const MAP_TITLE = 'Undead Assault reborn';
const MAX_SIZE = 16 * 1024 * 1024;

const mosIds = new Set((rawMos as { id: string }[]).map((m) => m.id));

// crude per-IP rate limit; single always-on machine, so in-memory is fine
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const uploadsByIp = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
	const now = Date.now();
	const recent = (uploadsByIp.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
	uploadsByIp.set(ip, recent);
	if (recent.length >= RATE_LIMIT) return true;
	recent.push(now);
	return false;
}

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

	let parsed;
	try {
		parsed = parseReplay(file.name || 'upload.SC2Replay', data, mosIds);
	} catch (e) {
		console.warn('upload parse failed:', e);
		error(400, 'Not a readable StarCraft II replay.');
	}
	if (parsed.title !== MAP_TITLE) {
		error(400, `Not an Undead Assault Reborn replay (map: "${parsed.title}").`);
	}
	if (!parsed.sightings.length) {
		error(400, 'No player save data in this replay (empty or corrupted bank preload).');
	}

	// canonical name = game UTC start time; also our dedupe key
	const stamp = parsed.playedAt.replace(/[-:]/g, '').slice(0, 13).replace('T', '-');
	const name = `${stamp}.SC2Replay`;
	if (await replayExists(name)) {
		error(409, `This game (${parsed.playedAt}) is already ingested.`);
	}

	parsed.file = name;
	for (const s of parsed.sightings) s.file = name;

	// blob first — an orphaned blob is harmless, a doc without its blob is not
	await putObject(`replays/${name}`, data, 'application/octet-stream');
	await insertReplayDoc({
		_id: name,
		playedAt: parsed.playedAt,
		title: parsed.title,
		baseBuild: parsed.baseBuild,
		size: data.length,
		players: parsed.sightings.length,
		sightings: parsed.sightings
	});
	const playerCount = await rebuildPlayers();
	console.log(`upload accepted: ${name} (${parsed.sightings.length} profiles, ${playerCount} players total)`);

	return json({
		ok: true,
		file: name,
		playedAt: parsed.playedAt,
		profiles: parsed.sightings.length,
		protocolExact: parsed.protocolExact,
		message: 'Replay accepted — profiles are live now.'
	});
};
