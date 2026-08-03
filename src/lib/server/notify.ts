/**
 * Turns roster changes into browser notifications.
 *
 * This is a subscriber on the same in-process channel the SSE stream uses
 * (server/events.ts), which is what keeps it honest: everything that already
 * announces a change — a ready toggle, a presence heartbeat, a lobby opening —
 * feeds this without a single call site having to remember to. The rules for
 * what is worth interrupting someone over are in $lib/push, kept pure and
 * under test; this is the I/O around them.
 *
 * State lives in this process, like the rate limiters and the read cache, on
 * the same single-always-on-machine assumption stated in events.ts. The cost
 * of that is one missed notification per deploy — a restart re-baselines, so
 * whatever was already flagged is not announced — which is the right way round:
 * the alternative is a release notifying everybody about a lobby from before it.
 */

import { dev } from '$app/environment';
import {
	deletePushSub,
	dbConfigured,
	getNamesByToon,
	getPushSubs,
	getPushSubsForAccount,
	getReadyPlayers
} from './db';
import { getActivePresence } from './presenceStore';
import { subscribeReady } from './events';
import { sendPush, type VapidKeys } from './webpush';
import {
	NO_LOBBY_STATE,
	NO_READY_STATE,
	diffLobby,
	diffReady,
	lobbyPayload,
	readyPayload,
	type LobbyState,
	type PushPayload,
	type ReadyState,
	type Subject
} from '$lib/push';
import { PRESENCE_STALE_MS, splitPresence, type PresenceEntry } from '$lib/presence';

/**
 * A burst of writes is one event to a player: a presence heartbeat upserts,
 * withdraws a ready flag and publishes twice. Coalesce them, and let the
 * roster settle before deciding anything.
 */
const SETTLE_MS = 3_000;

/** The same flap window the companion uses for a lobby blinking out. */
const LOBBY_GAP_MS = 10 * 60_000;

let readyState: ReadyState = NO_READY_STATE;
let lobbyState: LobbyState = NO_LOBBY_STATE;
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;

