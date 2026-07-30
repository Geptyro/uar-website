/**
 * Fill in the two fields that separate a game from its recording:
 * `startedAt` (when the game began) and `gameLoops` (how long it lasted).
 *
 * Both were added after the archive was built. `startedAt` needs no file — it
 * is `playedAt` less the recording's length, since `playedAt` is the moment
 * SC2 wrote the replay, not the moment the game began — so every doc gains it
 * in one pass. `gameLoops` needs the recording: only the event streams say
 * where the game ended and the idling began (see lib/gameEnd.ts), so those
 * docs are pulled back out of the bucket and re-parsed.
 *
 * Dry run (default):  node --env-file=.env scripts/backfill-gameend.ts
 * Write for real:     node --env-file=.env scripts/backfill-gameend.ts --apply
 * Limit a pass:       node --env-file=.env scripts/backfill-gameend.ts --apply --limit 50
 *
 * The dry run is also the coverage report, and worth reading before applying:
 * it breaks the re-read down by mode, because the end markers are the map's
 * and not every mode raises the same one. A mode with games re-read and no
 * detections is not proof of a bug — most recordings simply have no idle tail
 * to find — but a mode that shows long untrimmed recordings under
 * "no end evidence" is where to look next.
 *
 * Safe to re-run and safe to stop: it writes one doc at a time, only touches
 * these two fields, and reads nothing that a re-parse could change. Docs whose
 * blob the retention sweep released keep their recording length as their game
 * length (`gameLoopsOf` falls back to it) — the bytes that would say otherwise
 * are gone.
 *
 * Applying changes what the playtime boards credit, so follow it with
 * `scripts/backfill-derived.ts --apply` to recompute them.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseReplay } from '../src/lib/server/replay/extract.ts';
import { getObject, bucketConfigured } from '../src/lib/server/replay/s3.ts';
import { db, dbConfigured, closeDb, type ReplayDoc } from '../src/lib/server/db.ts';
import { startedAtOf, LOOPS_PER_SECOND } from '../src/lib/gameEnd.ts';
// straight from the data file rather than via lib/players.ts, which imports it
// without an attribute and so only loads under Vite
import progression from '../src/lib/data/progression.json' with { type: 'json' };

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const apply = process.argv.includes('--apply');
const limitArg = process.argv.indexOf('--limit');
const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;
/** A recording this long that nothing dated is worth a human look. */
const SUSPICIOUS_LOOPS = LOOPS_PER_SECOND * 3600 * 3;

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

/** Mode number (1-based) as its name — the same mapping lib/players.ts uses. */
const modeName = (mode: number | null | undefined): string =>
	mode ? ((progression as { modes: string[] }).modes[mode - 1] ?? `Mode ${mode}`) : '';

