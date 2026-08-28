/**
 * The tabs of an entity page: the sheet the site extracts, and what players
 * say about the thing. The same frame a class page and a profile have (see
 * $lib/mosTabs.ts, $lib/playerTabs.ts), cut down to a table with no
 * capabilities: every entity has both.
 *
 * Dependency-free so node:test can load it directly.
 */

/** Feather-style strokes, the same visual language as the sidebar (see nav.ts). */
const icon = (paths: string) =>
	`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export interface EntityTab {
	/** Path segment under /entities/[id]; the overview's is empty. */
	segment: string;
	label: string;
	icon: string;
}

export const ENTITY_TABS: readonly EntityTab[] = [
	{
		segment: '',
		label: 'Overview',
		icon: icon(
			'<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'
		)
	},
	{
		segment: 'comments',
		label: 'Comments',
		icon: icon('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>')
	}
];

/** An entity's URL, or one of its tabs. Ids are map symbols; encoded once here. */
export function entityHref(id: string, segment = ''): string {
	const base = `/entities/${encodeURIComponent(id)}`;
	return segment ? `${base}/${segment}` : base;
}

/** Which tab a route id is, or null if it is not under an entity at all. */
export function entityTabSegment(routeId: string | null | undefined): string | null {
	if (!routeId) return null;
	const m = /^\/entities\/\[id\](?:\/([^/]+))?$/.exec(routeId);
	if (!m) return null;
	return m[1] ?? '';
}
