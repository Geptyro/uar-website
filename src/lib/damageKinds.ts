/**
 * Damage kinds: Ranged, Spell, Splash, Melee. A buff that raises damage raises one
 * kind (X-rays and Veteran: ranged; Whiz Kid: spell), so the kind of a hit says
 * which buffs reach it. The extractor reads it off every damage effect; one that
 * names none is Spell, the engine's default.
 *
 * A hit the script deals from a dummy unit it drops on the target (Orbital Strike)
 * is the dummy's, not the hero's: the hero's buffs reach it only when the script
 * copies them onto the dummy, which it does for Whiz Kid.
 *
 * Dependency-free so node:test can load it (tests/damageKinds.test.ts).
 */

export type DamageKind = 'Ranged' | 'Spell' | 'Splash' | 'Melee';

/** One kind a buff changes: a share of the damage (`frac`) or a flat amount per hit. */
export interface KindMod {
	kind: string;
	frac?: number;
	flat?: number;
}

/** A buff as the hints and lists name it: an SI's, with the behaviour it puts on. */
export interface KindSource {
	name: string;
	behavior?: string;
	dmgKinds?: KindMod[];
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

/** "+30%" for a share, "+5" for a flat amount. */
export function modText(m: KindMod): string {
	if (m.frac != null) return `${m.frac > 0 ? '+' : '−'}${Math.round(Math.abs(m.frac) * 100)}%`;
	const v = m.flat ?? 0;
	return `${v > 0 ? '+' : '−'}${fmt(Math.abs(v))}`;
}

/** "+30% spell damage", "+5 ranged damage per hit". */
export function modLine(m: KindMod): string {
	return `${modText(m)} ${m.kind.toLowerCase()} damage${m.flat != null ? ' per hit' : ''}`;
}

/** The SIs that raise a kind, as "Whiz Kid +30%". */
export function raisers(kind: string, sources: KindSource[]): string[] {
	return sources.flatMap((s) =>
		(s.dmgKinds ?? [])
			.filter((m) => m.kind === kind && (m.frac ?? m.flat ?? 0) > 0)
			.map((m) => `${s.name} ${modText(m)}`)
	);
}

/** What a dummy's hit is given of the hero's buffs, by name. */
function carriedNames(carries: string[], sources: KindSource[]): string[] {
	return carries.map((b) => sources.find((s) => s.behavior === b)?.name ?? b);
}

/**
 * The card under a kind tag: what the kind means for buffs, which SIs raise it,
 * and for a dummy's hit, that the hero's buffs stop at the dummy.
 */
export function kindHint(kind: string, sources: KindSource[], dummy = false, carries: string[] = []): string {
	const word = kind.toLowerCase();
	const out = [`A buff raises one kind of damage: only those for ${word} damage raise this hit.`];
	const r = raisers(kind, sources);
	out.push(r.length ? `SIs that do: ${r.join(', ')}.` : 'No SI raises it.');
	if (dummy) {
		const kept = carriedNames(carries, sources);
		out.push(
			'The map deals this hit from a unit it drops on the target, not from you, so your buffs stop there' +
				(kept.length ? `, except ${kept.join(' and ')}, which the map copies onto it.` : '.')
		);
	}
	return out.join(' ');
}

/* ---------- a class's damage, line by line, for "what does this buff raise" ---------- */

interface ExtraLike {
	id: string;
	kind?: string;
	/** The kind the units around the target take, when the hit has an area. */
	splashKind?: string;
	period?: number;
	count?: number;
	cond?: string;
	/** Set on a tree row: the class weapon's own branch, already listed under the weapon. */
	weapon?: string;
}

interface HitLike {
	dmg?: number | null;
	kind?: string;
	/** The kind the units around the target take: a field of its own, not the hit's kind. */
	splashKind?: string;
	cond?: string;
	extra?: ExtraLike[];
}

export interface WeaponLike extends HitLike {
	id: string;
	name?: string;
	/** A module the script swaps in once this tree is learned. */
	tree?: string;
}

export interface RowLike extends HitLike {
	lv: number;
	dummy?: boolean;
	carries?: string[];
	/** An ammo mode's weapon. */
	weapon?: WeaponLike & { name: string };
}

export interface AbilityLike {
	id: string;
	name: string;
	/** skill tree or standard ability: where its card sits on the class page */
	section: 'skill' | 'cmd';
}

/** Which part of a source's damage a line is, besides the direct hit. */
/* "area", not "splash": Splash is also a damage kind, and the area of a ranged hit is often spell */
export type Facet = 'area' | 'over time' | 'second hit';

/** One hit a class deals: what fires it, which part of it, its kind. */
export interface DamageLine {
	source: string;
	/** Under the class page: `#skill-…`, `#cmd-…`, or the gear tab for a weapon. */
	href: string;
	kind: string;
	/** The branch it is on: "Grenade Launcher 4" (Plasma Grenades). */
	cond?: string;
	/** Absent for the direct hit. */
	facet?: Facet;
	/** An ammo mode's gun, when the line is one. */
	gun?: string;
	dummy?: boolean;
	carries?: string[];
}

/**
 * Every hit of a weapon: the direct one, the splash on the units around the target
 * (its own kind: the RJX grenade hits ranged and splashes spell), and each branch.
 */
export function hitLines(h: HitLike, source: string, href: string, extra: Partial<DamageLine> = {}): DamageLine[] {
	const out: DamageLine[] = [];
	const cond = (c?: string) => (c ? { cond: c } : {});
	if (h.dmg != null && h.kind) {
		out.push({ source, href, kind: h.kind, ...cond(h.cond), ...extra });
		if (h.splashKind) out.push({ source, href, kind: h.splashKind, ...cond(h.cond), facet: 'area', ...extra });
	}
	for (const e of h.extra ?? []) {
		if (e.weapon || !e.kind) continue;
		// a burn lasts (a second or more); a quick volley is the same hit repeated, and a branch
		// behind a condition is another version of the hit, not a second one
		const lasts = !!e.period && !!e.count && e.period * e.count >= 1;
		const facet: Facet | undefined = lasts ? 'over time' : e.cond || e.count ? undefined : 'second hit';
		out.push({ source, href, kind: e.kind, ...cond(e.cond), ...(facet ? { facet } : {}), ...extra });
		if (e.splashKind) out.push({ source, href, kind: e.splashKind, ...cond(e.cond), facet: 'area', ...extra });
	}
	return out;
}

/**
 * A class's damage as lines: its weapons (issued and the modules a tree swaps in),
 * then every skill and command that hits, each level read, the same line once.
 */
export function classLines(
	base: string,
	weapons: WeaponLike[],
	abilities: AbilityLike[],
	rows: Record<string, RowLike[]>
): DamageLine[] {
	const out: DamageLine[] = [];
	const seen = new Set<string>();
	const add = (l: DamageLine) => {
		const key = [l.source, l.gun, l.cond, l.facet, l.kind, l.dummy ? 1 : 0].join('|');
		if (!seen.has(key)) {
			seen.add(key);
			out.push(l);
		}
	};
	for (const w of weapons) hitLines(w, w.name ?? w.id, `${base}/gear`).forEach(add);
	for (const a of abilities) {
		const href = `${base}#${a.section}-${a.id}`;
		for (const r of rows[a.id] ?? []) {
			const extra = { ...(r.dummy ? { dummy: true } : {}), ...(r.carries?.length ? { carries: r.carries } : {}) };
			hitLines(r, a.name, href, extra).forEach(add);
			// an ammo mode's gun: its hits are the ability's, named after the gun
			if (r.weapon) hitLines(r.weapon, a.name, href, { gun: r.weapon.name }).forEach(add);
		}
	}
	return out;
}

/** Does this buff (its id and the kinds it changes) reach the hit? */
export function reaches(line: DamageLine, buffId: string, kinds: Set<string>): boolean {
	if (!kinds.has(line.kind)) return false;
	return !line.dummy || (line.carries ?? []).includes(buffId);
}

/** One or more lines of a source as a chip: "Punisher Grenades · area". */
export interface LineChip {
	label: string;
	href: string;
	kind: string;
	/** Of the right kind, but dealt by a dummy the buff is not copied onto. */
	dummy?: boolean;
}

/**
 * Lines as chips, one per source, branch and kind. The direct hit's chip is the source's
 * name, and the area or burn of the same kind goes with it; any other chip says what
 * it is: "Punisher Grenades · area" (spell, around the ranged hit), "Punisher Grenades
 * · if Grenade Launcher 4: area, over time".
 */
export function chips(lines: DamageLine[]): LineChip[] {
	const by = new Map<string, { l: DamageLine; facets: Facet[]; direct: boolean }>();
	for (const l of lines) {
		const key = [l.source, l.gun, l.cond, l.kind, l.dummy ? 1 : 0].join('|');
		const g = by.get(key) ?? { l, facets: [], direct: false };
		if (!l.facet) g.direct = true;
		else if (!g.facets.includes(l.facet)) g.facets.push(l.facet);
		by.set(key, g);
	}
	return [...by.values()].map(({ l, facets, direct }) => {
		const head = [l.gun, l.cond ? `if ${l.cond}` : ''].filter(Boolean).join(', ');
		const tail = direct ? '' : facets.join(', ');
		const label = !head && !tail ? l.source : `${l.source} · ${[head, tail].filter(Boolean).join(': ')}`;
		return { label, href: l.href, kind: l.kind, ...(l.dummy ? { dummy: true } : {}) };
	});
}

/** A class's lines split by whether the buff reaches them. */
export function split(lines: DamageLine[], buffId: string, kinds: Set<string>): { raised: LineChip[]; not: LineChip[] } {
	const raised = lines.filter((l) => reaches(l, buffId, kinds));
	const not = lines.filter((l) => !reaches(l, buffId, kinds));
	return { raised: chips(raised), not: chips(not) };
}
