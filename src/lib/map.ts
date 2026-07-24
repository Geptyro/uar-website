import rawMissions from '$lib/data/missions.json';
import rawMap from '$lib/data/map.json';

export interface Mission {
	name: string;
	/** XP awarded on success (several values = difficulty/stage variants). */
	xp: number[];
	/** XP lost on failure. */
	fail: number[];
	/** Trigger names in the map script this mission is driven by. */
	triggers: string[];
	/** Region names its triggers listen on — real links from the trigger events. */
	regions: string[];
}

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

export const missions: Mission[] = rawMissions as Mission[];
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
	[/city|village|crops|farm|house|mayor|silo/i, 'settlement'],
	[/launch|generator|antenna|sensor|camera|computer|station|site|exit|escort|convoy|gate/i, 'objective site']
];

export function regionCategory(r: MapRegion): RegionCategory {
	for (const [re, cat] of CATEGORY_RULES) {
		if (re.test(r.name)) return cat;
	}
	return 'other';
}

const GENERIC_TOKENS = new Set(['the', 'and', 'zone', 'area', 'site', 'line', 'work', 'station']);

function tokens(name: string): string[] {
	return name
		.replace(/(?<=[a-z])(?=[A-Z])/g, ' ') // split camelCase (MayorGate)
		.toLowerCase()
		.replace(/\d+/g, ' ')
		.split(/[^a-z]+/)
		.filter((t) => t.length >= 4 && !GENERIC_TOKENS.has(t));
}

/**
 * Missions whose outcome text or source trigger mentions this region's name —
 * heuristic: mission↔region links are runtime state in the trigger script.
 * Tries a full-name match first, then falls back to partial token matches for
 * multi-word regions.
 */
export function relatedMissions(region: MapRegion): Mission[] {
	// real links first: missions whose triggers listen on this region
	const real = missions.filter((m) => m.regions.includes(region.name));
	if (real.length) return real;
	// fallback: name-based heuristic
	const toks = tokens(region.name);
	if (!toks.length) return [];
	const match = (pred: (hay: string) => boolean) =>
		missions.filter((m) => pred((m.name + ' ' + m.triggers.join(' ')).toLowerCase()));
	const strict = match((hay) => toks.every((t) => hay.includes(t)));
	if (strict.length || toks.length < 2) return strict;
	// partial fallback — discard when a generic token floods the results
	const loose = match((hay) => toks.some((t) => hay.includes(t)));
	return loose.length <= 8 ? loose : [];
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

export const categoryColors: Record<RegionCategory, string> = {
	'landing zone': '#7fb0e0',
	'objective site': '#e0b35c',
	cache: '#8fd08a',
	defense: '#d98a6d',
	settlement: '#c7a5e0',
	boundary: '#666',
	other: '#9aa08c'
};
