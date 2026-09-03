/**
 * The numbers behind a class's skills and commands, read from the ability
 * arrays in the map data (extract_mos_items.py → skillstats.json). One row per
 * level: the learn tree raises the level and the game reads that slot of every
 * array, so a four-level rocket has four rows and a plain command has one. The
 * rows are the facts; the shaping into a table — a label, one cell per level —
 * lives here so the skill sheets and the command list draw the same thing.
 */
import type { StatIconName } from '$lib/components/StatIcon.svelte';

export interface Charges {
	max: number;
	/** Charges one cast spends: a two-rocket salvo fires 2. */
	use: number;
	/** Seconds for a spent charge to come back. */
	regen?: number;
}

export interface LevelExtra {
	id: string;
	dmg: number;
	cond?: string;
	period?: number;
	count?: number;
	/** Attributes the hit demands (a fallout that only burns Biological). */
	only?: string[];
}

export interface LevelApply {
	/** The behaviour's id: its page under /effects. */
	id?: string;
	/** The icon the game shows for it. */
	icon?: string;
	name: string;
	effects: string[];
	dur?: string;
	cond?: string;
	self?: boolean;
	/** The skill level the buff needs, e.g. "Soldier Skills 3". */
	req?: string;
	/** Lands with this probability (0–1). */
	chance?: number;
	/** Game modes (1–12) the buff needs, when the script checks one. */
	modes?: number[];
	/** A passive the unit carries from this level on, not something the ability casts. */
	passive?: boolean;
}

/** The weapon an ammo mode swaps in, with the same facets a weapon table row carries. */
export interface LevelWeapon {
	id: string;
	name: string;
	dmg: number | null;
	range: number | null;
	period: number | null;
	random?: number;
	armor?: number;
	kind?: string;
	bonus?: { attr: string; value?: number; factor?: number }[];
	splash?: { r: number; f: number; arc?: number }[];
	hits?: number;
	only?: string[];
	extra?: LevelExtra[];
	applies?: LevelApply[];
	/** Energy each shot spends. */
	energy?: number;
}

export interface LevelStats {
	lv: number;
	energy?: number;
	life?: number;
	/** Rounds and magazines a cast spends (the map counts ammo as resources). */
	rounds?: number;
	magazines?: number;
	/** Cooldown in seconds; `cdShared` when it is another ability's clock. */
	cd?: number;
	cdShared?: boolean;
	charges?: Charges;
	/** Cast time in seconds (prep + cast intro). */
	cast?: number;
	finish?: number;
	range?: number;
	dmg?: number;
	random?: number;
	armor?: number;
	kind?: string;
	cond?: string;
	bonus?: { attr: string; value?: number; factor?: number }[];
	splash?: { r: number; f: number; arc?: number }[];
	/** The damage lands this many times (a salvo, a multi-tick). */
	hits?: number;
	extra?: LevelExtra[];
	only?: string[];
	/** Area damage that reaches allies too. */
	allies?: boolean;
	applies?: LevelApply[];
	spawns?: { id: string; name: string; n: number; life?: number; sight?: number; traits?: string[] }[];
	vitals?: string[];
	reveal?: { r: number; dur?: number; detects?: boolean; map?: boolean };
	removes?: string[];
	/** The removed buffs' ids and icons, parallel to `removes`. */
	removeIds?: string[];
	removeIcons?: (string | null)[];
	/** A toggle's behaviour at this level. */
	mods?: string[];
	/** An ammo mode: the weapon this level swaps in while it is on. */
	weapon?: LevelWeapon;
	dur?: number;
	/** The ability's effect slot is empty in the data; these are the same-named effect's numbers. */
	inferred?: boolean;
	/** The ability carries no effect: `applies` is what the map script puts on the caster. */
	viaScript?: boolean;
	/** This row is the base numbers rewritten by a skill tree's upgrades at `treeLevel`. */
	tree?: string;
	treeLevel?: number;
	/** A tree whose levels are upgrades: what this level sets, on whom. */
	sets?: string[];
}

/** One class's rows, by ability id. */
export type ClassStats = Record<string, LevelStats[]>;

