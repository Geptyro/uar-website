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

export interface Weapon {
	id: string;
	dmg: number | null;
	range: number | null;
	period: number | null;
	applies?: WeaponApply[];
}

/** One-line rendering of an on-hit apply, e.g. "Napalm Burn: 3 dmg every 0.2s — 6s (if Napalm1)". */
export function applyText(a: WeaponApply): string {
	let s = `${a.name}: ${a.effects.join(', ')}`;
	if (a.dur) s += ` — ${a.dur}s`;
	if (a.cond) s += ` (if ${a.cond})`;
	if (a.self) s += ' (self)';
	return s;
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
}

export const units: Unit[] = rawUnits as Unit[];

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
