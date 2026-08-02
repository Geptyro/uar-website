/**
 * The tabs of a player profile.
 *
 * A profile answers three unrelated questions — how far someone has got, what
 * they have collected, and what they have been doing — and it was answering
 * all of them down one column, in a single 1200-line page. Splitting them is
 * not only about length: each tab's loader ships its own slice, so a visitor
 * who came for the ranks stops downloading a page of replay history and five
 * unlock grids they never scrolled to. That matters more here than it looks,
 * because the database behind this page is throttled on bytes returned, and
 * the only lever against that is returning fewer (see $lib/server/db.ts).
 *
 * Unlike STALZONE's entity page — where the tabs are derived from what an item
 * can do, because items differ wildly in what they have to say — every player
 * has ranks, a collection to be short of, and games behind them. So there is no
 * capability table here, just the list and the two helpers that keep the bar
 * and the routes agreeing with each other.
 *
 * Dependency-free so node:test can load it directly (pattern: $lib/xp.ts).
 */

/** Feather-style strokes, the same visual language as the sidebar (see nav.ts). */
const icon = (paths: string) =>
	`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export interface PlayerTab {
	/** Path segment under /players/[toon]; the overview's is empty. */
	segment: string;
	label: string;
	icon: string;
}

export const PLAYER_TABS: readonly PlayerTab[] = [
	{
		segment: '',
		label: 'Overview',
		icon: icon(
			'<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'
		)
	},
	{
		segment: 'activity',
		label: 'Activity',
		icon: icon('<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>')
	},
	{
		segment: 'collection',
		label: 'Collection',
		icon: icon(
			'<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>'
		)
	},
	{
		segment: 'replays',
		label: 'Replays',
		icon: icon(
			'<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>'
		)
	}
];

/**
 * A profile URL. The toon is a Battle.net handle (`2-S2-1-1809580`), which is
 * URL-safe, but it arrives from stored data rather than from a literal, so it
 * is encoded here once instead of at every call site — the same rule the clan
 * tags already follow, one of which is non-ASCII.
 */
export function playerHref(toon: string, segment = ''): string {
	const base = `/players/${encodeURIComponent(toon)}`;
	return segment ? `${base}/${segment}` : base;
}

/**
 * Which tab a route id is, or null if it is not under a profile at all.
 *
 * Reads the route rather than the URL: a toon handle cannot be mistaken for a
 * segment that way, and it is a fact SvelteKit already knows.
 */
export function tabSegment(routeId: string | null): string | null {
	if (!routeId) return null;
	const m = /^\/players\/\[toon\](?:\/([^/]+))?$/.exec(routeId);
	if (!m) return null;
	return m[1] ?? '';
}
