/**
 * The class guides — the one part of a class page that is written rather than
 * extracted.
 *
 * Everything else on a class page is read from the map's data files, and says
 * so. A guide is a person's account of how the class is played: which of its
 * jobs matter, in what order, and where on the map they happen. That cannot be
 * extracted, so each one is a Svelte component authored by hand, and the tab
 * only exists for the classes that have one (see $lib/mosTabs.ts).
 *
 * What a guide *draws* still comes from the data — the minimap, the regions,
 * the pre-placed items, the panel costs — so a re-extraction that moves a cave
 * moves the marker. Only the prose is authored.
 *
 * Loaded lazily: a guide is a page of its own with a map in it, and nothing on
 * the overview should pay for it. `+page.ts` awaits the thunk and hands the
 * component to the page (a universal load may return one).
 */
import type { Component } from 'svelte';

export interface GuideEntry {
	/** One sentence, for the page's description and the tab's tooltip. */
	summary: string;
	/** ISO date the text was last checked against the map. */
	checked: string;
	load: () => Promise<{ default: Component }>;
}

export const guides: Record<string, GuideEntry> = {
	CombatEngineer: {
		summary:
			'Where the scraps are, what the City Guard buys with them, which caves to seal and what that stops — the Combat Engineer’s game on one map.',
		checked: '2026-08-19',
		load: () => import('./CombatEngineer.svelte')
	},
	AssaultEngineer: {
		summary:
			'Get in the Predator, feed it Engineering, Craft for the team, keep every machine running — the Assault Engineer’s game, with its mech’s abilities and what Craft does to each thing it touches.',
		checked: '2026-08-19',
		load: () => import('./AssaultEngineer.svelte')
	}
};

export function hasGuide(id: string): boolean {
	return Object.hasOwn(guides, id);
}

/** Every class that has a guide, for the prerenderer's entry list. */
export const guideIds: string[] = Object.keys(guides);
