import rawUnits from '$lib/data/units.json';

export interface Weapon {
	id: string;
	dmg: number | null;
	range: number | null;
	period: number | null;
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
