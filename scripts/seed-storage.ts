/**
 * One-shot migration/seed: push local replays into the production storage —
 * blobs to the Tigris bucket, parsed docs to MongoDB — then rebuild the
 * players collection. Idempotent: already-ingested replays are skipped.
 *
 * Usage (with creds in the environment):
 *   MONGODB_URI=... AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... \
 *   BUCKET_NAME=... node scripts/seed-storage.ts [replay-folder]
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseReplay } from '../src/lib/server/replay/extract.ts';
import { putObject, objectExists, bucketConfigured } from '../src/lib/server/replay/s3.ts';
import { db, dbConfigured, rebuildPlayers, replayExists, insertReplayDoc } from '../src/lib/server/db.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = process.argv[2] ?? join(ROOT, 'static', 'replays');

if (!dbConfigured()) {
	console.error('MONGODB_URI is not set');
	process.exit(1);
}
if (!bucketConfigured()) {
	console.error('bucket env is not set (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / BUCKET_NAME)');
	process.exit(1);
}

const mosIds = new Set<string>(
	(JSON.parse(readFileSync(join(ROOT, 'src', 'lib', 'data', 'mos.json'), 'utf8')) as { id: string }[]).map(
		(m) => m.id
	)
);

const files = readdirSync(DIR)
	.filter((f) => f.endsWith('.SC2Replay'))
	.sort();
console.log(`${files.length} replay(s) in ${DIR}`);

for (const file of files) {
	const path = join(DIR, file);
	const data = readFileSync(path);
	const parsed = parseReplay(file, data, mosIds);
	const stamp = parsed.playedAt.replace(/[-:]/g, '').slice(0, 13).replace('T', '-');
	const name = `${stamp}.SC2Replay`;
	parsed.file = name;
	for (const s of parsed.sightings) s.file = name;

	if (!(await objectExists(`replays/${name}`))) {
		await putObject(`replays/${name}`, data, 'application/octet-stream');
		console.log(`  blob    ${name} uploaded (${statSync(path).size} bytes)`);
	} else {
		console.log(`  blob    ${name} already in bucket`);
	}

	if (!(await replayExists(name))) {
		await insertReplayDoc({
			_id: name,
			playedAt: parsed.playedAt,
			title: parsed.title,
			baseBuild: parsed.baseBuild,
			size: statSync(path).size,
			players: parsed.sightings.length,
			sha256: createHash('sha256').update(data).digest('hex'),
			lobbyId: parsed.lobbyId,
			durationLoops: parsed.durationLoops,
			...(parsed.outcome ? { outcome: parsed.outcome } : {}),
			...(parsed.mode ? { mode: parsed.mode } : {}),
			sightings: parsed.sightings
		});
		console.log(`  doc     ${name} inserted (${parsed.sightings.length} profiles)`);
	} else {
		console.log(`  doc     ${name} already in mongo`);
	}
}

const count = await rebuildPlayers();
console.log(`players collection rebuilt: ${count} players`);
const d = await db();
await d.collection('replays').createIndex({ playedAt: 1 });
process.exit(0);
