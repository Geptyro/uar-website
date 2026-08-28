/**
 * The tabs of a trigger group's page.
 *
 * The same frame a class page and a player profile have (see $lib/mosTabs.ts
 * and $lib/playerTabs.ts): each tab is a route of its own, so it prerenders,
 * middle-clicks and shares as a URL. The overview is the map, the units in
 * play and the triggers one by one; the flow is the chain chart on a canvas
 * of its own, where a long chapter chain has the room it needs.
 *
 * Dependency-free so node:test can load it directly (pattern: $lib/xp.ts).
 */

/** Feather-style strokes, the same visual language as the sidebar (see nav.ts). */
const icon = (paths: string) =>
	`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export interface TriggerTab {
	/** Path segment under /triggers/[id]; the overview's is empty. */
	segment: string;
	label: string;
	icon: string;
}

export const TRIGGER_TABS: readonly TriggerTab[] = [
	{
		segment: '',
		label: 'Overview',
		icon: icon(
			'<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>'
		)
	},
	{
		segment: 'flow',
		label: 'Flow',
		icon: icon(
			'<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>'
		)
	}
];

/** The route the group page and its tabs live under. */
export const TRIGGER_ROUTE = '/triggers/[id]';

/** A group-page URL: the group's slug is URL-safe by construction, encoded anyway. */
export function triggerHref(id: string, segment = ''): string {
	const base = `/triggers/${encodeURIComponent(id)}`;
	return segment ? `${base}/${segment}` : base;
}

/**
 * Which tab a route id is, or null if it is not under a group page at all.
 * Reads the route rather than the URL: it is already canonical.
 */
export function tabSegment(routeId: string | null | undefined): string | null {
	if (!routeId?.startsWith(TRIGGER_ROUTE)) return null;
	const rest = routeId.slice(TRIGGER_ROUTE.length);
	if (rest === '') return '';
	if (!rest.startsWith('/')) return null;
	const seg = rest.slice(1).split('/')[0];
	return TRIGGER_TABS.some((t) => t.segment === seg) ? seg : null;
}
