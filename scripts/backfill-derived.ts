/**
 * Backfill the derived data the read paths depend on:
 *
 * - the fields `withDerived` stores on each profile — `careerXp`/`totalWins`
 *   (leaderboard sort keys), plus `historyCount`/`classGames`/`latestFile`,
 *   which let a profile render without its whole replay history in hand.
 * - the per-class playtime boards in `meta`, and each replay's settled outcome
 *   (see `refreshDerived`).
 *
 * Required because uploads only rebuild the players in them, so a profile
 * whose owner never plays again would never gain the fields.
 *
 * Dry run (default):  node --env-file=.env scripts/backfill-derived.ts
 * Write for real:     node --env-file=.env scripts/backfill-derived.ts --apply
 *
 * Safe to re-run: everything here is recomputed from stored truth and written
 * only where it differs. Touches no bucket blobs and runs no player rebuild.
 */

import { MongoClient } from 'mongodb';
import { closeDb, refreshDerived, withDerived } from '../src/lib/server/db.ts';

const apply = process.argv.includes('--apply');

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is not set');

const mongo = new MongoClient(uri);
await mongo.connect();
const players = mongo.db(process.env.MONGODB_DB || 'uar').collection('players');

/** The stored fields `withDerived` produces — what this script maintains. */
const DERIVED = ['careerXp', 'totalWins', 'historyCount', 'classGames', 'latestFile'] as const;

// the inputs withDerived reads, plus the stored values to diff against. Of
// history only the two fields classGames/latestFile need — an inclusion
// projection throughout, since Mongo refuses to mix the two kinds.
const docs = (await players
	.find(
		{},
		{
			projection: {
				prestige: 1,
				xpEn: 1,
				xpWo: 1,
				xpCo: 1,
				winsByMode: 1,
				careerXp: 1,
				totalWins: 1,
				historyCount: 1,
				classGames: 1,
				latestFile: 1,
				'history.file': 1,
				'history.mos': 1
			}
		}
	)
	.toArray()) as unknown as Record<string, unknown>[];
console.log(`${docs.length} profiles read`);

const changed = docs
	.map((p) => {
		const d = withDerived(p);
		const next: Record<string, unknown> = { _id: p._id };
		for (const k of DERIVED) next[k] = d[k];
		return next;
	})
	.filter((next, i) =>
		DERIVED.some((k) => JSON.stringify(docs[i][k]) !== JSON.stringify(next[k]))
	);

console.log(`${changed.length} profiles need derived fields written`);

if (!apply) {
	for (const c of changed.slice(0, 5)) {
		console.log(
			`  ${c._id}: careerXp=${c.careerXp} totalWins=${c.totalWins} history=${c.historyCount}`
		);
	}
	if (changed.length > 5) console.log(`  … and ${changed.length - 5} more`);
	console.log('\ndry run — re-run with --apply to write (also refreshes outcomes + class boards)');
} else {
	if (changed.length) {
		await players.bulkWrite(
			changed.map(({ _id, ...set }) => ({
				updateOne: { filter: { _id }, update: { $set: set } }
			})) as never[],
			{ ordered: false }
		);
	}
	console.log(`wrote ${changed.length} profiles`);
	const { outcomes, boards, mates } = await refreshDerived();
	console.log(`refreshDerived: ${outcomes} outcomes, ${boards} class boards, ${mates} teammate lists`);
}

await mongo.close();
// this script also went through db.ts, whose pool would otherwise keep the
// process alive and its connections open against the cluster
await closeDb();
