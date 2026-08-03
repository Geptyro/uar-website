import type { Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { readSession } from '$lib/server/session';
import {
	cacheStats,
	dbConfigured,
	ensureIndexes,
	pruneEnabled,
	sweepReplayBlobs,
	warmCache
} from '$lib/server/db';
import { warmReplayWorker } from '$lib/server/replay/offthread';
import { startPushNotifier } from '$lib/server/notify';

// one parsing worker for the lifetime of the server, started before the
// first upload rather than inside it
warmReplayWorker();

// createIndex is idempotent, so this is a no-op after the first boot. Not
// awaited: a missing index only makes a query scan, which is no reason to
// hold the server's first request — and a failure here must not stop it
// serving at all (a fresh deploy against an unreachable database would
// otherwise never come up).
void ensureIndexes().catch((e) => console.error('index setup failed:', e));

// The cache lives in this process's memory, so a deploy empties it. Fill it
// before anyone asks, rather than charging the first visitor after a release
// for the whole cold read. Not awaited: the server should serve immediately,
// and a request that beats the warm-up shares its in-flight read anyway.
void warmCache().catch((e) => console.error('cache warm failed:', e));

// Where the reads actually go, in `fly logs` rather than an admin page: a hit
// rate that has drifted, or a build that has grown expensive, is the signal
// that a TTL is set wrong or a query has started scanning something it didn't.
// Quiet by design — one block every quarter hour, and nothing at all when the
// machine has served no cache traffic since the last one.
const STATS_EVERY_MS = 15 * 60_000;
setInterval(() => {
	for (const line of cacheStats()) console.log(`cache ${line}`);
}, STATS_EVERY_MS).unref();

// Replay blob retention (see lib/replayRetention.ts). A file stops being
// someone's bank backup the moment a *different* player uploads a later game,
// which is not an event any one upload can notice — so the sweep is a clock,
// not a hook. It reads one narrow projection of the replays collection, about
// what a page of the replay list costs, and deletes nothing on the vast
// majority of passes.
//
// Never in dev: the local .env points at the live cluster and bucket, and a dev
// server left running would quietly delete production blobs. Deleting from a
// developer's machine is scripts/prune-blobs.ts, which asks first.
const SWEEP_EVERY_MS = 60 * 60_000;
const SWEEP_AFTER_BOOT_MS = 60_000;
if (!dev && dbConfigured() && pruneEnabled()) {
	const sweep = () =>
		void sweepReplayBlobs().catch((e) => console.error('replay blob sweep failed:', e));
	// a deploy is also the moment an archive has had the longest to drift, but
	// let the machine finish coming up first
	setTimeout(sweep, SWEEP_AFTER_BOOT_MS).unref();
	setInterval(sweep, SWEEP_EVERY_MS).unref();
}

// Browser notifications for lobby/ready changes. Listens on the same channel
// the SSE stream uses, so it needs no hook in any write path; it re-baselines
// on boot, which is why a deploy is quiet rather than announcing the standing
// roster to everyone.
startPushNotifier();

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.session = readSession(event.cookies);
	return resolve(event);
};
