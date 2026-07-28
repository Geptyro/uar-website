/**
 * Read the game mode and modifiers out of every stored replay that predates
 * them being detected.
 *
 * Uploads have carried a mode since the parser learned to count the map's
 * opening vote, and `refreshDerived` settles won games from the save-file win
 * counters without needing a file at all — but a game that was *lost* before
 * that has no mode and no way to gain one except by re-reading its recording.
 * That is what this does: pull each blob back out of the bucket, re-parse it,
 * and store what the vote said.
 *
 * Dry run (default):  node --env-file=.env scripts/backfill-modes.ts
 * Write for real:     node --env-file=.env scripts/backfill-modes.ts --apply
 * Limit a pass:       node --env-file=.env scripts/backfill-modes.ts --apply --limit 50
 * Check the reader:   node --env-file=.env scripts/backfill-modes.ts --verify
 *
 * `--verify` writes nothing. It re-reads the games the *win counters* can
 * settle on their own — ground truth that needs no map constant — and checks
 * the vote reader against them, one by one. That is the only measurement that
 * says whether MODE_VOTE_BUTTONS is still pointing at the right dialog
 * controls, so it is worth a pass after any map update.
 *
 * Safe to re-run, and safe to stop: it only ever looks at docs with no `mode`,
 * writes them one at a time, and re-parsing a replay cannot change anything
 * else on the doc — nothing here touches sightings, blobs or players.
 *
 * A re-run is not free, though. A recording that stopped inside the vote has
 * no mode to store, so it still has none afterwards and every later pass
 * downloads it again — deliberately, because "no field" means "never looked"
 * and that is worth keeping true across a map update that moves the vote
 * buttons. Use `--limit` to work through a large archive in bites rather than
 * re-reading it whole.
 *
 * Games whose blob the retention sweep already released are skipped and
 * counted: their bytes are gone, so the counters are the only source left, and
 * `backfill-derived.ts` is what runs those.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseReplay } from '../src/lib/server/replay/extract.ts';
import { getObject, bucketConfigured } from '../src/lib/server/replay/s3.ts';
import { db, dbConfigured, closeDb, type ReplayDoc } from '../src/lib/server/db.ts';
import { counterModes } from '../src/lib/mode.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const apply = process.argv.includes('--apply');
const verify = process.argv.includes('--verify');
const limitArg = process.argv.indexOf('--limit');
const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;

if (!dbConfigured()) {
	console.error('MONGODB_URI is not set');
	process.exit(1);
}
if (!bucketConfigured()) {
	console.error('bucket env is not set (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / BUCKET_NAME)');
	process.exit(1);
}

const mosIds = new Set<string>(
	(
		JSON.parse(readFileSync(join(ROOT, 'src', 'lib', 'data', 'mos.json'), 'utf8')) as {
			id: string;
		}[]
	).map((m) => m.id)
);

const d = await db();
const replays = d.collection<ReplayDoc>('replays');

/** Re-read the games the counters already answer, and grade the vote reader. */
async function verifyAgainstCounters(): Promise<void> {
	const docs = (await replays
		.find(
			{},
			{
				projection: {
					playedAt: 1,
					'sightings.toon': 1,
					'sightings.winsByMode': 1,
					'sightings.gamesPlayed': 1
				}
			}
		)
		.toArray()) as Pick<ReplayDoc, '_id' | 'playedAt' | 'sightings'>[];
	// no `mode` passed in, so the vote cannot vouch for itself: every verdict
	// here comes from the save-file win counters alone
	const readings = counterModes(
		docs.map((r) => ({ file: r._id, playedAt: r.playedAt, sightings: r.sightings ?? [] }))
	);
	// Only corroborated readings are ground truth. A lone one is as likely to
	// be a leaver's delta pointing at some other game as it is to be this
	// one's mode — grading against those measures the noise, not the reader.
	const truth: Record<string, number> = {};
	let lone = 0;
	for (const [file, r] of Object.entries(readings)) {
		if (r.support >= 2) truth[file] = r.mode;
		else lone += 1;
	}
	const gradable = docs.filter((r) => truth[r._id]).slice(0, limit);
	console.log(
		`${docs.length} games stored, ${Object.keys(truth).length} with a counter reading backed ` +
			`by two or more players (${lone} more backed by only one, not graded), ` +
			`grading ${gradable.length}`
	);

	let agreed = 0;
	const disagreed: string[] = [];
	const silent: string[] = [];
	for (const r of gradable) {
		const res = await getObject(`replays/${r._id}`);
		if (!res || !res.ok) continue; // blob released by retention — nothing to re-read
		let mode: number | null = null;
		try {
			mode = parseReplay(r._id, new Uint8Array(await res.arrayBuffer()), mosIds).mode;
		} catch (err) {
			console.log(`  ${r._id}: parse failed — ${(err as Error).message}`);
			continue;
		}
		if (mode === null) silent.push(r._id);
		else if (mode === truth[r._id]) agreed += 1;
		else disagreed.push(`  ${r._id}: vote says ${mode}, counters say ${truth[r._id]}`);
	}

	const graded = agreed + disagreed.length;
	console.log(
		`\nvote reader agreed with the counters on ${agreed}/${graded}` +
			`${graded ? ` (${((agreed / graded) * 100).toFixed(1)}%)` : ''}, ` +
			`${silent.length} recording(s) stopped inside the vote`
	);
	for (const line of disagreed.slice(0, 20)) console.log(line);
	if (disagreed.length) {
		console.log(
			`\n${disagreed.length} disagreement(s). A handful is odd; a majority means the map moved ` +
				'its dialog controls and MODE_VOTE_BUTTONS in server/replay/extract.ts needs re-deriving.'
		);
	}
}

