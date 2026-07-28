/**
 * The read cache's freshness decision. Dependency-free so plain node:test can
 * load it (see CLAUDE.md) — and it is here as its own function because when it
 * lived inline it was possible to break it by changing a constant somewhere
 * else in the file, with nothing to notice.
 */

export type CacheState =
	/** young enough to serve as-is */
	| 'fresh'
	/** past its life, but worth serving while a refresh runs behind it */
	| 'stale'
	/** too old to hand out; the caller must wait for a fresh read */
	| 'expired';

/**
 * `staleWindow` is measured **from the end of the TTL**, not from when the
 * value was stored. That distinction is the whole point: as an absolute age it
 * silently stops working the moment a TTL is raised past it, and every expiry
 * goes back to blocking a visitor on the full read.
 */
export function cacheState(age: number, ttl: number, staleWindow: number): CacheState {
	if (age < ttl) return 'fresh';
	if (age < ttl + staleWindow) return 'stale';
	return 'expired';
}

/**
 * Does a cache key fall under one of these prefixes?
 *
 * A prefix matches the key exactly, or the key up to a `:` separator — never a
 * bare string prefix. `player` must not reach `players:count`, or scoping an
 * invalidation to one thing would quietly throw away another; the separator is
 * what keeps sibling namespaces apart.
 */
export function cacheKeyMatches(key: string, prefixes: string[]): boolean {
	return prefixes.some((p) => key === p || key.startsWith(`${p}:`));
}