export function pushConfigured(): boolean {
	return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function vapidKeys(): VapidKeys {
	return {
		publicKey: process.env.VAPID_PUBLIC_KEY!,
		privateKey: process.env.VAPID_PRIVATE_KEY!,
		// RFC 8292 wants a way to contact whoever is sending; push services do
		// use it when something is wrong with the traffic
		subject: process.env.VAPID_SUBJECT || 'https://uar.cedricdessalles.dev'
	};
}

/** The public key the browser needs to subscribe (`applicationServerKey`). */
export function publicKey(): string | null {
	return pushConfigured() ? process.env.VAPID_PUBLIC_KEY! : null;
}

/**
 * Reads the current roster and announces what changed.
 *
 * Every read here is one the SSE clients already caused (`ready`, `presence`,
 * `avatars`/names are all cached with the same keys the API routes use), so
 * the fan-out costs the cluster nothing beyond the first change after a TTL.
 */
async function evaluate(): Promise<void> {
	const now = Date.now();
	const readyDocs = await getReadyPlayers();
	// in-process, so this is a map walk rather than a read against the cluster
	const presenceDocs = getActivePresence(PRESENCE_STALE_MS, now);
	// the flag and the heartbeat both store only the account; the profile name
	// — the one players know each other by — comes from the link
	const names = readyDocs.length > 0 || presenceDocs.length > 0 ? await getNamesByToon() : {};
	const nameOf = (toon: string | undefined) => (toon ? (names[toon] ?? null) : null);

	const ready = readyDocs.map((d) => ({
		id: d._id,
		battletag: d.battletag,
		name: nameOf(d.toon),
		until: d.until
	}));

	// splitPresence is generic over the entry, so the account id rides along
	// through the grouping and comes back out on each member
	const entries: (PresenceEntry & { id: string })[] = presenceDocs.map((d) => ({
		id: d.sub,
		battletag: d.battletag,
		name: nameOf(d.toon),
		toon: d.toon ?? null,
		avatar: d.avatar ?? null,
		status: d.status as 'lobby' | 'ingame',
		uar: d.uar,
		players: d.players,
		displayTime: d.displayTime,
		roster: d.roster,
		lobbyId: d.lobbyId ?? null,
		selfName: d.selfName
	}));
	// grouped the same way the site draws them, so "a lobby" means the same
	// thing in a notification as it does on the page
	const lobbies = splitPresence(entries).lobbies;
	const lobbyMembers: Subject[] = (lobbies[0]?.members ?? []).map((m) => ({
		id: m.id,
		battletag: m.battletag,
		// selfName is what SC2 calls the reporter in that lobby; the linked
		// profile name is the fallback for a heartbeat that carried none
		name: m.selfName ?? m.name
	}));

	const readyResult = diffReady(readyState, ready, now);
	readyState = readyResult.state;
	const lobbyResult = diffLobby(lobbyState, lobbyMembers, now, LOBBY_GAP_MS);
	lobbyState = lobbyResult.state;

	if (readyResult.diff === null && lobbyResult.members === null) return;

	const subs = await getPushSubs();
	if (subs.length === 0) return;

	const sends: Promise<void>[] = [];
	for (const s of subs) {
		// the account, not the battletag stored alongside it — that one is a
		// snapshot from whenever this browser subscribed
		const me = s.sub;
		const payloads: PushPayload[] = [];
		if (lobbyResult.members !== null && s.prefs.lobby) {
			const p = lobbyPayload(lobbyResult.members, me);
			if (p) payloads.push(p);
		}
		if (readyResult.diff !== null && s.prefs.ready) {
			const p = readyPayload(readyResult.diff, me);
			if (p) payloads.push(p);
		}
		for (const payload of payloads) {
			sends.push(
				sendPush({ endpoint: s._id, p256dh: s.p256dh, auth: s.auth }, payload, vapidKeys()).then(
					async (result) => {
						// the push service is the only thing that ever tells us a
						// subscription is dead — a browser that revoked permission or
						// cleared its storage says nothing
						if (result === 'gone') await deletePushSub(s._id).catch(() => {});
					}
				)
			);
		}
	}
	if (sends.length > 0) {
		await Promise.allSettled(sends);
		console.log(`push: ${sends.length} notification(s) sent to ${subs.length} subscription(s)`);
	}
}

/**
 * Sends one notification to the caller's own devices, worded exactly as the
 * real thing.
 *
 * The point is to answer "will my phone actually buzz?", which nothing else
 * can: the rules in $lib/push are unit-tested, but VAPID keys, the encryption,
 * the push service, the service worker and the click handler are only ever
 * exercised by a real delivery. It goes to one account's subscriptions and
 * never to anybody else's, so it is safe to run against the live cluster — and
 * it deliberately writes no roster row, which would otherwise put a player who
 * does not exist on the live site's ready list.
 *
 * Works even when the notifier itself is idle in dev: this send is asked for
 * by a person, not triggered by a roster nobody is watching.
 */
export async function sendTestPush(
	accountId: string,
	who: string,
	topic: 'ready' | 'lobby' = 'ready'
): Promise<{ sent: number; failed: number; devices: number }> {
	if (!pushConfigured() || !dbConfigured()) return { sent: 0, failed: 0, devices: 0 };
	const subject: Subject = { id: `test:${accountId}`, battletag: who, name: who };
	const payload =
		topic === 'lobby'
			? lobbyPayload([subject], accountId)
			: readyPayload({ added: [subject], removed: [], total: 1 }, accountId);
	if (!payload) return { sent: 0, failed: 0, devices: 0 };

	const subs = await getPushSubsForAccount(accountId);
	const results = await Promise.all(
		subs.map(async (s) => {
			const result = await sendPush(
				{ endpoint: s._id, p256dh: s.p256dh, auth: s.auth },
				// the headline is the real wording; only the second line admits it
				{ ...payload, body: 'Test notification — a real one looks just like this.' },
				vapidKeys()
			);
			if (result === 'gone') await deletePushSub(s._id).catch(() => {});
			return result;
		})
	);
	return {
		devices: subs.length,
		sent: results.filter((r) => r === 'sent').length,
		failed: results.filter((r) => r !== 'sent').length
	};
}

function schedule(): void {
	if (timer) clearTimeout(timer);
	timer = setTimeout(() => {
		timer = null;
		// an evaluation in flight already read a roster older than this change:
		// wait it out rather than dropping the event, or a toggle that lands
		// mid-fan-out is never announced at all
		if (running) {
			schedule();
			return;
		}
		running = true;
		void evaluate()
			.catch((e) => console.error('push evaluation failed:', e))
			.finally(() => {
				running = false;
			});
	}, SETTLE_MS);
	timer.unref?.();
}

/**
 * Starts listening. Called once from hooks.server.ts.
 *
 * Never in dev by default: the local .env points at the live cluster, so a dev
 * server left running would send every player a second copy of every
 * notification from a machine nobody is watching — the same hazard that keeps
 * the replay blob sweep out of dev. Set PUSH_IN_DEV=1 to test locally, with
 * VAPID keys of your own.
 */
export function startPushNotifier(): void {
	if (!pushConfigured() || !dbConfigured()) return;
	if (dev && process.env.PUSH_IN_DEV !== '1') {
		console.log('push: notifier idle in dev (set PUSH_IN_DEV=1 to enable)');
		return;
	}
	subscribeReady(schedule);
	// establish the baseline now rather than on the first change, so the first
	// real change after a deploy is a diff against reality and not against
	// nothing (which would announce the whole standing roster)
	schedule();
}
