/**
 * Backfill the derived data the read paths now depend on:
 *
 * - `players.careerXp` / `players.totalWins` — leaderboard sort keys. Both are
 *   computed from fields already on each profile, so this needs no replay read
 *   at all. Required because uploads only rebuild the players in them, so a
 *   profile that never plays again would never gain the fields.
 * - the per-class playtime boards in `meta`, and each replay's settled outcome
 *   (see `refreshDerived`).
 *
 * Dry run (default):  node --env-file=.env scripts/backfill-derived.ts
 * Write for real:     node --env-file=.env scripts/backfill-derived.ts --apply
 *
 * Safe to re-run: everything here is recomputed from stored truth and written
 * only where it differs. Touches no bucket blobs and runs no player rebuild.
 */

import { MongoClient } from 'mongodb';
import { careerXp, totalWins } from '../src/lib/xp.ts';
import { closeDb, refreshDerived } from '../src/lib/server/db.ts';

const apply = process.argv.includes('--apply');

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is not set');

const mongo = new MongoClient(uri);
await mongo.connect();
const players = mongo.db(process.env.MONGODB_DB || 'uar').collection('players');

const docs = (await players
	.find(
		{},
		{ projection: { prestige: 1, xpEn: 1, xpWo: 1, xpCo: 1, winsByMode: 1, careerXp: 1, totalWins: 1 } }
	)
	.toArray()) as unknown as {
	_id: string;
	prestige: number;
	xpEn: number;
	xpWo: number;
	xpCo: number;
	winsByMode: number[];
	careerXp?: number;
	totalWins?: number;
}[];

const changed = docs
	.map((p) => ({ _id: p._id, careerXp: careerXp(p), totalWins: totalWins(p) }))
	.filter((next, i) => docs[i].careerXp !== next.careerXp || docs[i].totalWins !== next.totalWins);

console.log(`${docs.length} profiles read; ${changed.length} need sort keys written`);

if (!apply) {
	for (const c of changed.slice(0, 5)) {
		console.log(`  ${c._id}: careerXp=${c.careerXp} totalWins=${c.totalWins}`);
	}
	if (changed.length > 5) console.log(`  … and ${changed.length - 5} more`);
	console.log('\ndry run — re-run with --apply to write (also refreshes outcomes + class boards)');
} else {
	if (changed.length) {
		await players.bulkWrite(
			changed.map((c) => ({
				updateOne: {
					filter: { _id: c._id },
					update: { $set: { careerXp: c.careerXp, totalWins: c.totalWins } }
				}
			})) as never[],
			{ ordered: false }
		);
	}
	console.log(`wrote ${changed.length} profiles`);
	const { outcomes, boards } = await refreshDerived();
	console.log(`refreshDerived: ${outcomes} outcomes written, ${boards} class boards stored`);
}

await mongo.close();
// this script also went through db.ts, whose pool would otherwise keep the
// process alive and its connections open against the cluster
await closeDb();
