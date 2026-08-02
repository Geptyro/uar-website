/**
 * Rebuild every profile from every stored replay.
 *
 * Uploads only rebuild the players in them, so a field added to a history entry
 * — `awards`, here — never reaches a profile whose owner has not played since.
 * This is the from-scratch path that backfills everyone at once, and the only
 * place a player who has left every replay gets pruned.
 *
 * Report only (default):  node --env-file=.env scripts/rebuild-players.ts
 * Rebuild for real:       node --env-file=.env scripts/rebuild-players.ts --apply
 *
 * Safe to re-run: every profile is recomputed from the `replays` collection,
 * which is the authoritative record and is never written here. Slow by nature —
 * it reads the whole archive, sightings and all, against a cluster that
 * throttles on bytes — so run it once and let it finish.
 */

import { MongoClient } from 'mongodb';
import { closeDb, rebuildPlayers } from '../src/lib/server/db.ts';

const apply = process.argv.includes('--apply');

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is not set');

const mongo = new MongoClient(uri);
await mongo.connect();
const dbName = process.env.MONGODB_DB || 'uar';
const players = mongo.db(dbName).collection('players');
const replays = mongo.db(dbName).collection('replays');

const [playerCount, replayCount, withAwards] = await Promise.all([
	players.countDocuments(),
	replays.countDocuments(),
	players.countDocuments({ 'history.awards.0': { $exists: true } })
]);

console.log(`db ${dbName}: ${playerCount} profiles, ${replayCount} replays`);
console.log(`${withAwards} profiles already carry awards on at least one game`);

if (!apply) {
	console.log('\nreport only — re-run with --apply to rebuild');
} else {
	console.log('\nrebuilding every profile from every replay…');
	const started = Date.now();
	const count = await rebuildPlayers();
	const after = await players.countDocuments({ 'history.awards.0': { $exists: true } });
	console.log(`rebuilt ${count} profiles in ${Math.round((Date.now() - started) / 1000)}s`);
	console.log(`${after} profiles now carry awards on at least one game`);
}

await mongo.close();
// this script also went through db.ts, whose pool would otherwise keep the
// process alive and its connections open against the cluster
await closeDb();
