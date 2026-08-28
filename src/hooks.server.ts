import type { Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { readSession, sessionRenewal } from '$lib/server/session';
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
import { ensureBuildIndexes, sweepBuildImages } from '$lib/server/builds';
import { ensureNotificationIndexes } from '$lib/server/notifications';
import { ensureChatIndexes, sweepChat } from '$lib/server/chat';
import { sweepNotifications } from '$lib/server/notifications';
import { ensureReactionIndexes } from '$lib/server/reactions';
import { bucketConfigured } from '$lib/server/replay/s3';

// one parsing worker for the lifetime of the server, started before the
// first upload rather than inside it
warmReplayWorker();

// createIndex is idempotent, so this is a no-op after the first boot. Not
// awaited: a missing index only makes a query scan, which is no reason to
// hold the server's first request — and a failure here must not stop it
// serving at all (a fresh deploy against an unreachable database would
// otherwise never come up).
void ensureIndexes().catch((e) => console.error('index setup failed:', e));
void ensureBuildIndexes().catch((e) => console.error('build index setup failed:', e));
void ensureNotificationIndexes().catch((e) => console.error('notification index setup failed:', e));
void ensureChatIndexes().catch((e) => console.error('chat index setup failed:', e));
void ensureReactionIndexes().catch((e) => console.error('reaction index setup failed:', e));

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

// The chat's keep and the read notifications' age (see server/chat.ts and
// server/notifications.ts): a daily pass, small deletes, nothing on most days.
// Out of dev for the same reason as the other sweeps.
const RETENTION_SWEEP_EVERY_MS = 24 * 60 * 60_000;
const RETENTION_SWEEP_AFTER_BOOT_MS = 10 * 60_000;
if (!dev && dbConfigured()) {
	const sweep = () =>
		void Promise.all([sweepChat(), sweepNotifications()])
			.then(([chat, notes]) => {
				if (chat || notes) console.log(`retention sweep dropped ${chat} chat messages, ${notes} notifications`);
			})
			.catch((e) => console.error('retention sweep failed:', e));
	setTimeout(sweep, RETENTION_SWEEP_AFTER_BOOT_MS).unref();
	setInterval(sweep, RETENTION_SWEEP_EVERY_MS).unref();
}

// Pictures uploaded for community builds that no build shows (see
// server/builds.ts). Same clock, same reason to keep it out of dev: the
// bucket the local .env points at is the live one.
const IMAGE_SWEEP_EVERY_MS = 6 * 60 * 60_000;
const IMAGE_SWEEP_AFTER_BOOT_MS = 5 * 60_000;
if (!dev && dbConfigured() && bucketConfigured()) {
	const sweep = () =>
		void sweepBuildImages()
			.then((n) => {
				if (n) console.log(`build image sweep dropped ${n}`);
			})
			.catch((e) => console.error('build image sweep failed:', e));
	setTimeout(sweep, IMAGE_SWEEP_AFTER_BOOT_MS).unref();
	setInterval(sweep, IMAGE_SWEEP_EVERY_MS).unref();
}

// Browser notifications for lobby/ready changes. Listens on the same channel
// the SSE stream uses, so it needs no hook in any write path; it re-baselines
// on boot, which is why a deploy is quiet rather than announcing the standing
// roster to everyone.
startPushNotifier();

/**
 * A response a shared cache may keep must not carry someone's session with
 * it. Everything that reads `locals.session` already answers
 * `private, no-store`; this only spares the odd public route (the sitemap)
 * from a Set-Cookie it never asked for.
 */
function publiclyCacheable(response: Response): boolean {
	const cc = response.headers.get('cache-control') ?? '';
	return cc.includes('public');
}

export const handle: Handle = async ({ event, resolve }) => {
	const session = readSession(event.cookies);
	event.locals.session = session;
	const response = await resolve(event);
	// Sliding expiry (see sessionRenewal), decided after the route has run so
	// a route that set the cookie itself wins: `cookies.get` then returns that
	// fresh value, whose expiry is a full term away, and no renewal is due.
	// Sign-in, sign-out and the /api/me profile backfill all rely on that —
	// a renewal of the *old* payload appended over theirs would undo them.
	if (session !== null && !publiclyCacheable(response)) {
		const renewal = sessionRenewal(event.cookies, session);
		if (renewal !== null) response.headers.append('set-cookie', renewal);
	}
	return response;
};
