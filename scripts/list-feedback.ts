/**
 * Print stored visitor feedback, newest first.
 *
 * Usage (creds in .env, same as seed-storage):
 *   node --env-file=.env scripts/list-feedback.ts
 */

import { db, type FeedbackDoc } from '../src/lib/server/db.ts';

const d = await db();
const docs = await d
	.collection<FeedbackDoc>('feedback')
	.find()
	.sort({ createdAt: -1 })
	.toArray();

if (!docs.length) {
	console.log('No feedback yet.');
} else {
	for (const f of docs) {
		const who = [f.name, f.contact].filter(Boolean).join(' · ');
		console.log(`── ${f.createdAt}${who ? `  (${who})` : ''}\n${f.message}\n`);
	}
	console.log(`${docs.length} entr${docs.length === 1 ? 'y' : 'ies'}.`);
}
process.exit(0);