if (verify) {
	await verifyAgainstCounters();
	await closeDb();
	process.exit(0);
}

// _id and blobPrunedAt only: the whole point is that the mode is not in the
// document, and pulling sightings here would read the archive twice over
const todo = (await replays
	.find(
		{ $or: [{ mode: { $exists: false } }, { modifiers: { $exists: false } }] },
		{ projection: { blobPrunedAt: 1, settledMode: 1 } }
	)
	.sort({ playedAt: -1 })
	.toArray()) as Pick<ReplayDoc, '_id' | 'blobPrunedAt' | 'settledMode'>[];

const pruned = todo.filter((r) => r.blobPrunedAt);
const readable = todo.filter((r) => !r.blobPrunedAt).slice(0, limit);
console.log(
	`${todo.length} games are missing a mode or modifiers: ${readable.length} to re-read` +
		`${limit === Infinity ? '' : ` (of ${todo.length - pruned.length} readable)`}, ` +
		`${pruned.length} whose file was released`
);
const prunedSettled = pruned.filter((r) => r.settledMode).length;
if (pruned.length) {
	console.log(
		`  of the released ones, ${prunedSettled} already carry a mode settled from the win counters`
	);
}

let read = 0;
let found = 0;
let missing = 0;
let failed = 0;

for (const r of readable) {
	const res = await getObject(`replays/${r._id}`);
	if (!res || !res.ok) {
		missing += 1;
		console.log(`  ${r._id}: blob not in bucket`);
		continue;
	}
	let parsed: ReturnType<typeof parseReplay>;
	try {
		parsed = parseReplay(r._id, new Uint8Array(await res.arrayBuffer()), mosIds);
	} catch (err) {
		failed += 1;
		console.log(`  ${r._id}: parse failed — ${(err as Error).message}`);
		continue;
	}
	read += 1;
	// an empty modifier list is an answer, so it is stored; a vote the
	// recording never reached is not, and leaves the field absent
	const set: { mode?: number; modifiers?: number[] } = {};
	if (parsed.mode !== null) set.mode = parsed.mode;
	if (parsed.modifiersRead) set.modifiers = parsed.modifiers;
	if (!Object.keys(set).length) continue; // recording stopped inside the votes
	found += 1;
	if (apply) await replays.updateOne({ _id: r._id }, { $set: set });
	if (found <= 10 || found % 50 === 0) {
		const what = [
			set.mode !== undefined ? `mode ${set.mode}` : null,
			set.modifiers ? `mods [${set.modifiers.join(',')}]` : null
		]
			.filter(Boolean)
			.join(' · ');
		console.log(`  ${r._id}: ${what}${apply ? '' : ' (dry run)'}`);
	}
}

console.log(
	`\nre-read ${read} replays: ${found} gained something, ${read - found} stopped inside the votes` +
		`${missing ? `, ${missing} blob(s) missing` : ''}${failed ? `, ${failed} failed to parse` : ''}`
);
if (!apply) {
	console.log('dry run — re-run with --apply to write');
} else {
	// settledMode is derived from the counters and is unaffected by anything
	// written here, so there is nothing to refresh — but the server caches its
	// read paths in memory, so a running instance keeps serving the old rows
	// until its cache turns over.
	console.log('written. A running server keeps its cached pages until they expire.');
}

await closeDb();
