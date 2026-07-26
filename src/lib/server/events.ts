/**
 * In-process pub/sub for "ready to play" roster changes, feeding the SSE
 * stream at /api/ready/events. The app runs on a single always-on Fly
 * machine, so in-process is sufficient (same assumption as the rate
 * limiters); a shared channel would be needed if the app ever scales out.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeReady(fn: Listener): () => void {
	listeners.add(fn);
	return () => {
		listeners.delete(fn);
	};
}

export function publishReadyChange(): void {
	for (const fn of [...listeners]) {
		try {
			fn();
		} catch {
			// a broken subscriber must not break the others
		}
	}
}

/** Test hook: number of live subscribers. */
export function readyListenerCount(): number {
	return listeners.size;
}
