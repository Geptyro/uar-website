// Swap a portrait that fails to load for the anonymous placeholder.
// Kept free of imports so plain `node --test` can load it — the caller passes
// the fallback URL, which is a Vite asset import at every call site.
//
// The portrait URL is in the SSR HTML, so the browser starts fetching it long
// before hydration and the `error` event usually fires before any listener is
// attached. Svelte 5 does cover that on its own — it stamps SSR'd images with
// `onerror="this.__e=event"` and replays the event at hydration — so the
// mount-time `complete && naturalWidth === 0` check here is a second line of
// defence rather than the only one: it asks the element directly whether it
// failed, without depending on that replay firing. Keep both; the check is
// also what catches an image that failed with no replay to hand.
//
// Portrait URLs come from Blizzard's SC2 API verbatim (see server/bnet.ts) and
// are not verified when stored. They point at tiles in a shared sprite sheet on
// static.starcraft2.com; Blizzard hands out coordinates for sheets it never
// published there (everything past row 15 currently 403s), so a linked account
// can have a portrait that has never existed. Re-fetching does not help — the
// API returns the same dead URL — so the fallback is the fix.

/** True when `img` has finished loading and has no pixels, i.e. it failed. */
export function hasFailed(img: {
	complete: boolean;
	naturalWidth: number;
	src?: string;
	getAttribute?: (name: string) => string | null;
}): boolean {
	// A never-set src reports complete with zero width in some browsers; that
	// is an empty slot, not a failure, and swapping it in would be wrong.
	const src = img.getAttribute ? img.getAttribute('src') : img.src;
	if (!src) return false;
	return img.complete && img.naturalWidth === 0;
}

/**
 * Svelte action: `<img src={p.avatarUrl ?? anon} use:portraitFallback={anon} />`
 *
 * Leaves a working portrait alone, and is a no-op once the fallback itself is
 * showing, so a missing placeholder cannot loop.
 */
export function portraitFallback(node: HTMLImageElement, fallback: string) {
	let current = fallback;

	const swap = () => {
		// Compare attributes, not the resolved `.src` property, which the browser
		// expands to an absolute URL and would never equal a relative fallback.
		if (node.getAttribute('src') === current) return;
		node.src = current;
	};

	const onError = () => swap();
	node.addEventListener('error', onError);
	if (hasFailed(node)) swap();

	return {
		update(next: string) {
			current = next;
			if (hasFailed(node)) swap();
		},
		destroy() {
			node.removeEventListener('error', onError);
		}
	};
}
