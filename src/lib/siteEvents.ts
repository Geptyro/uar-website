/**
 * One connection to the site's event stream per tab, shared by whoever
 * listens (the ready chip, the chat's unread dot): opened when the first
 * listener arrives, closed when the last leaves. A browser allows only a
 * handful of open streams per origin, so nobody opens their own.
 */
type Fn = (data: unknown) => void;

let source: EventSource | null = null;
const listeners = new Map<string, Set<Fn>>();

function attach(name: string) {
	source?.addEventListener(name, (e) => {
		let data: unknown = null;
		try {
			data = (e as MessageEvent).data ? JSON.parse((e as MessageEvent).data) : null;
		} catch {
			data = null;
		}
		for (const fn of listeners.get(name) ?? []) fn(data);
	});
}

/** Hear `name` events from /api/ready/events; the return stops listening. */
export function onSiteEvent(name: string, fn: Fn): () => void {
	if (typeof window === 'undefined') return () => {};
	let set = listeners.get(name);
	if (!set) {
		set = new Set();
		listeners.set(name, set);
		if (source) attach(name);
	}
	set.add(fn);
	if (!source) {
		source = new EventSource('/api/ready/events');
		for (const n of listeners.keys()) attach(n);
	}
	return () => {
		set?.delete(fn);
		if (set?.size === 0) listeners.delete(name);
		if (!listeners.size && source) {
			source.close();
			source = null;
		}
	};
}
