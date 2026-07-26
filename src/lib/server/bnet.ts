/**
 * Battle.net OAuth 2.0 + StarCraft II community API client.
 *
 * Authorization-code login flow:
 *   /auth/bnet          -> authorizeUrl() redirect (scope "openid sc2.profile")
 *   /auth/bnet/callback -> exchangeCode() + fetchUserInfo() + fetchSc2Profiles()
 *
 * The SC2 player endpoint only works with the *user's* access token — Blizzard
 * offers no public battletag -> profile lookup — so a linked toon is proof the
 * visitor owns the Battle.net account behind it.
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

/** Exchange the callback's authorization code for a user access token. */
export async function exchangeCode(code: string, redirectUri: string): Promise<string> {
	const res = await fetch(`${OAUTH_HOST}/token`, {
		method: 'POST',
		headers: {
			Authorization: `Basic ${Buffer.from(`${clientId()}:${clientSecret()}`).toString('base64')}`,
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

/**
 * All SC2 profiles linked to the account, merged across regional hosts.
 * Returns null when every host failed (the flaky SC2 API is a known hazard) —
 * distinct from an account that genuinely has no profiles ([]).
 */
export async function fetchSc2Profiles(
	accessToken: string,
	accountId: string
): Promise<Sc2Profile[] | null> {
	const results = await Promise.allSettled(
		API_HOSTS.map(async (host) => {
			const res = await fetch(`${host}/sc2/player/${encodeURIComponent(accountId)}`, {
				headers: { Authorization: `Bearer ${accessToken}` },
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
			});
			if (!res.ok) throw new Error(`${host} responded ${res.status}`);
			return (await res.json()) as RawSc2Profile[];
		})
	);

	const ok = results.filter((r) => r.status === 'fulfilled');
	if (!ok.length) return null;

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