/** One buff in an Applies cell: its name, what gates it, what it does. */
export interface CellBlock {
	title: string;
	/** The effect's own page. */
	href?: string;
	/** The effect's icon, drawn small before the title. */
	icon?: string;
	/** Duration, the skill level it needs — after the title. */
	note?: string;
	/** Game modes the buff needs, drawn as the modes' own marks. */
	modes?: number[];
	items: string[];
}

/** A small icon-and-word after a value: the target type a hit is limited to. */
export interface CellTag {
	icon: StatIconName | null;
	text: string;
}

export interface Cell {
	text: string;
	/** A smaller second line under the value. */
	sub?: string;
	/** The value in pieces, each naming a unit or a page it links to; `text` stays the plain reading. */
	parts?: { text: string; unit?: string; href?: string; icon?: string }[];
	/** Prose cells read left-aligned, one line per entry, instead of a right-aligned number. */
	lines?: string[];
	/** A list of buffs, each its own block; `text` stays the plain reading. */
	blocks?: CellBlock[];
	/** Tags after the value (target types); `text` still carries them as words. */
	tags?: CellTag[];
	/** A key/value table inside the cell (an ammo mode's weapon). */
	nested?: CellNest;
}

const TYPE_ICONS: Record<string, StatIconName> = {
	Biological: 'biological',
	Mechanical: 'mechanical',
	Robotic: 'mechanical'
};

/** The "biological only" of a hit as tags: the type's icon where it has one. */
function onlyTags(only: string[] | undefined): CellTag[] {
	return (only ?? []).map((o) => ({ icon: TYPE_ICONS[o] ?? null, text: `${o.toLowerCase()} only` }));
}

export interface StatRow {
	label: string;
	/** Under the label: which ring, which vital. */
	note?: string;
	icon: StatIconName;
	/** One per level; null where the level has nothing for this row. */
	cells: (Cell | null)[];
}

