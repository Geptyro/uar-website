import rawUnlocks from '$lib/data/unlocks.json';

export interface Medal {
	num: number;
	name: string;
	/** Tooltip from the medal dialog — describes how it is earned. */
	desc: string;
	icon: string | null;
	/** XP bonus granted on award (from the gf_AwardMedal calls; empty = none scripted). */
	xp: number[];
}

export interface Decal {
	num: number;
	name: string;
	req: string;
	icon: string | null;
}

export interface Camo {
	num: number;
	name: string;
	req: string;
	/** Also selectable on the FP500 Combat Walker. */
	walker: boolean;
	/** Armor diffuse texture straight from the game files (null = no fixed look). */
	swatch: string | null;
	/** OctoCamo: cycles terrain textures instead of a fixed pattern. */
	adaptive?: boolean;
}

export interface SpecialCamo {
	name: string;
	req: string;
	swatch: string | null;
	/** Lives in the "Walker only" row of the unlock dialog. */
	walkerOnly?: boolean;
	/** Walker searchlight color option. */
	light?: string;
}

const u = rawUnlocks as {
	medals: Medal[];
	decals: Decal[];
	clanDecals: Decal[];
	camos: Camo[];
	specialCamos: SpecialCamo[];
};

export const medals: Medal[] = u.medals;
export const decals: Decal[] = u.decals;
export const clanDecals: Decal[] = u.clanDecals;
export const camos: Camo[] = u.camos;
export const specialCamos: SpecialCamo[] = u.specialCamos;