const fmt = (loops: number) => {
	const s = Math.round(loops / LOOPS_PER_SECOND);
	return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

const d = await db();
const replays = d.collection<ReplayDoc>('replays');

// ---- startedAt: derivable from what the docs already carry ----------------

const needStart = (await replays
	.find(
		{ startedAt: { $exists: false } },
		{ projection: { playedAt: 1, durationLoops: 1 } }
	)
	.toArray()) as Pick<ReplayDoc, '_id' | 'playedAt' | 'durationLoops'>[];

console.log(`${needStart.length} doc(s) without startedAt`);
let started = 0;
for (const r of needStart) {
	const startedAt = startedAtOf(r.playedAt, r.durationLoops);
	if (startedAt === r.playedAt) continue; // no length stored to walk back
	started += 1;
	if (apply) await replays.updateOne({ _id: r._id }, { $set: { startedAt } });
	if (started <= 5) console.log(`  ${r._id}: starts ${startedAt}${apply ? '' : ' (dry run)'}`);
}
console.log(
	`  ${started} derivable${needStart.length - started ? `, ${needStart.length - started} with no recording length to derive from` : ''}`
);

// ---- gameLoops: needs the recording --------------------------------------

const todo = (await replays
	.find(
		{ gameLoops: { $exists: false } },
		{ projection: { blobPrunedAt: 1, durationLoops: 1, mode: 1, settledMode: 1 } }
	)
	.sort({ playedAt: -1 })
	.toArray()) as Pick<
	ReplayDoc,
	'_id' | 'blobPrunedAt' | 'durationLoops' | 'mode' | 'settledMode'
>[];

const pruned = todo.filter((r) => r.blobPrunedAt);
const readable = todo.filter((r) => !r.blobPrunedAt).slice(0, limit);
console.log(
	`\n${todo.length} doc(s) without gameLoops: ${readable.length} to re-read` +
		`${limit === Infinity ? '' : ` (of ${todo.length - pruned.length} readable)`}, ` +
		`${pruned.length} whose file was released — those keep the recording's length`
);

interface ModeTally {
	read: number;
	trimmed: number;
	idleLoops: number;
	unresolved: string[];
}
const byMode = new Map<string, ModeTally>();
const tally = (mode: string): ModeTally => {
	let t = byMode.get(mode);
	if (!t) byMode.set(mode, (t = { read: 0, trimmed: 0, idleLoops: 0, unresolved: [] }));
	return t;
};

let read = 0;
let trimmed = 0;
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
	const mode = modeName(r.settledMode ?? r.mode ?? parsed.mode) || 'unknown';
	const t = tally(mode);
	t.read += 1;
	const idle = parsed.durationLoops - parsed.gameLoops;
	if (idle > 0) {
		t.trimmed += 1;
		t.idleLoops += idle;
		trimmed += 1;
		console.log(
			`  ${r._id}: ${fmt(parsed.durationLoops)} recorded, game ${fmt(parsed.gameLoops)} ` +
				`(−${fmt(idle)} idle, ${mode})${apply ? '' : ' (dry run)'}`
		);
	} else if (parsed.outcome === null && parsed.durationLoops >= SUSPICIOUS_LOOPS) {
		// long, no marker, no exit burst: either a genuinely long game nobody
		// finished, or an ending this reader cannot see yet
		t.unresolved.push(`${r._id} (${fmt(parsed.durationLoops)})`);
	}
	if (apply) {
		await replays.updateOne(
			{ _id: r._id },
			{
				$set: {
					gameLoops: parsed.gameLoops,
					startedAt: startedAtOf(parsed.playedAt, parsed.durationLoops)
				}
			}
		);
	}
}

console.log(`\nre-read ${read} replay(s): ${trimmed} had an idle tail trimmed off`);
if (byMode.size) {
	console.log('\nby mode:');
	for (const [mode, t] of [...byMode].sort((a, b) => b[1].read - a[1].read)) {
		console.log(
			`  ${mode.padEnd(12)} ${String(t.read).padStart(4)} read, ${String(t.trimmed).padStart(3)} trimmed` +
				`${t.idleLoops ? ` (${fmt(t.idleLoops)} of idle time removed)` : ''}` +
				`${t.unresolved.length ? `, ${t.unresolved.length} long with no end evidence` : ''}`
		);
	}
	const gaps = [...byMode].flatMap(([mode, t]) => t.unresolved.map((u) => `  ${mode}: ${u}`));
	if (gaps.length) {
		console.log('\nlong recordings nothing dated the end of — check these by hand:');
		for (const line of gaps.slice(0, 20)) console.log(line);
	}
}
if (missing || failed) {
	console.log(`${missing} blob(s) missing, ${failed} failed to parse`);
}
if (!apply) {
	console.log('\ndry run — re-run with --apply to write');
} else {
	console.log(
		'\nwritten. Run scripts/backfill-derived.ts --apply to recompute the playtime ' +
			'boards and teammate lists, which credit the new lengths.'
	);
}

await closeDb();
