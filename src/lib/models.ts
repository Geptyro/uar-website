import raw from '$lib/data/models.json';

/**
 * The 3D models the site serves, per unit id (`static/models/*.glb`, hand-kept in
 * models.json). A unit has either one model or several looks, one per mode: the M1
 * Sentry Gun swaps its actor with the weapon mounted on it, so it is an AutoTurret,
 * a flame turret or a gas turret depending on the ability picked.
 */
export interface ModelVariant {
	/** Which look this is, as the picker names it; absent when a unit has one model. */
	label?: string;
	src: string;
}

const data = raw as Record<string, string | ModelVariant[]>;

export function modelVariants(unitId: string): ModelVariant[] {
	const entry = data[unitId];
	if (!entry) return [];
	return typeof entry === 'string' ? [{ src: entry }] : entry;
}
