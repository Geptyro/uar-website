/**
 * Replay blob retention sweep, on demand.
 *
 * Replay files are a progression backup: a player who loses their UAR bank
 * recovers it from their most recent replay. So a blob is kept while it is
 * some participant's latest game, and released once every player in it has a
 * newer one. Mongo docs are never touched — only bucket bytes.
 *
 * Dry run (default):  node --env-file=.env scripts/prune-blobs.ts
 * Delete for real:    node --env-file=.env scripts/prune-blobs.ts --apply
 * Keep more per head: node --env-file=.env scripts/prune-blobs.ts --keep=2
 *
 * Shares src/lib/replayRetention.ts with the automatic sweep, so the numbers
 * reported here are the ones the server would act on.
 */

import { MongoClient } from 'mongodb';
import { deleteObject, bucketConfigured } from '../src/lib/server/replay/s3.ts';
import { prunableReplays, pinnedReplays } from '../src/lib/replayRetention.ts';

const apply = process.argv.includes('--apply');
const keep = Number(process.argv.find((a) => a.startsWith('--keep='))?.slice(7) ?? 1);

function fmt(bytes: number): string {
	const units = ['B', 'KiB', 'MiB', 'GiB'];
	let i = 0;
	let n = bytes;
	while (n >= 1024 && i < units.length - 1) (n /= 1024), i++;
	return `${n.toFixed(2)} ${units[i]}`;
}

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is not set');
if (apply && !bucketConfigured()) throw new Error('bucket is not configured — cannot --apply');

const mongo = new MongoClient(uri);
await mongo.connect();
const col = mongo.db(process.env.MONGODB_DB || 'uar').collection('replays');

const docs = (await col
	.find(
		{},
		{ projection: { _id: 1, playedAt: 1, size: 1, sha256: 1, blobPrunedAt: 1, 'sightings.toon': 1 } }
	)
	.toArray()) as unknown as {
	_id: string;
	playedAt: string;
	size: number;
	sha256?: string;
	blobPrunedAt?: string;
	sightings: { toon: string }[];
}[];

const replays = docs.map((d) => ({
	file: d._id,
	playedAt: d.playedAt,
	toons: (d.sightings ?? []).map((s) => s.toon).filter(Boolean),
	blobPruned: Boolean(d.blobPrunedAt)
}));

const sizeOf = new Map(docs.map((d) => [d._id, d.size ?? 0]));
const alreadyPruned = replays.filter((r) => r.blobPruned).length;
const files = prunableReplays(replays, keep);
const bytes = files.reduce((a, f) => a + (sizeOf.get(f) ?? 0), 0);
const live = docs.filter((d) => !d.blobPrunedAt);
const liveBytes = live.reduce((a, d) => a + (d.size ?? 0), 0);

console.log(`replays: ${docs.length}   blobs held: ${live.length} (${fmt(liveBytes)})`);
console.log(`already pruned: ${alreadyPruned}`);
console.log(`pinned (keep ${keep} per player): ${pinnedReplays(replays, keep).size}`);
console.log(`\nprunable now: ${files.length}  freeing ${fmt(bytes)}`);

if (!files.length) {
	await mongo.close();
	process.exit(0);
}
if (!apply) {
	for (const f of files.slice(0, 10)) console.log(`  ${f}  ${fmt(sizeOf.get(f) ?? 0)}`);
	if (files.length > 10) console.log(`  … and ${files.length - 10} more`);
	console.log(`\nDry run — pass --apply to delete.`);
	await mongo.close();
	process.exit(0);
}

// This runs out-of-process, so it cannot take the server's ingest lock. The
// sha re-check below is the guard instead: if an upload replaced the game with
// a longer recording since we listed it, the sha differs and we leave it be.
// That narrows the race but does not close it — prefer running this when the
// companions are not mid-backfill.
const shaAtDecision = new Map(docs.map((d) => [d._id, d.sha256]));
let done = 0;
let skipped = 0;
for (const file of files) {
	try {
		const cur = (await col.findOne(
			{ _id: file } as never,
			{ projection: { sha256: 1, blobPrunedAt: 1 } }
		)) as { sha256?: string; blobPrunedAt?: string } | null;
		if (!cur || cur.blobPrunedAt || cur.sha256 !== shaAtDecision.get(file)) {
			skipped++;
			continue;
		}
		await deleteObject(`replays/${file}`);
		// marked only once the bytes are gone, so a failure retries next pass
		await col.updateOne({ _id: file } as never, {
			$set: { blobPrunedAt: new Date().toISOString() }
		});
		done++;
		if (done % 25 === 0) console.log(`  ${done}/${files.length}…`);
	} catch (e) {
		console.error(`  ${file} failed:`, e);
	}
}
if (skipped) console.log(`skipped ${skipped} changed since listing (re-run to pick them up)`);
console.log(`\npruned ${done}/${files.length}, freed ${fmt(bytes)}`);
await mongo.close();
