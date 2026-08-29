/**
 * Community guides: a class guide written by a player rather than by the site.
 *
 * Called guides on the site; builds in the code, the database and the tests,
 * the name the feature was written under. The old hand-written guides were
 * the site's own account of a class,
 * drawn from the map's data wherever they can be and checked against it. A
 * build is a player's account: what they take, in what order, and where they
 * put it, written in markdown with their own screenshots, because the one
 * thing no extraction can show is which corner of which crate a sentry goes
 * on. So a guide is a small structured head (modes and the skill order, filled
 * in from the same data the class pages are drawn from) over a document of
 * blocks.
 *
 * The document is a shallow tree of typed blocks, the guides' own vocabulary:
 * a `section` is a band heading over blocks; `columns` puts two or three
 * blocks side by side as cards; `markdown` is text (with `[[…]]`, `{{…}}` and
 * key caps inside); `table` is a table whose cells are inline markdown; `map`
 * is the minimap with marks on it, drawn by the same component the guides
 * use, with marks that can name a region of the map rather than a point, so
 * a re-extraction that moves a cave moves the pin. Containers do not nest
 * further than that: two columns inside a column is a table, and a phone
 * flattens any of it to one column anyway.
 *
 * This module is the shape of a guide and the rules one must meet, and
 * nothing else: no database, no markdown, no request. Dependency-free so
 * node:test can load it directly (pattern: $lib/xp.ts), and so the form action
 * on the server and the editor in the browser enforce the same limits.
 */

import { RANK_TRACK_NAMES, isRankKey, type RankKey } from './ranks.ts';
import type { ReactionView } from './reactions.ts';

export const BUILD_STATUSES = ['draft', 'published', 'hidden'] as const;
export type BuildStatus = (typeof BUILD_STATUSES)[number];

export const BUILD_LIMITS = {
	/** Title, in characters. */
	title: { min: 3, max: 80 },
	/** A section, map or column heading, in characters. */
	heading: 80,
	/** Blocks in one guide, containers included. */
	blocks: 120,
	/** How deep containers go: a section holding columns holding a leaf. */
	depth: 3,
	/** Columns side by side. */
	columns: { min: 2, max: 3 },
	/** One markdown block, in characters. */
	column: 15_000,
	/** All the text of a guide together, in characters of markdown. */
	text: { min: 20, max: 30_000 },
	/** A table's shape and its cells. */
	table: { columns: 8, rows: 60, cell: 400 },
	/** A map's caption, and how many marks it may carry. */
	map: { caption: 300, marks: 40 },
	/** Pictures one guide may show. */
	images: 12,
	/** Points in a skill order: more than any class can ever spend. */
	skills: 40,
	/** Skill identifiers a guide may name. */
	sis: 12,
	/** One upload, in bytes, before the server re-encodes it. */
	imageBytes: 6 * 1024 * 1024,
	/** Longest side after re-encoding, in pixels. */
	imageSide: 1600,
	/** A comment, in characters of markdown, and the pictures it may show. */
	comment: { min: 2, max: 2000, images: 4 },
	/** A chat message: words and chips, short. */
	chat: { min: 1, max: 500 }
} as const;

/**
 * Levels a skill is assumed to have when the data does not say. Every skill
 * whose count is known has 3 to 5, and a null is an extraction gap (the
 * tooltip still lists its levels), not a skill without any.
 */
export const SKILL_LEVELS_FALLBACK = 5;

export interface BuildAuthor {
	/** Battle.net account id (the OAuth `sub` claim). */
	sub: string;
	battletag: string;
	/** The account's primary toon, for a link to their player page. */
	toon?: string;
}

/* ---------- the document ---------- */

/** A skill identifier taken, and for one with a menu (the Battle Buddy) which entry. */
export interface SiPick {
	num: number;
	choice?: string;
}

/** The colours a mark can take: the map component's own names, not values. */
export const MAP_TONES = ['accent', 'item', 'mos', 'hostile', 'gold', 'warn', 'lobby'] as const;
export type MapTone = (typeof MAP_TONES)[number];

export const MAP_MARK_KINDS = ['pin', 'area', 'label', 'dots'] as const;
export type MapMarkKind = (typeof MAP_MARK_KINDS)[number];

/** Where a mark sits: a point in game coordinates, or a named region of the map. */
export type MapAt = { x: number; y: number } | { region: string };

