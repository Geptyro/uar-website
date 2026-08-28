import rawUnits from '$lib/data/units.json';

/** A buff/debuff a weapon applies on hit, from its effect tree. */
export interface WeaponApply {
	name: string;
	effects: string[];
	/** Duration in seconds; absent = permanent/instant. */
	dur?: string;
	/** Only procs when this validator passes (upgrade tier, weapon variant…). */
	cond?: string;
	/** Applied to the shooter, not the target (e.g. reload slows). */
	self?: boolean;
}

/** One splash ring: `f` of the damage inside radius `r`; `arc` when it is a cone. */
export interface SplashRing {
	r: number;
	f: number;
	arc?: number;
}

/** A damage effect in the weapon's tree other than the direct hit. */
export interface ExtraDamage {
	id: string;
	dmg: number;
	/** Validator gating the branch (an upgrade, the shooter's class…). */
	cond?: string;
	/** Set when it is the tick of a persistent: seconds between ticks, number of ticks. */
	period?: number;
	count?: number;
}

export interface Weapon {
	id: string;
	/** Direct-hit damage; null only when no damage effect could be read at all. */
	dmg: number | null;
	range: number | null;
	period: number | null;
	/** The direct hit is on a gated branch (no unconditional damage exists). */
	cond?: string;
	/** Roll added on top of `dmg`: the game deals dmg + 0…random. */
	random?: number;
	/** Target armor ignored. */
	armor?: number;
	/** Melee / Splash / Spell; absent for the usual Ranged. */
	kind?: string;
	bonus?: { attr: string; value: number }[];
	splash?: SplashRing[];
	/** The hit is a persistent that lands this many times. */
	hits?: number;
	extra?: ExtraDamage[];
	applies?: WeaponApply[];
}

function fmt(n: number): string {
	return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

/** Percentage from a fraction, e.g. 0.5 → "50%". */
function pct(f: number): string {
	return `${Math.round(f * 100)}%`;
}

/**
 * The damage facets behind the one number, as short phrases: the roll on top,
 * armor bypassed, attribute bonuses, splash rings, multi-hit, and every other
 * damage branch the effect tree carries. Empty for a plain single hit.
 */
export function damageNotes(w: Weapon): string[] {
	const out: string[] = [];
	if (w.dmg === null) return out;
	if (w.cond) out.push(`only if ${w.cond}`);
	if (w.random) out.push(`+0–${fmt(w.random)} roll`);
	if (w.hits && w.hits > 1) out.push(`×${w.hits} hits`);
	if (w.armor) out.push(`ignores ${fmt(w.armor)} armor`);
	// the ring list already says splash; the kind word is for melee/spell
	if (w.kind && !(w.kind === 'Splash' && w.splash?.length)) out.push(w.kind.toLowerCase());
	for (const b of w.bonus ?? []) out.push(`${b.value > 0 ? '+' : ''}${fmt(b.value)} vs ${b.attr}`);
	if (w.splash?.length) {
		const rings = w.splash
			.map((s) => `${pct(s.f)} within ${fmt(s.r)}${s.arc ? ` (${s.arc}° cone)` : ''}`)
			.join(', ');
		out.push(`splash: ${rings}`);
	}
	for (const e of w.extra ?? []) {
		let s = `${fmt(e.dmg)}`;
		if (e.period !== undefined && e.count) s += ` every ${fmt(e.period)}s ×${e.count}`;
		else if (e.count) s += ` ×${e.count}`;
		s += ` ${e.id}`;
		if (e.cond) s += ` (if ${e.cond})`;
		out.push(s);
	}
	return out;
}

/** One-line rendering of an on-hit apply, e.g. "Napalm Burn: 3 dmg every 0.2s — 6s (if Napalm1)". */
export function applyText(a: WeaponApply): string {
	let s = `${a.name}: ${a.effects.join(', ')}`;
	if (a.dur) s += ` — ${a.dur}s`;
	if (a.cond) s += ` (if ${a.cond})`;
	if (a.self) s += ' (self)';
	return s;
}

/** A documented ability on a non-class unit, from abilities.json (server-side only). */
export interface UnitAbility {
	id: string;
	name: string;
	tooltip: string;
	icon: string | null;
}

export interface Unit {
	id: string;
	name: string;
	category: string;
	mos: string;
	role: string;
	life: number | null;
	armor: number | null;
	speed: number | null;
	energy: number | null;
	regen: number | null;
	sight: number | null;
	parent: string;
	src: string;
	weapons: Weapon[];
	icon: string | null;
	tooltip: string;
	/** The unit this pickup becomes once used (a Claymore2 crate is placed as a Claymore): the
	 *  site folds the pickup into that unit's page. */
	deploys?: string;
	/** The pickup units that turn into this one. */
	pickups?: string[];
}

export const units: Unit[] = rawUnits as Unit[];

/** Entities as the site lists them: one per thing, the pickup forms folded into what they deploy. */
export const listedUnits: Unit[] = units.filter((u) => !u.deploys);

export const unitById = new Map(units.map((u) => [u.id, u]));

export const categoryOrder = [
	'MOS (player class)',
	'undead / hostile',
	'deployable / drone',
	'item / equipment',
	'projectile',
	'structure / prop',
	'other / NPC',
	'civilian / NPC'
];

export const categories = categoryOrder.filter((c) => units.some((u) => u.category === c));

export function categoryCount(cat: string): number {
	return units.filter((u) => u.category === cat).length;
}

export function tagClass(cat: string): string {
	if (cat.startsWith('MOS')) return 't-mos';
	if (cat.startsWith('undead')) return 't-hostile';
	if (cat.startsWith('item')) return 't-item';
	return 't-other';
}

export function weaponLabel(w: Weapon): string {
	return `${w.id} (dmg ${w.dmg ?? '?'} · rng ${w.range ?? '?'} · ${w.period ?? '?'}s)`;
}