export function fmt(n: number): string {
	return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

/** Seconds the way the game's own tooltips say them: 55 s, 2 min, 60 min. */
export function sec(s: number): string {
	if (s >= 60) return s % 60 === 0 ? `${s / 60} min` : `${fmt(s / 60)} min`;
	return `${fmt(s)} s`;
}

const pct = (f: number) => `${Math.round(f * 100)}%`;
const lower = (a: string[]) => a.map((x) => x.toLowerCase()).join(', ');

function bonusText(b: { attr: string; value?: number; factor?: number }[]): string {
	const byValue = new Map<string, string[]>();
	for (const x of b) {
		// a factor is a share of the damage added or taken off: 2 is +200%, −0.2 is −20%
		const key =
			x.factor != null
				? `${x.factor > 0 ? '+' : '−'}${pct(Math.abs(x.factor))}`
				: `${(x.value ?? 0) > 0 ? '+' : '−'}${fmt(Math.abs(x.value ?? 0))}`;
		byValue.set(key, [...(byValue.get(key) ?? []), x.attr]);
	}
	return [...byValue].map(([v, attrs]) => `${v} vs ${attrs.join(', ')}`).join('; ');
}

function damageCell(r: LevelStats): Cell | null {
	if (r.dmg == null) return null;
	let text = r.hits && r.hits > 1 ? `${r.hits} × ${fmt(r.dmg)}` : fmt(r.dmg);
	if (r.random) text += ` +0–${fmt(r.random)}`;
	const subs: string[] = [];
	if (r.hits && r.hits > 1) subs.push(`= ${fmt(r.dmg * r.hits)} total`);
	if (r.cond) subs.push(`only if ${r.cond}`);
	const tags = onlyTags(r.only);
	return {
		text: `${text}${r.only?.length ? ` (${lower(r.only)} only)` : ''}`,
		...(subs.length ? { sub: subs.join(' · ') } : {}),
		...(tags.length ? { tags } : {})
	};
}

/**
 * One row per splash ring: the ring's share of the damage is the label, the
 * cell is its radius on that level — so "full damage within 3 · 3.6 · 4.2 · 5"
 * reads across, and a ring that grows shows as a change. Rings are matched by
 * position; a level whose ring keeps another share says so in the cell.
 */
function ringRows(rows: LevelStats[]): StatRow[] {
	const n = Math.max(0, ...rows.map((r) => r.splash?.length ?? 0));
	const out: StatRow[] = [];
	for (let i = 0; i < n; i++) {
		const first = rows.find((r) => r.splash?.[i])!.splash![i];
		const share = (f: number, arc?: number) =>
			`${f >= 1 ? 'full damage' : `${pct(f)} damage`}${arc ? `, ${arc}° cone` : ''}`;
		out.push({
			label: 'Splash',
			note: share(first.f, first.arc),
			icon: 'splash',
			cells: rows.map((r) => {
				const ring = r.splash?.[i];
				if (!ring) return null;
				const same = ring.f === first.f && ring.arc === first.arc;
				return { text: fmt(ring.r), ...(same ? {} : { sub: share(ring.f, ring.arc) }) };
			})
		});
	}
	return out;
}

function extraCell(r: LevelStats): Cell | null {
	if (!r.extra?.length) return null;
	const lines = r.extra.map((e) => {
		let s = fmt(e.dmg);
		if (e.period && e.count) s += ` every ${fmt(e.period)} s for ${sec(e.period * e.count)}`;
		else if (e.count) s += ` × ${e.count}`;
		if (e.cond) s += ` (if ${e.cond})`;
		return s;
	});
	// one burn is the usual case: its target type goes on as a tag, not in the line
	const tags = r.extra.length === 1 ? onlyTags(r.extra[0].only) : [];
	const text = r.extra
		.map((e, i) => `${lines[i]}${e.only?.length && r.extra!.length > 1 ? ` (${lower(e.only)} only)` : ''}`)
		.join('\n');
	return { text, ...(tags.length ? { tags } : {}) };
}

function appliesCell(r: LevelStats): Cell | null {
	const onHit = new Set((r.weapon?.applies ?? []).map((a) => a.name));
	const applies = (r.applies ?? []).filter((a) => !onHit.has(a.name));
	if (!applies.length) return null;
	const blocks = applies.map((a) => ({
		title: a.name,
		...(a.id ? { href: `/effects/${encodeURIComponent(a.id)}` } : {}),
		...(a.icon ? { icon: a.icon } : {}),
		note: [
			a.passive ? 'passive' : '',
			a.chance ? `${pct(a.chance)} chance` : '',
			a.dur ? `${a.dur} s` : '',
			a.req ? `with ${a.req}` : '',
			a.modes?.length ? '' : (a.cond ?? '')
		]
			.filter(Boolean)
			.join(' · '),
		...(a.modes?.length ? { modes: a.modes } : {}),
		items: a.effects
	}));
	return {
		text: applies.map((a) => `${a.name}${a.cond ? ` (${a.cond})` : ''}: ${a.effects.join(', ')}`).join('\n'),
		blocks
	};
}

/** A key/value table nested inside one cell: the weapon an ammo mode swaps in. */
export interface CellNest {
	title: string;
	note?: string;
	kv: { k: string; v: string; tags?: CellTag[] }[];
	blocks?: CellBlock[];
}

function weaponFacets(w: LevelWeapon): CellNest['kv'] {
	const kv: CellNest['kv'] = [];
	if (w.dmg != null) {
		let d = w.hits && w.hits > 1 ? `${w.hits} × ${fmt(w.dmg)}` : fmt(w.dmg);
		if (w.random) d += ` +0–${fmt(w.random)}`;
		const tags = onlyTags(w.only);
		kv.push({ k: 'damage', v: d, ...(tags.length ? { tags } : {}) });
	}
	if (w.period) kv.push({ k: 'every', v: sec(w.period) });
	if (w.energy) kv.push({ k: 'energy per shot', v: fmt(w.energy) });
	if (w.range) kv.push({ k: 'range', v: fmt(w.range) });
	if (w.armor) kv.push({ k: 'ignores armor', v: fmt(w.armor) });
	if (w.bonus?.length) kv.push({ k: 'bonus', v: bonusText(w.bonus) });
	if (w.splash?.length) {
		kv.push({ k: 'splash', v: w.splash.map((s) => `${pct(s.f)} ≤ ${fmt(s.r)}${s.arc ? ` (${s.arc}°)` : ''}`).join(' · ') });
	}
	for (const e of w.extra ?? []) {
		kv.push({ k: 'over time', v: `${fmt(e.dmg)}${e.period && e.count ? ` every ${fmt(e.period)} s for ${sec(e.period * e.count)}` : ''}` });
	}
	return kv;
}

function onHitBlocks(w: LevelWeapon): CellBlock[] {
	return (w.applies ?? []).map((a) => ({
		title: a.name,
		...(a.id ? { href: `/effects/${encodeURIComponent(a.id)}` } : {}),
		...(a.icon ? { icon: a.icon } : {}),
		note: ['on hit', a.chance ? `${pct(a.chance)} chance` : '', a.dur ? `${a.dur} s` : '', a.req ? `with ${a.req}` : '', a.cond ?? '']
			.filter(Boolean)
			.join(' · '),
		items: a.effects
	}));
}

function weaponText(w: LevelWeapon): string {
	return `${w.name}: ${weaponFacets(w).map((x) => `${x.k} ${x.v}`).join(', ')}${onHitBlocks(w)
		.map((b) => `; ${b.title}: ${b.items.join(', ')}`)
		.join('')}`;
}

/**
 * The weapon an ammo mode swaps in. The same weapon on every level is one nested
 * key/value table, written once across the levels; a weapon that changes with the
 * level (the Prototype's shot modes) becomes a row per facet, so what a level changes
 * shows as changed.
 */
function weaponRows(rows: LevelStats[]): StatRow[] {
	const withW = rows.filter((r) => r.weapon);
	if (!withW.length) return [];
	const same = withW.every((r) => weaponText(r.weapon!) === weaponText(withW[0].weapon!));
	if (same || rows.length === 1) {
		return [
			{
				label: 'Weapon',
				icon: 'damage',
				cells: rows.map((r) =>
					r.weapon
						? {
								text: weaponText(r.weapon),
								nested: { title: r.weapon.name, note: 'while on', kv: weaponFacets(r.weapon), blocks: onHitBlocks(r.weapon) }
							}
						: null
				)
			}
		];
	}
	const facet = (note: string, f: (w: LevelWeapon) => Cell | null): StatRow => ({
		label: 'Weapon',
		note,
		icon: 'damage',
		cells: rows.map((r) => (r.weapon ? f(r.weapon) : null))
	});
	const keys = [...new Set(withW.flatMap((r) => weaponFacets(r.weapon!).map((x) => x.k)))];
	const out: StatRow[] = [
		facet('while on', (w) => ({ text: w.name })),
		...keys.map((k) =>
			facet(k, (w) => {
				const x = weaponFacets(w).find((y) => y.k === k);
				return x ? { text: x.v, ...(x.tags ? { tags: x.tags } : {}) } : null;
			})
		),
		facet('on hit', (w) => {
			const blocks = onHitBlocks(w);
			return blocks.length ? { text: blocks.map((b) => `${b.title}: ${b.items.join(', ')}`).join('\n'), blocks } : null;
		})
	];
	return out.filter((d) => d.cells.some(Boolean));
}

function cooldownCell(r: LevelStats): Cell | null {
	if (r.cd != null) return { text: sec(r.cd), ...(r.cdShared ? { sub: 'shared' } : {}) };
	if (r.charges?.regen) {
		return { text: sec(r.charges.regen), ...(r.charges.max > 1 ? { sub: 'per charge' } : {}) };
	}
	return null;
}

const plain = (v: number | undefined, f: (n: number) => string): Cell | null =>
	v == null ? null : { text: f(v) };

/**
 * A toggle's effects, one row per stat: the extractor writes them as short phrases
 * ("+4 dexterity", "weapon range +1", "attack speed ×2"), and the phrase says which
 * stat it is. A combined attribute gain ("+2 fitness, mechanical, dexterity") splits
 * into a row per attribute. Whatever no rule names stays under Effect.
 */
const MOD_KINDS: [RegExp, string, StatIconName][] = [
	[/ on (units within|the target)\b/, 'Aura', 'sparkle'],
	[/^removes /, 'Removes', 'remove'],
	[/^shares sight|^radar |^detects /, 'Sight', 'sight'],
	[/\bfitness\b/, 'Fitness', 'fitness'],
	[/\bmechanical\b/, 'Mechanical', 'mechanical'],
	[/\bdexterity\b/, 'Dexterity', 'range'],
	[/^weapon range/, 'Weapon range', 'range'],
	[/^move speed/, 'Move speed', 'speed'],
	[/^attack speed/, 'Attack speed', 'firerate'],
	[/dmg|damage/, 'Damage', 'damage'],
	[/energy regen/, 'Energy regen', 'regen'],
	[/life regen/, 'Life regen', 'regen'],
	[/\bshields?\b/, 'Shields', 'armor'],
	[/\barmor\b/, 'Armor', 'armor'],
	[/\blife\b/, 'Life', 'life'],
	[/\benergy\b/, 'Energy', 'energy'],
	[/^sight/, 'Sight', 'sight'],
	[/dodge|take .* less/, 'Defence', 'armor'],
	[/^grants weapon/, 'Weapon', 'damage']
];

export function modKind(m: string): [string, StatIconName] {
	for (const [re, label, icon] of MOD_KINDS) if (re.test(m)) return [label, icon];
	return ['Effect', 'sparkle'];
}

/** The phrase without the stat the row already names: "+4 dexterity" → "+4", "attack speed ×2" → "×2". */
function bareValue(m: string, label: string): string {
	if (label === 'Effect' || label === 'Aura' || label === 'Removes') return m;
	const out = m
		.replace(/^(weapon range|move speed|attack speed|sight|energy regen|life regen)\s*/, '')
		.replace(/\s*\b(fitness|mechanical|dexterity|shields?|armor|life regen|energy regen|life|energy)\b\s*/, ' ')
		.replace(/\s*\bdmg\b\s*/, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return out || m;
}

/** "+2 fitness, mechanical, dexterity" → one phrase per attribute, so each gets its row. */
function splitMods(mods: string[]): string[] {
	return mods.flatMap((m) => {
		const g = m.match(/^([+−-]\d+(?:\.\d+)?) ((?:fitness|mechanical|dexterity)(?:, (?:fitness|mechanical|dexterity))+)$/);
		return g ? g[2].split(', ').map((a) => `${g[1]} ${a}`) : [m];
	});
}

function modRows(rows: LevelStats[]): StatRow[] {
	const kinds = new Map<string, { icon: StatIconName; cells: (string[] | null)[] }>();
	rows.forEach((r, i) => {
		for (const m of splitMods(r.mods ?? [])) {
			const [label, icon] = modKind(m);
			if (!kinds.has(label)) kinds.set(label, { icon, cells: rows.map(() => null) });
			const k = kinds.get(label)!;
			(k.cells[i] ??= []).push(m);
		}
	});
	return [...kinds].map(([label, k]) => ({
		label,
		icon: k.icon,
		cells: k.cells.map((c) => {
			if (!c) return null;
			const vals = c.map((m) => bareValue(m, label));
			// a bare number reads as one, right-aligned; a phrase keeps its lines
			return label === 'Effect' || vals.some((v) => v.length > 18)
				? { text: vals.join('\n'), lines: vals }
				: { text: vals.join('\n') };
		})
	}));
}

/** The table: every stat any level fills, one cell per level. */
export function statRows(rows: LevelStats[]): StatRow[] {
	const defs: [string, StatIconName, (r: LevelStats) => Cell | null][] = [
		['Energy', 'energy', (r) => plain(r.energy, fmt)],
		['Life', 'life', (r) => plain(r.life, fmt)],
		['Rounds', 'charges', (r) => plain(r.rounds, fmt)],
		['Magazines', 'bag', (r) => plain(r.magazines, fmt)],
		['Cooldown', 'clock', cooldownCell],
		[
			'Charges',
			'charges',
			(r) =>
				r.charges && r.charges.max > 1
					? { text: String(r.charges.max), ...(r.charges.use > 1 ? { sub: `fires ${r.charges.use}` } : {}) }
					: null
		],
		['Cast', 'cast', (r) => plain(r.cast, sec)],
		['Range', 'range', (r) => plain(r.range, fmt)],
		['Damage', 'damage', damageCell],
		['Bonus', 'bonus', (r) => (r.bonus?.length ? { text: bonusText(r.bonus) } : null)],
		['Over time', 'burn', extraCell],
		['Applies', 'sparkle', appliesCell],
		[
			'Spawns',
			'type',
			(r) => {
				if (!r.spawns?.length) return null;
				const parts = r.spawns.map((s) => ({ text: `${s.name}${s.n > 1 ? ` × ${s.n}` : ''}`, unit: s.id }));
				const facts = r.spawns
					.map((s) =>
						[s.life ? `lasts ${sec(s.life)}` : '', s.sight ? `sight ${fmt(s.sight)}` : '', ...(s.traits ?? [])]
							.filter(Boolean)
							.join(', ')
					)
					.filter(Boolean);
				return { text: parts.map((p) => p.text).join(', '), parts, ...(facts.length ? { sub: facts.join(' · ') } : {}) };
			}
		],
		['Vitals', 'regen', (r) => (r.vitals?.length ? { text: r.vitals.join(', '), lines: r.vitals } : null)],
		[
			'Reveals',
			'sight',
			(r) =>
				r.reveal
					? {
							text: r.reveal.map
								? 'the whole map'
								: `radius ${fmt(r.reveal.r)}${r.reveal.dur ? ` for ${sec(r.reveal.dur)}` : ''}`,
							...(r.reveal.detects ? { sub: 'detects hidden units' } : {})
						}
					: null
		],
		[
			'Removes',
			'remove',
			(r) =>
				r.removes?.length
					? {
							text: r.removes.join(', '),
							parts: r.removes.map((n, i) => ({
								text: n,
								...(r.removeIds?.[i] ? { href: `/effects/${encodeURIComponent(r.removeIds[i])}` } : {}),
								...(r.removeIcons?.[i] ? { icon: r.removeIcons[i]! } : {})
							}))
						}
					: null
		],
		['Effect', 'sparkle', () => null],
		['Sets', 'bonus', (r) => (r.sets?.length ? { text: r.sets.join('\n'), lines: r.sets } : null)],
		['Duration', 'clock', (r) => plain(r.dur, sec)]
	];
	const out: StatRow[] = [];
	for (const [label, icon, f] of defs) {
		const cells = rows.map(f);
		if (cells.some(Boolean)) out.push({ label, icon, cells });
		if (label === 'Bonus') out.push(...ringRows(rows)); // the rings sit under the hit they scale
		if (label === 'Effect') {
			out.push(...modRows(rows)); // a toggle's effects, one row per stat
			out.push(...weaponRows(rows)); // an ammo mode's weapon, under the mode's own effect
		}
	}
	return out;
}

/** The column header of a row: its level, or the tree level that rewrote it. */
export function columnLabel(r: LevelStats, rows: LevelStats[]): string {
	if (r.tree) return `+${r.treeLevel}`;
	return rows.some((x) => x.tree) ? 'Base' : `Lv ${r.lv}`;
}

/** A cell that differs from the level before — what the level bought. */
export function changed(cells: (Cell | null)[], i: number): boolean {
	if (i === 0) return false;
	const a = cells[i];
	const b = cells[i - 1];
	return !!a && (!b || a.text !== b.text || a.sub !== b.sub);
}

export interface FootNote {
	lead: string;
	text: string;
}

export function footNotes(rows: LevelStats[], treeNames: Record<string, string> = {}): FootNote[] {
	const out: FootNote[] = [];
	if (rows.some((r) => r.allies)) {
		out.push({ lead: 'Friendly fire', text: 'the area damage also hits allies.' });
	}
	const tree = rows.find((r) => r.tree);
	if (tree) {
		out.push({
			lead: 'Columns',
			text: `the base numbers, then with ${treeNames[tree.tree!] ?? tree.tree} at each level.`
		});
	}
	if (rows.some((r) => r.viaScript)) {
		out.push({
			lead: 'From the script',
			text: 'the command itself carries no effect; these are the behaviours the map script puts on you when it is used.'
		});
	}
	if (rows.some((r) => r.inferred)) {
		out.push({
			lead: 'Linked by name',
			text: "the ability's effect slot is empty in the map data; these are the numbers of the effect that carries its name."
		});
	}
	return out;
}