export interface MapMark {
	kind: MapMarkKind;
	tone: MapTone;
	/** The words by the mark, the legend entry for dots. */
	label: string;
	/** pin, area, label */
	at?: MapAt;
	/** area: radius in map units; absent means the region's own size */
	r?: number;
	/** pin: which side the label sits; absent means away from the nearer edge */
	side?: 'left' | 'right';
	/** dots: every pre-placed object of this type (a key of placed.json) */
	placed?: string;
}

export const TABLE_ALIGNS = ['left', 'center', 'right'] as const;
export type TableAlign = (typeof TABLE_ALIGNS)[number];

export interface TableColumn {
	label: string;
	align: TableAlign;
	/** The column that wraps and takes the width the others leave; default the last. */
	wide?: boolean;
}

export type Block =
	| { type: 'section'; title: string; children: Block[] }
	| { type: 'columns'; columns: Block[][] }
	| { type: 'markdown'; text: string }
	| { type: 'table'; columns: TableColumn[]; rows: string[][] }
	| { type: 'map'; title: string; caption: string; marks: MapMark[] };

export type BlockType = Block['type'];
export const BLOCK_TYPES: BlockType[] = ['section', 'columns', 'markdown', 'table', 'map'];
export const CONTAINER_TYPES: BlockType[] = ['section', 'columns'];

/** What a container may hold: a section anything but a section; columns only leaves. */
export function allowedIn(container: BlockType | null): BlockType[] {
	if (container === null) return BLOCK_TYPES;
	if (container === 'section') return BLOCK_TYPES.filter((t) => t !== 'section');
	return BLOCK_TYPES.filter((t) => !CONTAINER_TYPES.includes(t));
}

/** The previous shape of a document: a heading over one or two columns of markdown. */
export interface BuildSection {
	title: string;
	columns: string[];
}

/** One guide, as stored. */
export interface BuildDoc {
	_id: string;
	mos: string;
	/** URL segment under /mos/<id>/guides/. Unique per class, fixed at creation. */
	slug: string;
	title: string;
	author: BuildAuthor;
	/** Game modes it is written for; empty means any. Names as in progression.json. */
	modes: string[];
	/** Rank tracks it is written for; empty means any. Only tracks the class is open to. */
	ranks: RankKey[];
	/** Skill ids, one per point, in the order the points are spent. */
	skills: string[];
	/** Skill identifiers taken, in the order picked. */
	sis: SiPick[];
	blocks: Block[];
	/** The document's opening words as plain text, for lists and the page head. */
	summary: string;
	/** Image ids the document referenced at the last save: what the sweep keeps. */
	images: string[];
	status: BuildStatus;
	/** Up minus down. Written on vote, never counted on read; what the list sorts by. */
	score: number;
	/** The two sides of the score, for the rating. Absent on a guide nobody voted on. */
	ups?: number;
	downs?: number;
	/** How many comments stand on it. Written with each comment, never counted on read. */
	comments?: number;
	createdAt: string;
	updatedAt: string;
	publishedAt?: string;
	hiddenAt?: string;
}

/** A guide in a list: everything but its document. */
export type BuildListing = Omit<BuildDoc, 'blocks'>;

/** What a save carries, before validation. */
export interface BuildInput {
	title: string;
	modes: string[];
	ranks: RankKey[];
	skills: string[];
	sis: SiPick[];
	blocks: Block[];
	publish: boolean;
}

/** The editor's fields: what a refused save echoes back so nothing typed is lost. */
export type BuildFormValues = Omit<BuildInput, 'publish'>;

/** What validation needs to know about the class the guide is for, the game, and the map. */
export interface BuildContext {
	skills: { id: string; name: string; levels: number | null }[];
	modes: string[];
	/** The rank tracks the class can be played on. */
	ranks: RankKey[];
	/** Skill points a hero gets in all: one per level (see $lib/mechanics). */
	points: number;
	/** The level cap, for the words. */
	levelMax: number;
	/** Skill identifiers this class may take (its own and the universal ones), each with the keys of its menu if it has one and the tracks that sell it. */
	sis: { num: number; name: string; choices: string[]; tracks: RankKey[] }[];
	/** Game coordinates run 0..mapSize on both axes. */
	mapSize: number;
	/** Names of the map's regions, what a mark may sit on. */
	regions: Iterable<string>;
	/** Kinds of pre-placed object, what dots may show. */
	placed: Iterable<string>;
}

