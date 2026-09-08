/**
 * The two tables at /mos.
 *
 * The same roster, two different questions: how a class handles once it is
 * yours, and what it costs to have it at all. They share a page because the
 * reader comparing classes is asking both, and neither table is long enough
 * to be a section of its own.
 *
 * Real sub-routes rather than a `?view=`: this site prerenders, and SvelteKit
 * refuses `url.searchParams` on a prerendered page — the whole point being
 * that one built page cannot depend on the query. Sub-routes also index, work
 * with JavaScript off, and are what every other tab bar here uses. The bare
 * /mos keeps the handling table, so the address the sidebar and the sitemap
 * already know still lands where it did.
 *
 * /mos/unlocks does sit in the shape that otherwise means one class
 * (mosHref builds /mos/<id>), and it wins because SvelteKit matches static
 * segments before dynamic ones. Nothing generates a class id that could
 * collide, but the crumb in +layout.svelte has to be told, and is.
 *
 * Dependency-free so nav.ts can name the views without pulling the class data
 * in behind them (pattern: $lib/careerTabs.ts).
 */

/** Feather-style strokes, the same visual language as the sidebar (see nav.ts). */
const icon = (paths: string) =>
	`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export interface MosView {
	/** Path segment under /mos. The handling table's is empty: it owns /mos itself. */
	key: string;
	label: string;
	icon: string;
	/** Words the palette should match that the label does not carry. Never shown. */
	alias: string[];
}

export const MOS_VIEWS: readonly MosView[] = [
	{
		key: '',
		label: 'Handling',
		alias: ['weapons', 'magazine', 'reload', 'jam', 'compare classes'],
		icon: icon(
			'<circle cx="12" cy="12" r="9"/><line x1="21" y1="12" x2="17" y2="12"/><line x1="7" y1="12" x2="3" y2="12"/><line x1="12" y1="7" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="17"/>'
		)
	},
	{
		key: 'unlocks',
		label: 'Unlock requirements',
		alias: ['unlock', 'requirements', 'how to unlock', 'rank needed', 'xp needed', 'gate'],
		icon: icon('<rect x="3" y="11" width="18" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0"/>')
	}
];

/** Where a view lives. */
export function mosViewHref(key = ''): string {
	return key ? `/mos/${key}` : '/mos';
}

/** True for the roster's own pages, which are not class pages despite the shape. */
export function isMosViewPath(pathname: string): boolean {
	return MOS_VIEWS.some((v) => mosViewHref(v.key) === pathname);
}
