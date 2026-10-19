/**
 * Battle.net OAuth 2.0 + StarCraft II community API client.
 *
 * Authorization-code login flow:
 *   /auth/bnet          -> authorizeUrl() redirect (scope "openid sc2.profile")
 *   /auth/bnet/callback -> exchangeCode() + fetchUserInfo() + lookupSc2Profiles()
 *
 * Blizzard offers no battletag -> profile lookup, only account id -> profiles,
 * and the account id is read off the user's own token by fetchUserInfo — so a
 * linked toon is proof the visitor owns the Battle.net account behind it. The
 * player endpoint itself also answers the app's own token (checked 2026-10-19),
 * which is what lets a failed lookup be retried after the user's token is gone.
 *
 * Env: BNET_CLIENT_ID / BNET_CLIENT_SECRET (from develop.battle.net), plus
 * AUTH_SECRET for the session cookie (see ./session.ts). The registered
 * redirect URI must exactly match ORIGIN + /auth/bnet/callback (override with
 * BNET_REDIRECT_URI if it can't).
 */

const OAUTH_HOST = 'https://oauth.battle.net';

/** Regional API hosts queried for linked profiles. Each response tags profiles
 * with their own regionId, but coverage per host is spotty, so all three are
 * tried and merged. CN is a separate ecosystem and is not supported. */
const API_HOSTS = [
	'https://eu.api.blizzard.com',
	'https://us.api.blizzard.com',
	'https://kr.api.blizzard.com'
];

const FETCH_TIMEOUT_MS = 10_000;

/** One SC2 profile attached to a Battle.net account. */
export interface Sc2Profile {
	/** `${regionId}-S2-${realmId}-${profileId}` — same format as players._id. */
	toon: string;
	name: string;
	regionId: number;
	realmId: number;
	profileId: string;
	avatarUrl?: string;
}

export function bnetConfigured(): boolean {
	return Boolean(
		process.env.BNET_CLIENT_ID && process.env.BNET_CLIENT_SECRET && process.env.AUTH_SECRET
	);
}

function clientId(): string {
	const id = process.env.BNET_CLIENT_ID;
	if (!id) throw new Error('BNET_CLIENT_ID is not set');
	return id;
}

function clientSecret(): string {
	const secret = process.env.BNET_CLIENT_SECRET;
	if (!secret) throw new Error('BNET_CLIENT_SECRET is not set');
	return secret;
}

export function authorizeUrl(redirectUri: string, state: string): string {
	const params = new URLSearchParams({
		response_type: 'code',
		client_id: clientId(),
		scope: 'openid sc2.profile',
		state,
		redirect_uri: redirectUri
	});
	return `${OAUTH_HOST}/authorize?${params}`;
}

function basicAuth(): string {
	return `Basic ${Buffer.from(`${clientId()}:${clientSecret()}`).toString('base64')}`;
}

/** Exchange the callback's authorization code for a user access token. */
export async function exchangeCode(code: string, redirectUri: string): Promise<string> {
	const res = await fetch(`${OAUTH_HOST}/token`, {
		method: 'POST',
		headers: {
			Authorization: basicAuth(),
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
	});
	if (!res.ok) throw new Error(`Battle.net token exchange failed: ${res.status}`);
	const json = (await res.json()) as { access_token?: string };
	if (!json.access_token) throw new Error('Battle.net token response missing access_token');
	return json.access_token;
}

/** The account id (`sub`) and battletag of the logged-in user. */
export async function fetchUserInfo(
	accessToken: string
): Promise<{ sub: string; battletag: string }> {
	const res = await fetch(`${OAUTH_HOST}/userinfo`, {
		headers: { Authorization: `Bearer ${accessToken}` },
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
	});
	if (!res.ok) throw new Error(`Battle.net userinfo failed: ${res.status}`);
	const json = (await res.json()) as { sub?: string; id?: number; battletag?: string };
	const sub = json.sub ?? (json.id != null ? String(json.id) : null);
	if (!sub || !json.battletag) throw new Error('Battle.net userinfo response incomplete');
	return { sub, battletag: json.battletag };
}

interface RawSc2Profile {
	name?: string;
	profileId?: string | number;
	regionId?: string | number;
	realmId?: string | number;
	avatarUrl?: string;
}

export function toToon(regionId: number, realmId: number, profileId: string): string {
	return `${regionId}-S2-${realmId}-${profileId}`;
}

/** The app's own (client-credentials) token, reused until a minute before it expires. */
let app: { token: string; until: number } | null = null;

export async function appToken(fetchFn: typeof fetch = fetch, now = Date.now()): Promise<string> {
	if (app && app.until > now) return app.token;
	const res = await fetchFn(`${OAUTH_HOST}/token`, {
		method: 'POST',
		headers: { Authorization: basicAuth(), 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ grant_type: 'client_credentials' }),
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
	});
	if (!res.ok) throw new Error(`Battle.net app token failed: ${res.status}`);
	const json = (await res.json()) as { access_token?: string; expires_in?: number };
	if (!json.access_token) throw new Error('Battle.net app token response missing access_token');
	app = { token: json.access_token, until: now + ((json.expires_in ?? 3600) - 60) * 1000 };
	return app.token;
}