export type BuildValidation = { ok: true; value: BuildInput } | { ok: false; error: string };

/**
 * The hero level at which the point at this index of a skill order arrives:
 * a hero has one point per level, the first at level 1, at spawn. Points per
 * level is 1 in the data; the parameter is there so a change in the map shows
 * up in one place.
 */
export function levelOfPoint(index: number, pointsPerLevel = 1): number {
	return Math.floor(index / pointsPerLevel) + 1;
}

/** Image ids are 16 hex digits, minted by the upload endpoint. */
export const IMAGE_ID = /^[0-9a-f]{16}$/;

/** How text names a picture: `![what it shows](img:<id>)`. */
export const imageRef = (id: string) => `img:${id}`;

/** Where a picture is served from. */
export const imageUrl = (id: string) => `/guides/img/${id}.webp`;

const IMAGE_REF = /!\[[^\]]*\]\(\s*img:([0-9a-f]{16})(?:\s+"[^"]*")?\s*\)/g;

/* ---------- walking the document ---------- */

/** Every block, containers included, depth first. */
export function* walkBlocks(blocks: Block[]): Generator<Block> {
	for (const b of blocks) {
		yield b;
		if (b.type === 'section') yield* walkBlocks(b.children);
		else if (b.type === 'columns') for (const col of b.columns) yield* walkBlocks(col);
	}
}

/** All of a guide's markdown, in reading order: the text blocks and every table cell. */
export function allText(blocks: Block[]): string {
	const parts: string[] = [];
	for (const b of walkBlocks(blocks)) {
		if (b.type === 'markdown') parts.push(b.text);
		else if (b.type === 'table') parts.push(...b.rows.flat());
	}
	return parts.join('\n\n');
}

/** Every picture the document shows, each once, in order of first appearance. */
export function imageRefs(blocks: Block[]): string[] {
	return imageRefsIn(allText(blocks));
}

/** The players one piece of markdown pings, by handle, each once: `[[player:<toon>|Name]]`. */
export function playerRefsIn(text: string): string[] {
	const seen = new Set<string>();
	for (const m of text.matchAll(/(?:\[\[|\{\{)player:(\d+-S2-\d+-\d+)(?:\|[^\]}\n]*)?(?:\]\]|\}\})/g)) seen.add(m[1]);
	return [...seen];
}

/** The pictures one piece of markdown shows (a comment), each once. */
export function imageRefsIn(text: string): string[] {
	const seen = new Set<string>();
	for (const m of text.matchAll(IMAGE_REF)) seen.add(m[1]);
	return [...seen];
}

/** How many blocks there are, containers included. */
export function countBlocks(blocks: Block[]): number {
	let n = 0;
	for (const _ of walkBlocks(blocks)) n++;
	return n;
}

/**
 * The document's first paragraph as plain text, clamped for a list card or a
 * page description. Not a markdown parser: it drops the syntax a summary
 * should not show (pictures, headings, emphasis, links' targets, references'
 * brackets) and keeps the words.
 */
