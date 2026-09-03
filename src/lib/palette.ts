/**
 * What this site puts in the command palette.
 *
 * The row model, the ranking and the keyboard rules are `sveltekit-commons/palette`
 * — STALZONE's palette runs on the same ones. What is left here is the part that
 * is about UAR: builders that turn each of its five kinds of thing into a row.
 *
 * The palette answers three different questions with one list: "what is this
 * thing" (an entity, a class, an SI), "where do I go" (a page) and "who is
 * this" (a player). Sections would make the reader choose a list before typing,
 * so everything shares one flat, keyboard-walkable list and the ranking is what
 * puts the likely answer at the top.
 *
 * Every builder takes plain structural objects rather than importing `$lib/mos`
 * or `$lib/units`, so plain node:test loads this without Vite's JSON import
 * chain (see the `$lib/xp.ts` rule in CLAUDE.md).
 */
import type { PaletteRow } from 'sveltekit-commons/palette';
import { playerHref } from './playerTabs.ts';
import { mosTabHref, vehicleSlug } from './mosTabs.ts';

export type PaletteKind = 'page' | 'mos' | 'si' | 'trigger' | 'entity' | 'effect' | 'player';

/**
 * A tie-break, not a filter: two rows that match equally well are ordered by
 * what a reader most likely meant. A page is one keystroke from everything
 * under it, and a class page carries far more than the entity page for the
 * same unit, so both outrank a bare entity. `rankRows` reads this off
 * `row.weight`.
 */
const KIND_WEIGHT: Record<PaletteKind, number> = { page: 0, mos: 1, si: 2, trigger: 2, entity: 3, effect: 3, player: 4 };

/**
 * The entity index shipped at /search.json. Field names are short because
 * there are ~450 of them and every visitor who opens the palette fetches it.
 */
export interface EntityIndexRow {
	/** map-internal id — the /entities/<id> segment */
	i: string;
	/** in-game name; empty for the entities the map never names */
	n: string;
	/** short category, already folded down by `shortCategory` */
	c: string;
	/** icon path, absent when the entity has none */
	p?: string;
}

/**
 * A trigger group in the same index: a mission, a mechanic, an event by the
 * name the extractor gave it, found also by its outcomes and its triggers'
 * names, since "Abdul rescued" or "Activate the MULE" is what a reader may
 * type. Rides along in /search.json, told apart by its `g`.
 */
export interface TriggerIndexRow {
	/** the group's slug — the /triggers/<id> segment */
	g: string;
	n: string;
	/** mission | mechanic | event | world */
	t: string;
	/** how many triggers it is */
	k: number;
	/** other names it answers to: outcomes, its triggers */
	a: string[];
}

/**
 * An effect in the same index — a buff, a debuff, an ailment — by its name,
 * told apart by its `e`. Leads to the effect's own page.
 */
export interface EffectIndexRow {
	/** the behaviour id — the /effects/<id> segment */
	e: string;
	n: string;
	/** ailment | debuff | buff | status */
	k: string;
	p?: string;
}

export type IndexRow = EntityIndexRow | TriggerIndexRow | EffectIndexRow;
export const isTriggerRow = (r: IndexRow): r is TriggerIndexRow => 'g' in r;
export const isEffectRow = (r: IndexRow): r is EffectIndexRow => 'e' in r;

/** Effect rows: the kind is the note, the id an alias (the data's name for it). */
export function effectRows(index: EffectIndexRow[]): PaletteRow[] {
	return index.map((e) => ({
		kind: 'effect',
		id: e.e,
		href: `/effects/${encodeURIComponent(e.e)}`,
		label: e.n,
		note: e.k,
		icon: e.p ?? null,
		alias: [e.e],
		weight: KIND_WEIGHT.effect
	}));
}

/**
 * Trigger group rows. `glyph` is the sidebar's mark for the Triggers section,
 * so the rows carry the same sign as the page they lead to.
 */
export function triggerRows(index: TriggerIndexRow[], glyph?: string): PaletteRow[] {
	return index.map((g) => ({
		kind: 'trigger',
		id: g.g,
		href: `/triggers/${encodeURIComponent(g.g)}`,
		label: g.n,
		note: `${g.t} · ${g.k} trigger${g.k === 1 ? '' : 's'}`,
		icon: null,
		glyph,
		alias: g.a,
		weight: KIND_WEIGHT.trigger
	}));
}

/** `undead / hostile` → `hostile`: what fits the palette's right-hand column. */
export function shortCategory(category: string): string {
	const short: Record<string, string> = {
		'MOS (player class)': 'class',
		'undead / hostile': 'hostile',
		'deployable / drone': 'deployable',
		'item / equipment': 'item',
		'structure / prop': 'prop',
		'other / NPC': 'npc',
		'civilian / NPC': 'civilian'
	};
	return short[category] ?? category.split(' / ')[0];
}

/**
 * Entity rows.
 *
 * The id is always an alias, and the label for the ~60 entities the map leaves
 * unnamed: a search for "SiegeTank" has to find the AMX S-880, because that is
 * the name the map, the replay files and the wiki's own URLs use.
 */
