/**
 * The tabs of the career section.
 *
 * Ranks, Skill Identifiers, medals and decals, camouflages: four reference
 * lists that used to be four sidebar links, and are really four views of one
 * thing — what an account earns as it plays. Ranks are the spine (they gate
 * the SIs and the classes), the achievements hang off them, the cosmetics off
 * the achievements. So they share a frame, the same one a class or a profile
 * has, and the sidebar spends one line on them instead of four.
 *
 * There is no overview tab: unlike a class or a profile there is nothing to
 * summarise, and a fifth tab that only said "pick one" would be filler. Ranks
 * take the base URL instead, the way the overview does elsewhere.
 *
 * Every visitor sees every tab, so like $lib/playerTabs.ts this is just the
 * list and the two helpers that keep the bar and the routes agreeing.
 *
 * Dependency-free so node:test can load it directly (pattern: $lib/xp.ts).
 */

/** Feather-style strokes, the same visual language as the sidebar (see nav.ts). */
const icon = (paths: string) =>
	`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export interface CareerTab {
	/** Path segment under /career; the ranks tab's is empty. */
	segment: string;
	label: string;
	icon: string;
	/**
	 * Words the palette should match that the label does not carry — the
	 * in-game term, a synonym, what a newcomer would type. Never shown.
	 */
	alias: string[];
}

export const CAREER_TABS: readonly CareerTab[] = [
	{
		segment: '',
		label: 'Ranks',
		alias: ['rank tracks', 'rank sets', 'enlisted', 'warrant officer', 'commissioned', 'xp'],
		icon: icon('<polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/>')
	},
	{
		segment: 'si',
		label: 'Skill IDs',
		alias: ['skill identifiers', 'si', 'perks', 'bonuses'],
		icon: icon(
			'<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>'
		)
	},
	{
		segment: 'medals',
		label: 'Medals & decals',
		alias: ['awards', 'achievements', 'insignia'],
		icon: icon(
			'<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>'
		)
	},
	{
		segment: 'camos',
		label: 'Camouflages',
		alias: ['skins', 'camo', 'armour', 'armor'],
		icon: icon('<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>')
	}
];

/** A career URL: /career for the ranks, /career/<segment> for the rest. */
export function careerHref(segment = ''): string {
	return segment ? `/career/${segment}` : '/career';
}

/**
 * Which tab a route id is, or null if it is not under /career at all.
 *
 * Reads the route rather than the URL, the way the other frames do — it is a
 * fact SvelteKit already knows, and it cannot be confused by a hash or a query.
 */
export function tabSegment(routeId: string | null): string | null {
	if (!routeId) return null;
	const m = /^\/career(?:\/([^/]+))?$/.exec(routeId);
	if (!m) return null;
	return m[1] ?? '';
}
