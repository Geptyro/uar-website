import type { Handle } from '@sveltejs/kit';
import { readSession } from '$lib/server/session';
import { cacheStats, ensureIndexes } from '$lib/server/db';
import { warmReplayWorker } from '$lib/server/replay/offthread';

// one parsing worker for the lifetime of the server, started before the
// first upload rather than inside it
warmReplayWorker();

// createIndex is idempotent, so this is a no-op after the first boot. Not
// awaited: a missing index only makes a query scan, which is no reason to
// hold the server's first request — and a failure here must not stop it
// serving at all (a fresh deploy against an unreachable database would
// otherwise never come up).
void ensureIndexes().catch((e) => console.error('index setup failed:', e));

// Where the reads actually go, in `fly logs` rather than an admin page: a hit
// rate that has drifted, or a build that has grown expensive, is the signal
// that a TTL is set wrong or a query has started scanning something it didn't.
// Quiet by design — one block every quarter hour, and nothing at all when the
// machine has served no cache traffic since the last one.
const STATS_EVERY_MS = 15 * 60_000;
setInterval(() => {
	for (const line of cacheStats()) console.log(`cache ${line}`);
}, STATS_EVERY_MS).unref();

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.session = readSession(event.cookies);
	return resolve(event);
};
