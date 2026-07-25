/**
 * Replay upload endpoint.
 *
 * Accepts an .SC2Replay (multipart form, field "replay"), parses and
 * validates it in-process (UAR map title, player save data present), then
 * regenerates players.json from all known replays + the new one and commits
 * both files to GitHub in a single commit — the deploy workflow picks that
 * up, so the upload goes live with the next automatic deploy. The Fly
 * machine's own filesystem is ephemeral; git is the storage.
 *
 * Without GITHUB_TOKEN the endpoint writes locally instead when UPLOAD_LOCAL
 * is set (dev/tests) and otherwise reports uploads as unconfigured.
 */

import { json, error } from '@sveltejs/kit';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { parseReplay, buildPlayersData } from '$lib/server/replay/extract';
import { commitFiles } from '$lib/server/replay/github';
import rawMos from '$lib/data/mos.json';
import type { RequestHandler } from './$types';

export const prerender = false;

const MAP_TITLE = 'Undead Assault reborn';
const MAX_SIZE = 16 * 1024 * 1024;
const PLAYERS_JSON_REPO_PATH = 'src/lib/data/players.json';

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

function replaysDir(): string {
	const candidates = [env.REPLAYS_DIR, 'static/replays', 'build/client/replays'];
	for (const c of candidates) {
		if (c && existsSync(c)) return c;
	}
	throw new Error('replays directory not found');
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (rateLimited(getClientAddress())) {
		error(429, 'Too many uploads — try again later.');
	}

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
	const dir = replaysDir();
	const existing = readdirSync(dir)
		.filter((f) => f.endsWith('.SC2Replay'))
		.sort();
	if (existing.includes(name)) {
		error(409, `This game (${parsed.playedAt}) is already ingested.`);
	}

	// rebuild players.json from every known replay + the new one
	parsed.file = name;
	for (const s of parsed.sightings) s.file = name;
	const all = existing.map((f) => {
		const path = join(dir, f);
		return { replay: parseReplay(f, readFileSync(path), mosIds), size: statSync(path).size };
	});
	all.push({ replay: parsed, size: data.length });
	const playersJson = JSON.stringify(buildPlayersData(all), null, '\t') + '\n';

	if (env.GITHUB_TOKEN) {
		const repo = env.GITHUB_REPO || 'Geptyro/uar-website';
		const sha = await commitFiles(
			env.GITHUB_TOKEN,
			repo,
			env.GITHUB_BRANCH || 'main',
			[
				{ path: `static/replays/${name}`, content: data },
				{ path: PLAYERS_JSON_REPO_PATH, content: playersJson }
			],
			`Ingest replay ${name} (web upload, ${parsed.sightings.length} profiles)`
		);
		console.log(`upload accepted: ${name} -> ${repo}@${sha.slice(0, 7)}`);
	} else if (env.UPLOAD_LOCAL || dev) {
		writeFileSync(join(dir, name), data);
		writeFileSync(env.PLAYERS_JSON || PLAYERS_JSON_REPO_PATH, playersJson);
		console.log(`upload accepted (local mode): ${name}`);
	} else {
		error(503, 'Uploads are not configured on this deployment.');
	}

	return json({
		ok: true,
		file: name,
		playedAt: parsed.playedAt,
		profiles: parsed.sightings.length,
		protocolExact: parsed.protocolExact,
		message: 'Replay accepted — it will appear on the site after the next deploy (a few minutes).'
	});
};
