/**
 * Re-read every stored game whose file is still in the bucket with the
 * current parser, and write down what a newer parser knows that the doc does
 * not.
 *
 * Which docs: readable ones (`blobPrunedAt` absent) stamped below
 * PARSER_GENERATION — see that constant in replay/extract.ts for what each
 * generation added. Docs whose file the retention sweep released stay as they
 * are: the bytes that would say more are gone. What a re-read supplies today:
 *
 * - on each sighting, found by its toon: `leftLoop` and `leftReason` (the
 *   moment the player left, which every playtime figure credits up to — see
 *   `playedLoops` in lib/gameEnd.ts), `result`, `host`, `deaths`, `deadLoops`;
 * - on the doc: `mapChecksum`, and the `parser` stamp.
 *
 * Dry run (default):  node --env-file=.env scripts/backfill-parser.ts
 * Write for real:     node --env-file=.env scripts/backfill-parser.ts --apply
 * Limit a pass:       node --env-file=.env scripts/backfill-parser.ts --apply --limit 50
 *
 * The dry run is the coverage report — how many players a re-read finds
 * leaving early, how much credited time that takes back — so a pass can be
 * sized before it is written. Safe to re-run and safe to stop: it writes one
 * doc at a time, and a doc it has stamped is not read again.
 *
 * Applying changes what every playtime figure credits, so a first pass over a
 * generation that touched `leftLoop` should be followed by
 * `scripts/rebuild-players.ts --apply`.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseReplay, PARSER_GENERATION } from '../src/lib/server/replay/extract.ts';
import { getObject, bucketConfigured } from '../src/lib/server/replay/s3.ts';
import { db, dbConfigured, closeDb, type ReplayDoc } from '../src/lib/server/db.ts';
import { LOOPS_PER_SECOND, playedLoops } from '../src/lib/gameEnd.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const apply = process.argv.includes('--apply');
const limitArg = process.argv.indexOf('--limit');
const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;
/** Leaving this long before the game's end is what the report calls early. */
const EARLY_LOOPS = LOOPS_PER_SECOND * 300;

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

const fmt = (loops: number) => {
	const s = Math.round(loops / LOOPS_PER_SECOND);
	return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

const d = await db();
const replays = d.collection<ReplayDoc>('replays');

// Narrow on purpose: the cluster throttles on bytes, and the sightings are
// what a re-parse supplies — the update below finds each one by toon.
const todo = (await replays
	.find(
		{
			$or: [{ parser: { $exists: false } }, { parser: { $lt: PARSER_GENERATION } }]
		},
		{ projection: { blobPrunedAt: 1, durationLoops: 1, gameLoops: 1 } }
	)
	.sort({ playedAt: -1 })
	.toArray()) as Pick<ReplayDoc, '_id' | 'blobPrunedAt' | 'durationLoops' | 'gameLoops'>[];

const pruned = todo.filter((r) => r.blobPrunedAt);
const readable = todo.filter((r) => !r.blobPrunedAt).slice(0, limit);
console.log(
	`${todo.length} doc(s) below parser generation ${PARSER_GENERATION}: ${readable.length} to re-read` +
		`${limit === Infinity ? '' : ` (of ${todo.length - pruned.length} readable)`}, ` +
		`${pruned.length} whose file was released — those keep whole-game crediting`
);

let read = 0;
let missing = 0;
let failed = 0;
let stamped = 0;
let sightingsSeen = 0;
let leftSeen = 0;
let leftEarly = 0;
let creditedLoops = 0;
let takenBackLoops = 0;
const examples: string[] = [];

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
	// the length the doc credits today, so the report measures the change to
	// what pages show and not to what a fresh parse would say
	const gameLoops = r.gameLoops ?? r.durationLoops ?? parsed.gameLoops;
	const set: Record<string, unknown> = { parser: PARSER_GENERATION, mapChecksum: parsed.mapChecksum };
	const arrayFilters: Record<string, unknown>[] = [];
	const keyed = new Set<string>();
	const early: string[] = [];
	for (const s of parsed.sightings) {
		sightingsSeen += 1;
		creditedLoops += gameLoops;
		if (s.leftLoop !== undefined) {
			leftSeen += 1;
			const played = playedLoops(gameLoops, s.leftLoop);
			takenBackLoops += gameLoops - played;
			if (s.leftLoop < gameLoops - EARLY_LOOPS) {
				leftEarly += 1;
				early.push(`${s.name} at ${fmt(s.leftLoop)}`);
			}
		}
		// Each stored sighting is found by its toon (by name for the toon-less
		// handful from before signatures were read). One identifier per key: two
		// filters landing on the same element would make the $set conflict.
		const key = s.toon || s.name;
		if (keyed.has(key)) continue;
		keyed.add(key);
		const i = arrayFilters.length;
		// every per-sighting fact the parser reads off the recording; only the
		// ones this recording has — the field's absence is information too
		const facts = {
			leftLoop: s.leftLoop,
			leftReason: s.leftReason,
			result: s.result,
			host: s.host,
			deaths: s.deaths,
			deadLoops: s.deadLoops
		};
		let any = false;
		for (const [field, value] of Object.entries(facts)) {
			if (value === undefined) continue;
			set[`sightings.$[s${i}].${field}`] = value;
			any = true;
		}
		if (!any) {
			keyed.delete(key);
			continue;
		}
		arrayFilters.push(
			s.toon ? { [`s${i}.toon`]: s.toon } : { [`s${i}.toon`]: '', [`s${i}.name`]: s.name }
		);
	}
	if (early.length) {
		const line = `  ${r._id}: ${fmt(gameLoops)} game, ${early.length} left early — ${early.join(', ')}`;
		if (examples.length < 25) examples.push(line);
	}
	if (apply) {
		await replays.updateOne(
			{ _id: r._id },
			{ $set: set },
			arrayFilters.length ? { arrayFilters } : {}
		);
		stamped += 1;
	}
}

console.log(
	`\nre-read ${read} replay(s)` +
		`${missing ? `, ${missing} with no blob` : ''}` +
		`${failed ? `, ${failed} that failed to parse` : ''}` +
		`${apply ? `; ${stamped} doc(s) written` : ' (dry run — nothing written)'}`
);
if (read) {
	console.log(
		`  ${sightingsSeen} sightings, ${leftSeen} with a leave on record, ${leftEarly} of them ≥5 min before the end` +
			`\n  whole-game crediting had ${fmt(creditedLoops)} of player-time on these games; ` +
			`per-player crediting takes back ${fmt(takenBackLoops)}` +
			`${creditedLoops ? ` (${((100 * takenBackLoops) / creditedLoops).toFixed(1)}%)` : ''}`
	);
}
if (examples.length) {
	console.log('\nfor instance:');
	for (const line of examples) console.log(line);
}
if (apply && stamped) {
	console.log(
		'\nif this pass was the first to write leftLoop, also run: node --env-file=.env scripts/rebuild-players.ts --apply'
	);
}

await closeDb();
