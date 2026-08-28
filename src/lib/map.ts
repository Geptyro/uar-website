import rawMap from '$lib/data/map.json';
import type { MapTone } from '$lib/components/map/context';

export interface MapRegion {
	id: number;
	name: string;
	type: 'rect' | 'circle' | 'diamond';
	x1?: number;
	y1?: number;
	x2?: number;
	y2?: number;
	cx?: number;
	cy?: number;
	r?: number;
	w?: number;
	h?: number;
}

export const mapSize: number = (rawMap as { size: number }).size;
export const mapRegions: MapRegion[] = (rawMap as { regions: MapRegion[] }).regions;

export type RegionCategory =
	| 'landing zone'
	| 'objective site'
	| 'cache'
	| 'defense'
	| 'settlement'
	| 'boundary'
	| 'other';

const CATEGORY_RULES: [RegExp, RegionCategory][] = [
	[/^(west|south|east|north)$/i, 'boundary'],
	[/^lz\b|landing/i, 'landing zone'],
	[/cache|scraps|supply/i, 'cache'],
	[/tower|tcp|firing line|barricade|defense|checkpoint|op\b|outpost/i, 'defense'],
	[/city|village|crops|farm|house|mayor|silo|thalim/i, 'settlement'],
	[/launch|generator|antenna|sensor|camera|computer|station|site|exit|escort|convoy|gate/i, 'objective site']
];

export function regionCategory(r: MapRegion): RegionCategory {
	for (const [re, cat] of CATEGORY_RULES) {
		if (re.test(r.name)) return cat;
	}
	return 'other';
}

export function regionSizeLabel(r: MapRegion): string {
	if (r.type === 'rect')
		return `${Math.round((r.x2 ?? 0) - (r.x1 ?? 0))}×${Math.round((r.y2 ?? 0) - (r.y1 ?? 0))}`;
	if (r.type === 'circle') return `r ${Math.round(r.r ?? 0)}`;
	return `${Math.round(r.w ?? 0)}×${Math.round(r.h ?? 0)}`;
}

export function regionCenter(r: MapRegion): { x: number; y: number } {
	if (r.type === 'rect')
		return { x: ((r.x1 ?? 0) + (r.x2 ?? 0)) / 2, y: ((r.y1 ?? 0) + (r.y2 ?? 0)) / 2 };
	return { x: r.cx ?? 0, y: r.cy ?? 0 };
}

/** Each kind of region in one of the palette's tones, for AoMap's markers. */
export const categoryTones: Record<RegionCategory, MapTone> = {
	'landing zone': 'lobby',
	'objective site': 'gold',
	cache: 'item',
	defense: 'hostile',
	settlement: 'mos',
	boundary: 'warn',
	other: 'accent'
};
