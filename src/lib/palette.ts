/**
 * The command palette's row model and ranking.
 *
 * The palette answers three different questions with one list: "what is this
 * thing" (an entity, a class, an SI), "where do I go" (a page) and "who is
 * this" (a player). Sections would make the reader choose a list before
 * typing, so everything shares one flat, keyboard-walkable list and the
 * ranking is what puts the likely answer at the top.
 *
 * Pure and dependency-free apart from the shared fold — every builder takes
 * plain structural objects rather than importing `$lib/mos` or `$lib/units`,
 * so plain node:test loads this without Vite's JSON import chain (see the
 * `$lib/xp.ts` rule in CLAUDE.md).
 */
import { foldForSearch } from 'sveltekit-commons/text';

export type PaletteKind = 'page' | 'mos' | 'si' | 'entity' | 'player';

/** One row of the palette, whatever it is a row *of*. */
export interface PaletteRow {
	kind: PaletteKind;
	/** Unique within a kind; `kind + id` keys the list. */
	id: string;
	href: string;
	label: string;
	/** Short mono note on the right — a category, a class code, a clan tag. */
	note?: string;
	icon?: string | null;
	/** Words that should match without being shown, e.g. a map-internal id. */
	alias?: string[];
}

/**
 * A tie-break, not a filter: two rows that match equally well are ordered by
 * what a reader most likely meant. A page is one keystroke from everything
 * under it, and a class page carries far more than the entity page for the
 * same unit, so both outrank a bare entity.
 */
const KIND_WEIGHT: Record<PaletteKind, number> = { page: 0, mos: 1, si: 2, entity: 3, player: 4 };

/**
 * Where a match landed, best first:
 *   0 the label starts with it        "sni" → Sniper
 *   1 a word of the label starts      "sni" → Undead Sniper
 *   2 anywhere in the label           "nip" → Sniper
 *   3 an alias starts with it         "siege" → AMX S-880 (id SiegeTank)
 *   4 anywhere in an alias
 * A match in the middle of a word is kept but ranked last: it is the one that
 * turns up by accident, and dropping it would lose partial ids.
 */
function score(row: PaletteRow, needle: string): number {
	const label = foldForSearch(row.label);
	if (label.startsWith(needle)) return 0;
	if (wordStart(label, needle)) return 1;
	if (label.includes(needle)) return 2;
	let best = -1;
	for (const a of row.alias ?? []) {
		const folded = foldForSearch(a);
		if (folded.startsWith(needle)) return 3;
		if (folded.includes(needle)) best = 4;
	}
	return best;
}

/** Does `needle` start a word of `hay`? Both are already folded. */
function wordStart(hay: string, needle: string): boolean {
	let from = 0;
	for (;;) {
		const at = hay.indexOf(needle, from);
		if (at < 0) return false;
		if (at > 0 && !/[a-z0-9]/.test(hay[at - 1])) return true;
		from = at + 1;
	}
}

/**
 * Rows matching `query`, best first.
 *
 * `limit` is small on purpose: this is a keyboard target, not a results page —
 * /entities and /players exist for browsing, and the palette offers them both
 * as rows of its own.
 */
export function rankRows(rows: PaletteRow[], query: string, limit = 8): PaletteRow[] {
	const needle = foldForSearch(query.trim());
	if (!needle) return [];

	const scored: { row: PaletteRow; score: number }[] = [];
	for (const row of rows) {
		const s = score(row, needle);
		if (s >= 0) scored.push({ row, score: s });
	}

	// among equals the shorter name wins: someone typing "sniper" means Sniper,
	// not "Sniper Rifle Ammo Crate"
	scored.sort(
		(a, b) =>
			a.score - b.score ||
			KIND_WEIGHT[a.row.kind] - KIND_WEIGHT[b.row.kind] ||
			a.row.label.length - b.row.label.length ||
			a.row.label.localeCompare(b.row.label)
	);
	return scored.slice(0, limit).map(({ row }) => row);
}

/** Wrap around at both ends, so ↑ from the top row lands on the last one. */
export function step(index: number, delta: number, length: number): number {
	if (length === 0) return 0;
	return (index + delta + length) % length;
}

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
		kind: 'entity' as const,
		id: e.i,
		href: `/entities/${encodeURIComponent(e.i)}`,
		label: e.n || e.i,
		note: e.c,
		icon: e.p ?? null,
		alias: e.n ? [e.i] : []
	}));
}

/** MOS class rows. `mos` is the in-game code (LK19, SFAAT…) and matches too. */
export function mosRows(
	list: { id: string; name: string; mos: string; role: string; icon: string | null }[]
): PaletteRow[] {
	return list.map((m) => ({
		kind: 'mos' as const,
		id: m.id,
		href: `/mos/${encodeURIComponent(m.id)}`,
		label: m.name,
		note: m.mos || 'class',
		icon: m.icon,
		alias: [m.id, m.mos, m.role].filter(Boolean)
	}));
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
		kind: 'si' as const,
		id: String(s.num),
		href: `/si#si-${s.num}`,
		label: s.name,
		note: s.code || 'SI',
		icon: s.icon,
		alias: [s.code, 'skill identifier']
	}));
}

/** Destination rows, from the sidebar's own list plus what it reaches sideways. */
export function pageRows(list: { href: string; label: string; alias?: string[] }[]): PaletteRow[] {
	return list.map((p) => ({
		kind: 'page' as const,
		id: p.href,
		href: p.href,
		label: p.label,
		note: 'page',
		icon: null,
		alias: p.alias ?? []
	}));
}

/**
 * Player rows, from /api/search/players.
 *
 * Not passed through `rankRows`: the database already ordered them, by career
 * XP among equal matches, and re-ranking a top-N slice against the static
 * index would only shuffle six rows the server already chose.
 */
export function playerRows(
	list: { toon: string; name: string; clan?: string; avatarUrl?: string | null }[]
): PaletteRow[] {
	return list.map((p) => ({
		kind: 'player' as const,
		id: p.toon,
		href: `/players/${encodeURIComponent(p.toon)}`,
		label: p.name || p.toon,
		note: p.clan ? `<${p.clan}>` : 'player',
		icon: p.avatarUrl ?? null
	}));
}