export function entityRows(index: EntityIndexRow[]): PaletteRow[] {
	return index.map((e) => ({
		kind: 'entity',
		id: e.i,
		href: `/entities/${encodeURIComponent(e.i)}`,
		label: e.n || e.i,
		note: e.c,
		icon: e.p ?? null,
		alias: e.n ? [e.i] : [],
		weight: KIND_WEIGHT.entity
	}));
}

/**
 * MOS class rows. `mos` is the in-game code (LK19, SFAAT…) and matches too.
 *
 * A class that brings a vehicle gets a second row for it — the vehicle is a
 * tab of the class's page, not a page of its own, but "Predator" is still a
 * word someone types.
 */
export function mosRows(
	list: {
		id: string;
		name: string;
		mos: string;
		role: string;
		icon: string | null;
		vehicle?: { id: string; name: string; icon: string | null } | null;
	}[]
): PaletteRow[] {
	return list.flatMap((m) => [
		{
			kind: 'mos',
			id: m.id,
			href: mosTabHref(m.id),
			label: m.name,
			note: m.mos || 'class',
			icon: m.icon,
			alias: [m.id, m.mos, m.role].filter(Boolean),
			weight: KIND_WEIGHT.mos
		},
		...(m.vehicle
			? [
					{
						kind: 'mos',
						id: m.vehicle.id,
						href: mosTabHref(m.id, vehicleSlug(m.vehicle.name)),
						label: m.vehicle.name,
						note: `${m.name}'s vehicle`,
						icon: m.vehicle.icon,
						alias: [m.vehicle.id, 'vehicle'],
						weight: KIND_WEIGHT.mos
					}
				]
			: [])
	]);
}

/**
 * Skill Identifier rows.
 *
 * They have no page of their own, so each one deep-links to its card on /si —
 * with thirty of them on one screen, landing at the top of that page would
 * leave the reader to find by eye what they just picked by name.
 */
export function siRows(
	list: { num: number; name: string; code: string; icon: string | null }[]
): PaletteRow[] {
	return list.map((s) => ({
		kind: 'si',
		id: String(s.num),
		href: `/career/si#si-${s.num}`,
		label: s.name,
		note: s.code || 'SI',
		icon: s.icon,
		alias: [s.code, 'skill identifier'],
		weight: KIND_WEIGHT.si
	}));
}

/** Destination rows, from the sidebar's own list plus what it reaches sideways. */
export function pageRows(
	list: { href: string; label: string; alias?: string[]; icon?: string }[]
): PaletteRow[] {
	return list.map((p) => ({
		kind: 'page',
		id: p.href,
		href: p.href,
		label: p.label,
		note: 'page',
		icon: null,
		// the sidebar's own mark, so a page row carries the same glyph as the row
		// it will take you to. SVG source rather than a URL, which is why it
		// cannot ride along on `icon` with the picture-based kinds.
		glyph: p.icon,
		alias: p.alias ?? [],
		weight: KIND_WEIGHT.page
	}));
}

/**
 * Player rows, from /api/search/players.
 *
 * Not passed through `rankRows`: the database already ordered them, by career
 * XP among equal matches, and re-ranking a top-N slice against the static
 * index would only shuffle six rows the server already chose.
 *
 * `tab` is the profile tab the reader is searching *from*, and every row keeps
 * it: comparing two players' collections means the palette should land on the
 * next player's Collection, not send you back to their overview to click
 * through again. Empty — anywhere else on the site — carries nothing. Unlike
 * STALZONE's entities, which offer different tabs depending on what an item
 * can do, every player has all four, so there is no tab here that the next
 * profile might not have.
 */
export function playerRows(
	list: { toon: string; name: string; clan?: string; avatarUrl?: string | null }[],
	tab = ''
): PaletteRow[] {
	return list.map((p) => ({
		kind: 'player',
		id: p.toon,
		href: playerHref(p.toon, tab),
		label: p.name || p.toon,
		note: p.clan ? `<${p.clan}>` : 'player',
		icon: p.avatarUrl ?? null,
		// a person, not a thing — and the mark stands in when there is no portrait
		round: true,
		glyph: '·',
		weight: KIND_WEIGHT.player
	}));
}

/**
 * The rows a query offers as a way out of the palette: whatever it had no room
 * for. Both list pages read `?q=`, so the term already typed carries over.
 */
export function browseRows(query: string): PaletteRow[] {
	const term = query.trim();
	if (!term) return [];
	return [
		{
			kind: 'page',
			id: 'browse:entities',
			href: `/entities?q=${encodeURIComponent(term)}`,
			label: `All entities matching “${term}”`,
			note: 'browse',
			muted: true
		},
		{
			kind: 'page',
			id: 'browse:players',
			href: `/players?q=${encodeURIComponent(term)}`,
			label: `All players matching “${term}”`,
			note: 'browse',
			muted: true
		}
	];
}
