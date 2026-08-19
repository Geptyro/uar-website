/**
 * The tabs of a class page.
 *
 * A class page used to be one column that answered everything at once — what
 * the class does, what it can carry, who plays it — and it had grown to the
 * length of a player profile before that one was split. This is the same
 * split, for the same reasons (see $lib/playerTabs.ts): each tab is a route of
 * its own, so it prerenders, middle-clicks and shares as a URL, and the
 * canonical page stops carrying four item tables a reader looking for a skill
 * tree scrolls straight past.
 *
 * Unlike a profile, not every class has every tab. A guide is written by hand
 * and only exists once someone has written it, and only one class brings a
 * vehicle along. So the list is a capability table, the way STALZONE's entity
 * page decides its tabs: `needs` names what a class must have for the tab to
 * appear, and the layout and the routes both read the same table, so a tab
 * the bar cannot offer is a URL the loader turns away.
 *
 * Dependency-free so node:test can load it directly (pattern: $lib/xp.ts).
 */

/** Feather-style strokes, the same visual language as the sidebar (see nav.ts). */
const icon = (paths: string) =>
	`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

/**
 * The route parameter the vehicle tab lives under. Its URL segment is the
 * vehicle's own name (`vehicleSlug`), which the table cannot know, so the
 * table carries the parameter and `tabsFor` fills it in.
 */
export const VEHICLE_SLOT = '[vehicle]';

/**
 * The URL segment a vehicle gets: its name, lower-cased and hyphenated —
 * "Predator" is /predator. Same rule at both ends: `tabsFor` builds the link
 * with it and the route's loader checks the segment it was given against it.
 */
export function vehicleSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

/** What a class has, as far as the tab bar is concerned. */
export interface MosCapabilities {
	/** Someone has written a guide for it — see $lib/guides. */
	guide: boolean;
	/** It brings a vehicle it pilots (the Assault Engineer's Predator). */
	vehicle: boolean;
}

export interface MosTab {
	/** Path segment under /mos/[id]; the overview's is empty. */
	segment: string;
	label: string;
	icon: string;
	/** Capabilities that put this tab on the page; any one of them is enough. */
	needs: (keyof MosCapabilities)[];
}

export const MOS_TABS: readonly MosTab[] = [
	{
		segment: '',
		label: 'Overview',
		icon: icon(
			'<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'
		),
		needs: []
	},
	/* Every class can carry something, so this one is always there: even a
	   vehicle that arms itself through its panel has armor and consumables it
	   can pick up. */
	{
		segment: 'gear',
		label: 'Gear',
		icon: icon(
			'<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>'
		),
		needs: []
	},
	/* Named, pictured and addressed as the vehicle itself at render time —
	   "Predator", its portrait and /predator, not "Vehicle" and a truck — see
	   `tabsFor` and `vehicleSlug`. The route behind it is `[vehicle]`, so a
	   second piloted vehicle would get its own name the same way; this entry
	   is the placeholder the loaders and the bar resolve against. */
	{
		segment: VEHICLE_SLOT,
		label: 'Vehicle',
		icon: icon(
			'<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>'
		),
		needs: ['vehicle']
	},
	/* Always there: every class has been played by someone, and a class no
	   recording has seen yet says so on the tab rather than hiding it. */
	{
		segment: 'players',
		label: 'Players',
		icon: icon(
			'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
		),
		needs: []
	},
	{
		segment: 'guide',
		label: 'Guide',
		icon: icon(
			'<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'
		),
		needs: ['guide']
	}
];

/** Whether this class's capabilities put that tab on the page. */
const offers = (c: MosCapabilities, t: MosTab): boolean =>
	t.needs.length === 0 || t.needs.some((k) => c[k]);

/**
 * A picture as a tab icon: the vehicle's own portrait in place of a glyph.
 * Wrapped in an SVG rather than handed over as an <img>, because the bar
 * sizes its icons by selecting `svg` — an image element would come through
 * at its natural size on the wide layout and again on the narrow one.
 *
 * Sized inline, and larger than the glyphs: a 15px line drawing reads, a
 * 15px photograph does not. 24px sits inside the bar's 36px with room, and
 * the inline size holds on the narrow layout too, where the glyphs go to 18.
 */
const pictureIcon = (src: string) =>
	`<svg viewBox="0 0 24 24" aria-hidden="true" style="width:24px;height:24px"><clipPath id="tab-picture-clip"><rect width="24" height="24" rx="5"/></clipPath><image href="${src}" width="24" height="24" preserveAspectRatio="xMidYMid slice" clip-path="url(#tab-picture-clip)"/></svg>`;

/**
 * The tabs this class actually has, in order. `vehicle` names, pictures and
 * addresses the vehicle tab when the class has one — the tab is the Predator,
 * and should say so, look it and be found at /predator.
 */
export function tabsFor(
	c: MosCapabilities,
	vehicle?: { name: string; icon?: string | null } | null
): MosTab[] {
	return MOS_TABS.filter((t) => offers(c, t)).map((t) =>
		t.segment === VEHICLE_SLOT && vehicle
			? {
					...t,
					segment: vehicleSlug(vehicle.name),
					label: vehicle.name,
					icon: vehicle.icon ? pictureIcon(vehicle.icon) : t.icon
				}
			: t
	);
}

/**
 * Does this class have that tab? `''` — the overview — is always yes, and an
 * unknown segment is always no. Same table as `tabsFor`, so the bar and the
 * loaders cannot drift into a link that 404s or a URL with no way back.
 */
export function hasTab(c: MosCapabilities, segment: string): boolean {
	const tab = MOS_TABS.find((t) => t.segment === segment);
	return tab != null && offers(c, tab);
}

/** The route the class page and all its tabs live under. */
export const MOS_ROUTE = '/mos/[id]';

/**
 * A class-page URL. Ids are map-internal identifiers (`CombatEngineer`) and
 * URL-safe, but they arrive from data rather than from a literal, so they are
 * encoded here once instead of at every call site.
 */
export function mosTabHref(id: string, segment = ''): string {
	const base = `/mos/${encodeURIComponent(id)}`;
	return segment ? `${base}/${segment}` : base;
}

/**
 * Which tab a route id is, or null if it is not under a class page at all.
 * Reads the route rather than the URL: it is already canonical and unencoded,
 * so there is nothing to normalise before comparing. The vehicle tab is the
 * one whose segment is a parameter, so its value comes from `params`.
 */
export function tabSegment(
	routeId: string | null | undefined,
	params?: { vehicle?: string }
): string | null {
	if (!routeId?.startsWith(MOS_ROUTE)) return null;
	const rest = routeId.slice(MOS_ROUTE.length);
	if (rest === '') return '';
	if (!rest.startsWith('/')) return null;
	const seg = rest.slice(1);
	return seg === VEHICLE_SLOT ? (params?.vehicle ?? seg) : seg;
}
