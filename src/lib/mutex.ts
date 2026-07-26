/**
 * Serialises async work per key, in-process. The app runs on a single
 * always-on machine (same assumption as the rate limiters and the SSE
 * bus), so this is enough to stop two requests racing over the same
 * resource. Dependency-free so plain node:test can load it.
 */

const chains = new Map<string, Promise<unknown>>();

export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
	const previous = chains.get(key) ?? Promise.resolve();
	// run after whatever is queued, whether it settled or threw
	const result = previous.then(fn, fn);
	// keep the chain alive but never let a rejection break the next waiter
	chains.set(
		key,
		result.then(
			() => undefined,
			() => undefined
		)
	);
	return result;
}

/** Test helper: how many keys currently hold a queue. */
export function lockCount(): number {
	return chains.size;
}
