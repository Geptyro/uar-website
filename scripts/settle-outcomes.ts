/**
 * Backfill `replays.settledOutcome` for games ingested before outcomes were
 * written down.
 *
 * Settling a game's result needs the save-file counters of every stored game
 * (see src/lib/outcome.ts), which is far too much to read on a page view — so
 * `rebuildPlayers` now writes the verdict onto each replay doc and the read
 * paths just project it. Existing docs predate that, hence this one-off.
 *
 * Dry run (default):  node --env-file=.env scripts/settle-outcomes.ts
 * Write for real:     node --env-file=.env scripts/settle-outcomes.ts --apply
 *
 * Safe to re-run: it writes only the docs whose verdict actually moved, and
 * touches nothing else — no player rebuild, no bucket blobs. Shares
 * `persistSettledOutcomes` with the server, so it cannot drift from what an
 * upload would have written.
 */

import { closeDb, persistSettledOutcomes, type ReplayDoc } from '../src/lib/server/db.ts';
import { outcomeChanges } from '../src/lib/outcome.ts';
import { MongoClient } from 'mongodb';

const apply = process.argv.includes('--apply');

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is not set');

const mongo = new MongoClient(uri);
await mongo.connect();
const col = mongo.db(process.env.MONGODB_DB || 'uar').collection<ReplayDoc>('replays');

// the fields that settle an outcome, and the current verdict to diff against
const docs = await col
	.find(
		{},
		{
			projection: {
				playedAt: 1,
				outcome: 1,
				settledOutcome: 1,
				'sightings.toon': 1,
				'sightings.winsByMode': 1,
				'sightings.gamesPlayed': 1
			}
		}
	)
	.toArray();
console.log(`read ${docs.length} replays`);

// same helper the server writes from, so the dry run cannot disagree with it
const changed = outcomeChanges(
	docs.map((r) => ({
		file: r._id,
		playedAt: r.playedAt,
		outcome: r.outcome,
		settledOutcome: r.settledOutcome,
		sightings: (r.sightings ?? []).map((s) => ({
			toon: s.toon,
			wins: (s.winsByMode ?? []).reduce((a, b) => a + b, 0),
			gamesPlayed: s.gamesPlayed
		}))
	}))
);
const stored = new Map(docs.map((r) => [r._id, r.settledOutcome]));
console.log(`${changed.length} docs need writing`);

if (!apply) {
	for (const c of changed.slice(0, 10)) {
		console.log(`  ${c.file}: ${stored.get(c.file) ?? '—'} -> ${c.outcome ?? '—'}`);
	}
	if (changed.length > 10) console.log(`  … and ${changed.length - 10} more`);
	console.log('\ndry run — re-run with --apply to write');
} else {
	const written = await persistSettledOutcomes(docs);
	console.log(`wrote ${written} docs`);
}

await mongo.close();
// this script also went through db.ts, whose pool would otherwise keep the
// process alive and its connections open against the cluster
await closeDb();
