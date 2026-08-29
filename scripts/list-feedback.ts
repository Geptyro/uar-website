/**
 * Print stored visitor feedback and Companion reports, newest first.
 *
 * Usage (creds in .env, same as seed-storage):
 *   node --env-file=.env scripts/list-feedback.ts
 *   node --env-file=.env scripts/list-feedback.ts --log <id>   # one report's log
 *
 * The listing never fetches the `log` field. A report carries up to 64 KB of
 * it, and this database is an Atlas M0 whose read throughput is the binding
 * constraint on everything (see CLAUDE.md) — twenty reports would otherwise
 * make listing the inbox a megabyte-long download to print a few lines. Ask
 * for a log by id when a report is worth reading in full.
 */

import { ObjectId } from 'mongodb';
import { db, type FeedbackDoc } from '../src/lib/server/db.ts';

const args = process.argv.slice(2);
const wanted = args.indexOf('--log') === -1 ? null : args[args.indexOf('--log') + 1];

const d = await db();
const col = d.collection<FeedbackDoc>('feedback');

if (wanted) {
	if (!ObjectId.isValid(wanted)) {
		console.error(`Not an id: ${wanted}`);
		process.exit(1);
	}
	const doc = await col.findOne({ _id: new ObjectId(wanted) } as never);
	if (!doc) {
		console.error(`No entry ${wanted}.`);
		process.exit(1);
	}
	console.log(doc.log ?? '(no log on this entry)');
	process.exit(0);
}

const docs = await col
	.find()
	.project<FeedbackDoc & { _id: ObjectId; log?: never }>({ log: 0 })
	.sort({ createdAt: -1 })
	.toArray();

if (!docs.length) {
	console.log('No feedback yet.');
} else {
	for (const f of docs) {
		const who = [f.name, f.contact, f.account?.battletag].filter(Boolean).join(' · ');
		const what =
			f.source === 'companion'
				? ` [companion ${[f.app?.version && `v${f.app.version}`, f.app?.platform]
						.filter(Boolean)
						.join(' ')}]`
				: '';
		console.log(`── ${f.createdAt}${who ? `  (${who})` : ''}${what}`);
		if (f.message) console.log(f.message);
		if (f.source === 'companion') {
			const app = f.app ?? {};
			const detail = [
				app.signedIn && `signed in: ${app.signedIn}`,
				app.sc2 && `sc2: ${app.sc2}`,
				app.watching && `watching: ${app.watching}`,
				app.update && `update: ${app.update}`,
				app.crashedAt && `error logged: ${app.crashedAt}`
			].filter(Boolean);
			if (detail.length) console.log(detail.join(', '));
			console.log(`log: node --env-file=.env scripts/list-feedback.ts --log ${f._id}`);
		}
		console.log('');
	}
	console.log(`${docs.length} entr${docs.length === 1 ? 'y' : 'ies'}.`);
}
process.exit(0);
