/**
 * Sign-in that comes back. The Battle.net round trip used to land every
 * reader on /account, so "sign in to vote" cost them the guide they were
 * reading. `signInHref(path)` asks /auth/bnet to return to `path` once the
 * account is linked; `safeNext` is the gate on both ends of the trip: a path
 * on this site or nothing, never another host.
 *
 * Dependency-free so node:test can load it.
 */

/** `raw` if it is a path on this site worth returning to, else null. */
export function safeNext(raw: string | null | undefined): string | null {
	if (!raw || raw.length > 512) return null;
	if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null;
	if (/[\u0000-\u001f\u007f]/.test(raw)) return null;
	// the sign-in routes themselves would loop
	if (raw === '/auth' || raw.startsWith('/auth/') || raw.startsWith('/auth?')) return null;
	// what a browser makes of it, in case it reads the path as a host anyway
	try {
		const base = 'http://uar.invalid';
		const u = new URL(raw, base);
		if (u.origin !== base) return null;
	} catch {
		return null;
	}
	return raw;
}

/** Where a "sign in" link goes so the reader lands back on `path` after. */
export function signInHref(path: string): string {
	const next = safeNext(path);
	return next ? `/auth/bnet?next=${encodeURIComponent(next)}` : '/auth/bnet';
}
