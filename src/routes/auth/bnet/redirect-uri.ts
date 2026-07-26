/**
 * The OAuth redirect URI must byte-match one registered on develop.battle.net.
 * In production ORIGIN (fly.toml) makes url.origin the public domain; local
 * dev works if http://localhost:5173/auth/bnet/callback is also registered.
 * BNET_REDIRECT_URI overrides both when the derived value can't match.
 */
export function redirectUri(url: URL): string {
	return process.env.BNET_REDIRECT_URI || `${url.origin}/auth/bnet/callback`;
}
