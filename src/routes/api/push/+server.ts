/**
 * Web Push subscriptions for the account page's notification toggles.
 *
 * GET (public): whether push is configured, the VAPID public key the browser
 * needs to subscribe, and — with `?endpoint=` — the stored preferences for
 * that one browser. Preferences are per subscription, not per account: the
 * phone that should buzz for a forming lobby is rarely the desktop already
 * showing the page.
 * POST (cookie-auth): store or update this browser's subscription.
 * DELETE (cookie-auth): forget it.
 *
 * A subscription is only ever as good as the browser's permission grant, and
 * a revoked grant is never reported back to the site — so rows are also
 * dropped by the fan-out when a push service answers 404/410 (server/notify.ts).
 */
import { error, json } from '@sveltejs/kit';
import {
	dbConfigured,
	deletePushSub,
	getPushSubsForAccount,
	upsertPushSub,
	type PushSubDoc
} from '$lib/server/db';
import { publicKey, pushConfigured } from '$lib/server/notify';
import { readPrefs } from '$lib/push';
import type { RequestHandler } from './$types';

export const prerender = false;

/** Endpoints are opaque URLs from the browser — accept only sane https ones. */
function validEndpoint(value: unknown): value is string {
	if (typeof value !== 'string' || value.length > 1024) return false;
	try {
		return new URL(value).protocol === 'https:';
	} catch {
		return false;
	}
}

const validKey = (value: unknown, bytes: number): value is string =>
	typeof value === 'string' &&
	value.length < 200 &&
	Buffer.from(value, 'base64url').length === bytes;

export const GET: RequestHandler = async ({ locals, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	const enabled = pushConfigured() && dbConfigured();
	const endpoint = url.searchParams.get('endpoint');
	let prefs = readPrefs(undefined);
	let subscribed = false;
	if (enabled && locals.session && endpoint) {
		const mine = await getPushSubsForAccount(locals.session.sub);
		const match = mine.find((s) => s._id === endpoint);
		if (match) {
			prefs = readPrefs(match.prefs);
			subscribed = true;
		}
	}
	return json({ enabled, key: publicKey(), subscribed, prefs });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const s = locals.session;
	if (!s) error(401, 'sign in with Battle.net to enable notifications');
	if (!pushConfigured() || !dbConfigured()) error(503, 'notifications are not configured');

	const body = (await request.json().catch(() => null)) as {
		endpoint?: unknown;
		keys?: { p256dh?: unknown; auth?: unknown };
		prefs?: unknown;
	} | null;
	if (!body || !validEndpoint(body.endpoint)) error(400, 'malformed push subscription');
	// 65-byte uncompressed P-256 point and a 16-byte auth secret — anything
	// else cannot be encrypted to, and would fail silently at send time
	if (!validKey(body.keys?.p256dh, 65) || !validKey(body.keys?.auth, 16)) {
		error(400, 'malformed push subscription keys');
	}

	const now = new Date().toISOString();
	const existing = (await getPushSubsForAccount(s.sub)).find((d) => d._id === body.endpoint);
	const doc: PushSubDoc = {
		_id: body.endpoint,
		sub: s.sub,
		battletag: s.battletag,
		p256dh: body.keys.p256dh as string,
		auth: body.keys.auth as string,
		prefs: readPrefs(body.prefs),
		createdAt: existing?.createdAt ?? now,
		seenAt: now
	};
	await upsertPushSub(doc);
	return json({ subscribed: true, prefs: doc.prefs });
};

export const DELETE: RequestHandler = async ({ locals, request }) => {
	const s = locals.session;
	if (!s) error(401, 'not signed in');
	if (!dbConfigured()) error(503, 'player database not configured');
	const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
	if (!body || !validEndpoint(body.endpoint)) error(400, 'malformed endpoint');
	// only your own: the endpoint is a bearer-ish secret, but the session is
	// what says whose row this is
	const mine = await getPushSubsForAccount(s.sub);
	if (mine.some((d) => d._id === body.endpoint)) await deletePushSub(body.endpoint);
	return json({ subscribed: false });
};
