import rawMechanics from '$lib/data/mechanics.json';
import { jamChanceRange, oddsAfter, shotsPerJam, type PityStep } from '$lib/jam';

export { jamChance, jamChanceRange, oddsAfter, shotsPerJam, type PityStep } from '$lib/jam';

/** A magazine size that only applies while a particular weapon is carried. */
export interface MagVariant {
	/** behavior id of the weapon that changes it */
	weapon: string;
	mag: number;
	base: number;
}

export interface Ammo {
	/** magazine size set at spawn — null for the fuel-burning Flamethrower */
	mag: number | null;
	reload: number | null;
	/** true when the class never sets its own and inherits the global default */
	reloadIsDefault: boolean;
	variants: MagVariant[];
	autoReload: boolean;
	/** spawn paths that disagree about the mag size (a map bug worth flagging) */
	conflicts: { path: string; mag: number }[];
}

export interface Jam {
	immune: boolean;
	/** why it never jams: 'excluded' by the trigger, or it has 'no magazine' */
	reason: string | null;
	/** per-shot chance of reaching the second roll; null when immune */
	gate: number | null;
}

export interface PanelKey {
	/** e.g. "F1", "shift+F2" */
	key: string;
	label: string;
	/** the button's in-game tooltip body, when it has one beyond the name */
	desc: string | null;
	icon: string | null;
}

export interface MosMechanics {
	id: string;
	ammo: Ammo;
	jam: Jam;
	panel: PanelKey[];
	groups: string[];
}

export interface MechanicGroup {
	id: string;
	label: string;
	desc: string;
	members: string[];
}

export interface Rules {
	jam: {
		gateHit: number;
		defaultOdds: number;
		pity: PityStep[];
		excluded: string[];
		immunityBehaviors: string[];
		/** the jam roll keeps using the spawn mag size, whatever the class later carries */
		magFrozenAtSpawn: boolean;
		unjam: {
			failOdds: number;
			action: { min: number; max: number };
			remedial: { min: number; max: number };
			bonus: Record<string, number | null>;
		};
	};
	reload: {
		default: number | null;
		magExtenderMult: number | null;
		soldierSkills: { base: number; perLevel: number } | null;
	};
	groups: MechanicGroup[];
}

const raw = rawMechanics as { rules: Rules; mos: MosMechanics[] };

export const rules: Rules = raw.rules;
export const allMechanics: MosMechanics[] = raw.mos;
export const mechanicsById = new Map(allMechanics.map((m) => [m.id, m]));

export function mechanicsFor(mosId: string): MosMechanics | null {
	return mechanicsById.get(mosId) ?? null;
}

export function groupsFor(mosId: string): MechanicGroup[] {
	const ids = new Set(mechanicsFor(mosId)?.groups ?? []);
	return rules.groups.filter((g) => ids.has(g.id));
}

/** Per-shot jam chance range for a class, or null when it cannot jam. */
export function jamRangeFor(mosId: string): { min: number; max: number } | null {
	const m = mechanicsFor(mosId);
	if (!m || m.jam.immune || !m.ammo.mag) return null;
	return jamChanceRange(m.ammo.mag, rules.jam.pity, rules.jam.defaultOdds);
}

/** Seconds without a jam before the risk stops climbing. */
export const pityCap = Math.max(...rules.jam.pity.map((s) => s.after));

export function oddsAtSeconds(seconds: number): number {
	return oddsAfter(rules.jam.pity, rules.jam.defaultOdds, seconds);
}

export function magsPerJam(chance: number, mag: number): number {
	return shotsPerJam(chance) / mag;
}