export function summarize(blocks: Block[], max = 160): string {
	const first = [...walkBlocks(blocks)].find((b) => b.type === 'markdown');
	const text = (first && first.type === 'markdown' ? first.text : '')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, '') // pictures show nothing in text
		.replace(/```[\s\S]*?```/g, '')
		.split(/\n\s*\n/)
		.map((p) =>
			p
				.replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/gm, '')
				.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
				.replace(/(\[\[|\{\{)(?:[a-z]+:)?([^\]}|]+?)(?:\|([^\]}]+))?(\]\]|\}\})/g, (_, __, r, l) => l ?? r)
				.replace(/[*_`~]+/g, '')
				.replace(/\s+/g, ' ')
				.trim()
		)
		.find(Boolean);
	const s = text ?? '';
	if (s.length <= max) return s;
	const cut = s.slice(0, max - 1);
	const at = cut.lastIndexOf(' ');
	return `${at > max / 2 ? cut.slice(0, at) : cut}…`;
}

/* ---------- reading what the editor posts ---------- */

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const text = (v: unknown) =>
	typeof v === 'string' ? v.replace(/\r\n?/g, '\n').replace(/\s+$/, '') : '';
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T =>
	typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : fallback;

function readMark(v: unknown): MapMark {
	const o = (v ?? {}) as Record<string, unknown>;
	const mark: MapMark = {
		kind: oneOf(o.kind, MAP_MARK_KINDS, 'pin'),
		tone: oneOf(o.tone, MAP_TONES, 'accent'),
		label: str(o.label)
	};
	const at = (o.at ?? {}) as Record<string, unknown>;
	if (typeof at.region === 'string' && at.region.trim()) mark.at = { region: at.region.trim() };
	else if (num(at.x) !== undefined && num(at.y) !== undefined) mark.at = { x: at.x as number, y: at.y as number };
	if (num(o.r) !== undefined) mark.r = o.r as number;
	if (o.side === 'left' || o.side === 'right') mark.side = o.side;
	if (typeof o.placed === 'string' && o.placed.trim()) mark.placed = o.placed.trim();
	return mark;
}

function readBlock(v: unknown, depth: number): Block | null {
	const o = (v ?? {}) as Record<string, unknown>;
	switch (o.type) {
		case 'markdown':
			return { type: 'markdown', text: text(o.text) };
		case 'table': {
			const columns = (Array.isArray(o.columns) ? o.columns : []).map((c) => {
				const col = (c ?? {}) as Record<string, unknown>;
				return {
					label: str(col.label),
					align: oneOf(col.align, TABLE_ALIGNS, 'left'),
					...(col.wide === true ? { wide: true } : {})
				};
			});
			const rows = (Array.isArray(o.rows) ? o.rows : []).map((r) => {
				const cells = (Array.isArray(r) ? r : []).map(text);
				// every row as wide as the head: a short row is padded, a long one cut
				return columns.map((_, i) => cells[i] ?? '');
			});
			return { type: 'table', columns, rows };
		}
		case 'map':
			return {
				type: 'map',
				title: str(o.title),
				caption: str(o.caption),
				marks: (Array.isArray(o.marks) ? o.marks : []).map(readMark)
			};
		case 'section':
			if (depth >= BUILD_LIMITS.depth) return null;
			return { type: 'section', title: str(o.title), children: readBlocks(o.children, depth + 1) };
		case 'columns':
			if (depth >= BUILD_LIMITS.depth) return null;
			return {
				type: 'columns',
				columns: (Array.isArray(o.columns) ? o.columns : []).map((col) => readBlocks(col, depth + 1))
			};
		default:
			return null;
	}
}

/**
 * Blocks as the editor posts them, or as a store holds them: one JSON value,
 * because the tree is the content and a flat form cannot say it. Anything
 * malformed reads as no blocks, which validation then refuses in words; a
 * save is never lost to a parse error mid-way. Unknown block types are
 * dropped rather than kept as junk.
 */
export function readBlocks(raw: unknown, depth = 0): Block[] {
	let parsed: unknown = raw;
	if (typeof raw === 'string') {
		try {
			parsed = JSON.parse(raw);
		} catch {
			return [];
		}
	}
	if (!Array.isArray(parsed)) return [];
	return parsed.map((b) => readBlock(b, depth)).filter((b): b is Block => b !== null);
}

/**
 * The previous shape of a document as blocks: a titled section holding either
 * one text block or a row of columns, an untitled one just its blocks. What
 * `getBuild` runs on a document saved before blocks existed.
 */
export function blocksFromSections(sections: BuildSection[]): Block[] {
	const out: Block[] = [];
	for (const s of sections) {
		const inner: Block[] =
			s.columns.length >= 2
				? [{ type: 'columns', columns: s.columns.map((c) => [{ type: 'markdown', text: c }]) }]
				: [{ type: 'markdown', text: s.columns[0] ?? '' }];
		if (s.title) out.push({ type: 'section', title: s.title, children: inner });
		else out.push(...inner);
	}
	return out;
}

/** The SI picks as the editor posts them: one JSON field, `[{num, choice?}]`. */
export function readSiPicks(raw: unknown): SiPick[] {
	let parsed: unknown = raw;
	if (typeof raw === 'string') {
		try {
			parsed = JSON.parse(raw);
		} catch {
			return [];
		}
	}
	if (!Array.isArray(parsed)) return [];
	const out: SiPick[] = [];
	for (const v of parsed) {
		const o = (v ?? {}) as Record<string, unknown>;
		const n = typeof o.num === 'number' ? o.num : Number(o.num);
		if (!Number.isInteger(n)) continue;
		const choice = str(o.choice);
		out.push(choice ? { num: n, choice } : { num: n });
	}
	return out;
}

/**
 * The fields as a form action receives them. Modes are checkboxes, so they
 * arrive as repeated fields; the skill order is one hidden field the editor
 * keeps as a comma-separated list, since its order is the point; the SI picks
 * and the document are JSON fields.
 */
export function readBuildForm(form: FormData): BuildInput {
	const field = (k: string) => {
		const v = form.get(k);
		return typeof v === 'string' ? v : '';
	};
	const list = (k: string) => form.getAll(k).filter((v): v is string => typeof v === 'string');
	return {
		title: field('title').trim(),
		modes: list('modes'),
		ranks: list('ranks').filter(isRankKey),
		skills: field('skills')
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean),
		sis: readSiPicks(field('sis')),
		blocks: readBlocks(field('blocks')),
		publish: field('intent') === 'publish'
	};
}

/* ---------- the rules ---------- */

const uniq = <T>(xs: T[]) => [...new Set(xs)];

type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });

function checkMark(m: MapMark, ctx: BuildContext, regions: Set<string>, placed: Set<string>): Fail | null {
	if (m.label.length > BUILD_LIMITS.heading) return fail('Keep a map label short.');
	if (m.kind === 'dots') {
		if (!m.placed || !placed.has(m.placed)) return fail('Dots need a kind of placed object the map has.');
		return null;
	}
	if (!m.at) return fail('A map mark needs a place: a point or a region.');
	if ('region' in m.at) {
		if (!regions.has(m.at.region)) return fail(`The map has no region called "${m.at.region}".`);
	} else if (m.at.x < 0 || m.at.x > ctx.mapSize || m.at.y < 0 || m.at.y > ctx.mapSize) {
		return fail('A map mark is off the map.');
	}
	if (m.r !== undefined && (m.r <= 0 || m.r > ctx.mapSize / 2)) return fail('A map area is too big or too small.');
	return null;
}

function checkBlocks(
	blocks: Block[],
	ctx: BuildContext,
	container: BlockType | null,
	regions: Set<string>,
	placed: Set<string>
): Fail | null {
	const allowed = allowedIn(container);
	for (const b of blocks) {
		if (!allowed.includes(b.type)) {
			return fail(
				container === 'columns'
					? 'A column holds text, a table or a map, not another row of columns.'
					: 'A section cannot hold a section.'
			);
		}
		switch (b.type) {
			case 'markdown':
				if (b.text.length > BUILD_LIMITS.column)
					return fail(`One text block is over the ${BUILD_LIMITS.column.toLocaleString('en')} character limit.`);
				break;
			case 'section': {
				if (b.title.length > BUILD_LIMITS.heading) return fail(`Keep headings under ${BUILD_LIMITS.heading} characters.`);
				const r = checkBlocks(b.children, ctx, 'section', regions, placed);
				if (r) return r;
				break;
			}
			case 'columns': {
				if (b.columns.length < BUILD_LIMITS.columns.min || b.columns.length > BUILD_LIMITS.columns.max)
					return fail(`Columns come ${BUILD_LIMITS.columns.min} or ${BUILD_LIMITS.columns.max} abreast.`);
				for (const col of b.columns) {
					const r = checkBlocks(col, ctx, 'columns', regions, placed);
					if (r) return r;
				}
				break;
			}
			case 'table': {
				if (b.columns.length < 1 || b.columns.length > BUILD_LIMITS.table.columns)
					return fail(`A table has 1 to ${BUILD_LIMITS.table.columns} columns.`);
				if (b.rows.length > BUILD_LIMITS.table.rows) return fail(`A table has at most ${BUILD_LIMITS.table.rows} rows.`);
				if (b.columns.some((c) => c.label.length > BUILD_LIMITS.heading)) return fail('Keep column headings short.');
				if (b.rows.some((r) => r.length !== b.columns.length)) return fail('Every table row needs a cell per column.');
				if (b.rows.some((r) => r.some((c) => c.length > BUILD_LIMITS.table.cell)))
					return fail(`Keep a table cell under ${BUILD_LIMITS.table.cell} characters.`);
				break;
			}
			case 'map': {
				if (b.title.length > BUILD_LIMITS.heading) return fail(`Keep headings under ${BUILD_LIMITS.heading} characters.`);
				if (b.caption.length > BUILD_LIMITS.map.caption) return fail('Keep a map caption short.');
				if (b.marks.length > BUILD_LIMITS.map.marks) return fail(`A map carries at most ${BUILD_LIMITS.map.marks} marks.`);
				for (const m of b.marks) {
					const r = checkMark(m, ctx, regions, placed);
					if (r) return r;
				}
				break;
			}
		}
	}
	return null;
}

/**
 * Whether a save is acceptable, and the cleaned value if so. Each check names
 * what is wrong in the words the editor shows, so a rejected save reads as a
 * correction rather than an error code.
 */
export function validateBuild(input: BuildInput, ctx: BuildContext): BuildValidation {
	const { title } = input;

	if (title.length < BUILD_LIMITS.title.min) return fail('Give the guide a title.');
	if (title.length > BUILD_LIMITS.title.max)
		return fail(`Keep the title under ${BUILD_LIMITS.title.max} characters.`);
	if (/[\n\r]/.test(title)) return fail('The title is one line.');

	if (input.blocks.length === 0) return fail('Write at least one block.');
	if (countBlocks(input.blocks) > BUILD_LIMITS.blocks)
		return fail(`A guide has at most ${BUILD_LIMITS.blocks} blocks.`);
	const r = checkBlocks(input.blocks, ctx, null, new Set(ctx.regions), new Set(ctx.placed));
	if (r) return r;
	const words = allText(input.blocks);
	if (words.trim().length < BUILD_LIMITS.text.min) return fail('Write at least a few lines.');
	if (words.length > BUILD_LIMITS.text.max)
		return fail(`The text is over the ${BUILD_LIMITS.text.max.toLocaleString('en')} character limit.`);

	const knownModes = new Set(ctx.modes);
	const modes = uniq(input.modes);
	if (modes.some((m) => !knownModes.has(m))) return fail('One of the game modes is not one the map has.');

	let ranks = uniq(input.ranks);
	if (ranks.some((r) => !ctx.ranks.includes(r))) return fail('One of the rank tracks cannot play this class.');
	// a class open to one track is played on that track: the guide says so whether or not the author did
	if (!ranks.length && ctx.ranks.length === 1) ranks = [...ctx.ranks];

	if (input.skills.length > Math.min(ctx.points, BUILD_LIMITS.skills))
		return fail(`A game gives ${ctx.points} skill points, one per level up to level ${ctx.levelMax}.`);
	const caps = new Map(ctx.skills.map((s) => [s.id, s.levels ?? SKILL_LEVELS_FALLBACK]));
	const names = new Map(ctx.skills.map((s) => [s.id, s.name]));
	const counts = new Map<string, number>();
	for (const id of input.skills) {
		const cap = caps.get(id);
		if (cap === undefined) return fail('The skill order names a skill this class does not have.');
		const n = (counts.get(id) ?? 0) + 1;
		if (n > cap) return fail(`${names.get(id)} has only ${cap} levels.`);
		counts.set(id, n);
	}

	const byNum = new Map(ctx.sis.map((s) => [s.num, s]));
	const sis: SiPick[] = [];
	for (const pick of input.sis) {
		if (sis.some((p) => p.num === pick.num)) continue;
		const si = byNum.get(pick.num);
		if (!si) return fail('One of the skill identifiers is not one this class can take.');
		if (pick.choice && !si.choices.includes(pick.choice)) return fail('That is not one of the choices that skill identifier offers.');
		if (ranks.length && !si.tracks.some((t) => ranks.includes(t)))
			return fail(`${si.name} is not sold on the ${ranks.map((r) => RANK_TRACK_NAMES[r]).join(' or ')} track.`);
		sis.push(pick.choice ? { num: pick.num, choice: pick.choice } : { num: pick.num });
	}
	if (sis.length > BUILD_LIMITS.sis) return fail(`A guide names at most ${BUILD_LIMITS.sis} skill identifiers.`);

	if (imageRefs(input.blocks).length > BUILD_LIMITS.images)
		return fail(`A guide can show up to ${BUILD_LIMITS.images} pictures.`);

	return {
		ok: true,
		value: {
			title,
			modes,
			ranks,
			skills: [...input.skills],
			sis,
			blocks: readBlocks(input.blocks),
			publish: input.publish
		}
	};
}

/**
 * Whether a comment may be posted, and the cleaned text if so. The same
 * markdown as a guide, minus pictures: a comment has no upload of its own,
 * and a picture id copied from someone's build is theirs to show, not the
 * commenter's.
 */
export function validateComment(
	raw: string
): { ok: true; text: string; images: string[] } | { ok: false; error: string } {
	const text = raw.replace(/\r\n?/g, '\n').trim();
	if (text.length < BUILD_LIMITS.comment.min) return { ok: false, error: 'Write something.' };
	if (text.length > BUILD_LIMITS.comment.max)
		return { ok: false, error: `Keep a comment under ${BUILD_LIMITS.comment.max.toLocaleString('en')} characters.` };
	const images = imageRefsIn(text);
	if (images.length > BUILD_LIMITS.comment.images)
		return { ok: false, error: `A comment shows at most ${BUILD_LIMITS.comment.images} pictures.` };
	return { ok: true, text, images };
}

/** Points per skill, in the order each skill first gets one. */
export function skillCounts(skills: string[]): { id: string; points: number }[] {
	const out: { id: string; points: number }[] = [];
	for (const id of skills) {
		const hit = out.find((s) => s.id === id);
		if (hit) hit.points++;
		else out.push({ id, points: 1 });
	}
	return out;
}

/**
 * A title as a URL segment: lower-case ASCII and hyphens, at most 60
 * characters, never empty. Uniqueness within a class is the store's job
 * (it appends a counter), and the slug never changes once a guide has one,
 * so a shared link outlives a retitle.
 */
export function slugify(title: string): string {
	const s = title
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60)
		.replace(/-+$/, '');
	return s || 'build';
}

/** The guide's page, or its editor. */
export function buildHref(mos: string, slug: string, edit = false): string {
	const base = `/mos/${encodeURIComponent(mos)}/guides/${encodeURIComponent(slug)}`;
	return edit ? `${base}/edit` : base;
}

/** An author as a page may show them: the battletag, never the account id. */
export type PublicAuthor = Omit<BuildAuthor, 'sub'>;

export type PublicBuild<T extends { author: BuildAuthor }> = Omit<T, 'author'> & {
	author: PublicAuthor;
};

/** A guide as it leaves the server for a page. */
export function publicBuild<T extends { author: BuildAuthor }>(b: T): PublicBuild<T> {
	const { sub: _sub, ...author } = b.author;
	return { ...b, author };
}

/** Whether a chat message may be sent: short, words and chips, no pictures. */
export function validateChat(raw: string): { ok: true; text: string } | { ok: false; error: string } {
	const text = raw.replace(/\r\n?/g, '\n').trim();
	if (text.length < BUILD_LIMITS.chat.min) return { ok: false, error: 'Write something.' };
	if (text.length > BUILD_LIMITS.chat.max) return { ok: false, error: `Keep a message under ${BUILD_LIMITS.chat.max} characters.` };
	if (imageRefsIn(text).length) return { ok: false, error: 'The chat takes words and chips, not pictures.' };
	return { ok: true, text };
}

/* ---------- rating ---------- */

/**
 * A guide's mark out of ten: the share of its votes that went up, to one
 * decimal, or null with no votes at all. A share, not a Bayesian estimate:
 * with the numbers a class's builds get, the reader can see the two counts
 * beside it and weigh them for themselves.
 */
export function rating(ups = 0, downs = 0): number | null {
	const n = ups + downs;
	if (n <= 0) return null;
	return Math.round((ups / n) * 100) / 10;
}

/** "8.7", or "8" when it is whole, the way a mark reads. */
export function formatRating(r: number): string {
	return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** The colour a mark gets: good from 7, poor under 4, plain between. */
export function ratingTone(r: number): 'good' | 'mid' | 'low' {
	return r >= 7 ? 'good' : r >= 4 ? 'mid' : 'low';
}

/* ---------- comment threads ---------- */

/** One comment as a page draws it: names and pictures resolved, the reader's own vote, the words rendered. */
export interface CommentView extends ThreadItem {
	hidden: boolean;
	deleted: boolean;
	/** The reader's own. */
	mine: boolean;
	/** By the subject's author (a guide's), the one voice a thread marks. */
	op: boolean;
	name: string;
	toon: string | null;
	avatar: string | null;
	vote: 1 | -1 | 0;
	html: string;
	/** The words as written, for rewording one's own; empty on everybody else's. */
	text: string;
	/** When its author last reworded it, if they have. */
	editedAt: string | null;
	/** Arrived since the reader last opened the thread (never on their own). */
	unseen: boolean;
	/** The faces on it, with the reader's own lit. */
	reactions: ReactionView[];
}

/**
 * Who a new comment is news to: the author of the comment it answers (a
 * reply), and the guide's author (a comment on their guide), each once, and
 * never the commenter. The parent's author comes first: if the guide's
 * author is who was answered, that is the one thing they are told.
 */
export function commentRecipients(a: {
	commenter: string;
	owner?: string | null;
	parentAuthor?: string | null;
}): { sub: string; kind: 'comment' | 'reply' }[] {
	const out: { sub: string; kind: 'comment' | 'reply' }[] = [];
	if (a.parentAuthor && a.parentAuthor !== a.commenter) out.push({ sub: a.parentAuthor, kind: 'reply' });
	if (a.owner && a.owner !== a.commenter && !out.some((r) => r.sub === a.owner)) out.push({ sub: a.owner, kind: 'comment' });
	return out;
}

/** A comment's first words as plain text: chips read as their names, pictures as a word, one line. */
export function excerptOf(text: string, max = 140): string {
	const plain = text
		.replace(/!\[[^\]]*\]\(\s*img:[^)]*\)/g, '[picture]')
		.replace(/(\[\[|\{\{)(?:[a-z]+:)?([^\]}|\n]+?)(?:\|([^\]}\n]+))?(\]\]|\}\})/g, (_m, _o, id, label) => label ?? id)
		.replace(/[`*_#>]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	return plain.length > max ? plain.slice(0, max - 1).trimEnd() + '…' : plain;
}

/**
 * How deep a thread goes. Past this a reply is refused rather than attached
 * somewhere else: eight levels of indent is already the width of a phone,
 * and a conversation that long has stopped being about the guide.
 */
export const COMMENT_DEPTH_MAX = 8;

export interface ThreadItem {
	id: string;
	/** The comment this one answers; null for a top-level comment. */
	parent: string | null;
	createdAt: string;
	/** Up minus down. */
	score: number;
	/** Taken back by its author: a stump that only stands while answers hang from it. */
	deleted?: boolean;
}

export interface Thread<T extends ThreadItem> {
	node: T;
	depth: number;
	replies: Thread<T>[];
}

/**
 * A flat list of comments as the tree the page draws: each comment under the
 * one it answers, best first at every level (score, then age, so a tie reads
 * oldest first). `canSee` decides who is in: a comment the reader may not see
 * takes its whole branch with it, since an answer to something that is not
 * there is noise. A comment whose parent is gone for good stands at the top,
 * rather than vanishing; a stump with nothing left under it is not drawn.
 */
export function threadComments<T extends ThreadItem>(list: T[], canSee: (c: T) => boolean = () => true): Thread<T>[] {
	const ids = new Set(list.map((c) => c.id));
	const byParent = new Map<string | null, T[]>();
	for (const c of list) {
		if (!canSee(c)) continue;
		const key = c.parent && ids.has(c.parent) ? c.parent : null;
		const bucket = byParent.get(key) ?? [];
		bucket.push(c);
		byParent.set(key, bucket);
	}
	const order = (a: T, b: T) => b.score - a.score || a.createdAt.localeCompare(b.createdAt);
	const grow = (parent: string | null, depth: number): Thread<T>[] =>
		(byParent.get(parent) ?? [])
			.sort(order)
			.map((node) => ({ node, depth, replies: grow(node.id, depth + 1) }))
			.filter((t) => !t.node.deleted || t.replies.length > 0);
	return grow(null, 0);
}

/** How many comments a tree holds, at every level. */
export function countThreads<T extends ThreadItem>(threads: Thread<T>[]): number {
	return threads.reduce((n, t) => n + 1 + countThreads(t.replies), 0);
}

/** The depth a reply to `parent` would have: 0 for a top-level comment. */
export function replyDepth(list: Pick<ThreadItem, 'id' | 'parent'>[], parent: string | null): number {
	const byId = new Map(list.map((c) => [c.id, c]));
	let depth = 0;
	for (let p = parent; p; p = byId.get(p)?.parent ?? null) depth++;
	return depth;
}
