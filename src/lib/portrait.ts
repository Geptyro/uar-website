// Portrait fallback lives in uar-shared: the companion renders the same chips
// from the same components, and the ready rows / presence groups on this site
// are those components (cf. $lib/presence.ts, which re-exports for the same
// reason). Re-exported under $lib so the call sites here read like the rest of
// the codebase.
//
// Why it exists: Blizzard hands out portrait urls for sprite sheets it never
// published, so a linked account can carry a portrait that has never existed
// and no refresh will fix it. See uar-shared/src/portrait.js. The server also
// drops those urls where the account is stored (see server/portraits.ts);
// what is here is the second line, for a url that got through, or died since.
import { hasFailed, portraitFallback } from 'uar-shared/portrait';

export { hasFailed, portraitFallback };

/**
 * The stock portrait, as a url: what stands for a player who never linked an
 * account, and what a dead portrait is swapped for. A file under static/
 * rather than an asset import so that code with no bundler behind it (the
 * markdown resolver on the server, the player cards, the tests) can name it,
 * and so a page with fifty chips carries fifty short paths, not fifty copies
 * of the picture. The companion has its own copy, in uar-shared.
 */
export const ANON_PORTRAIT = '/anon-portrait.svg';

/**
 * The portraits a box may hold that are not Svelte's to attach an action to:
 * the chip the markdown renderer wrote for a player, a hover card's "plays
 * with" row (server-built html), and anything marked `img.portrait`.
 */
export const PORTRAIT_IMG = '.ref-player img, .ref-entry-player img, .pc-entry.round img, img.portrait';

/**
 * Svelte action, the delegated twin of `portraitFallback`: every portrait
 * under `node` that fails to load, now or later, is swapped for `fallback`.
 * `use:portraitsIn={anonPortrait}` on the wrapper of html the renderer
 * emitted, on a hover card, or on a contenteditable that builds its own chips.
 *
 * `error` does not bubble, so the listener rides the capture phase. The
 * pictures already there at mount are asked directly: one served with the
 * page may have failed before any listener existed, and Svelte's replay of
 * SSR'd `error` events covers only the images it rendered itself.
 */
export function portraitsIn(node: HTMLElement, fallback: string) {
	let current = fallback;
	const swap = (img: HTMLImageElement) => {
		// the attribute, not the resolved property: a relative fallback never equals an absolute src
		if (img.getAttribute('src') !== current) img.src = current;
	};
	const onError = (e: Event) => {
		const img = e.target;
		if (img instanceof HTMLImageElement && img.matches(PORTRAIT_IMG)) swap(img);
	};
	const sweep = () => {
		for (const img of node.querySelectorAll<HTMLImageElement>(PORTRAIT_IMG)) if (hasFailed(img)) swap(img);
	};
	node.addEventListener('error', onError, true);
	sweep();
	return {
		update(next: string) {
			current = next;
			sweep();
		},
		destroy() {
			node.removeEventListener('error', onError, true);
		}
	};
}