/** Test hook: forget the cached app token. */
export function forgetAppToken(): void {
	app = null;
}

/**
 * All SC2 profiles linked to the account, merged across regional hosts.
 * Returns null when every host failed (the flaky SC2 API is a known hazard) —
 * distinct from an account that genuinely has no profiles ([]).
 */
export async function fetchSc2Profiles(
	accessToken: string,
	accountId: string,
	fetchFn: typeof fetch = fetch
): Promise<Sc2Profile[] | null> {
	const results = await Promise.allSettled(
		API_HOSTS.map(async (host) => {
			const res = await fetchFn(`${host}/sc2/player/${encodeURIComponent(accountId)}`, {
				headers: { Authorization: `Bearer ${accessToken}` },
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
			});
			if (!res.ok) throw new Error(`${host} responded ${res.status}`);
			return (await res.json()) as RawSc2Profile[];
		})
	);

	const ok = results.filter((r) => r.status === 'fulfilled');
	if (!ok.length) {
		// three accounts were stored with no profiles before this said why
		const why = results.map((r) =>
			r.status === 'rejected' ? String((r.reason as Error)?.message ?? r.reason) : ''
		);
		console.warn(`sc2 profile lookup for ${accountId} failed on every host: ${why.join('; ')}`);
		return null;
	}

	const byToon = new Map<string, Sc2Profile>();
	for (const r of ok) {
		if (!Array.isArray(r.value)) continue;
		for (const raw of r.value) {
			const regionId = Number(raw.regionId);
			const realmId = Number(raw.realmId);
			const profileId = raw.profileId != null ? String(raw.profileId) : '';
			if (!regionId || !realmId || !profileId) continue;
			const toon = toToon(regionId, realmId, profileId);
			if (!byToon.has(toon)) {
				byToon.set(toon, {
					toon,
					name: raw.name ?? '',
					regionId,
					realmId,
					profileId,
					avatarUrl: raw.avatarUrl
				});
			}
		}
	}
	return [...byToon.values()];
}

/**
 * The account's profiles at sign-in: asked with the user's token, and when no
 * host answers that, once more with the app's. Three first sign-ins in October
 * 2026 came back with nothing from every host, while the same accounts
 * answered the app token in two seconds a few days later. Why the first try
 * failed went unlogged, so this does not claim to fix that cause; it is a
 * second, independent try before the user is told the lookup failed.
 */
export async function lookupSc2Profiles(
	userToken: string,
	accountId: string,
	fetchFn: typeof fetch = fetch
): Promise<Sc2Profile[] | null> {
	const mine = await fetchSc2Profiles(userToken, accountId, fetchFn);
	if (mine !== null) return mine;
	try {
		return await fetchSc2Profiles(await appToken(fetchFn), accountId, fetchFn);
	} catch (e) {
		console.warn(`sc2 profile lookup for ${accountId}: app token retry failed:`, e);
		return null;
	}
}
