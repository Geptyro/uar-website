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
	/** Reloads before the magazine is empty, under this many rounds, in the stance the class page names. */
	earlyReload: { below: number } | null;
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

/** One step of the carry cap: readied magazines past `cap + over` put `behavior` on the hero. */
export interface EncumbranceTier {
	over: number | null;
	behavior: string | null;
	/** share of move speed taken away; 1 is a full stop */
	slow: number | null;
}

/** The magazine economy, as the map script runs it. Nulls are parses that failed. */
export interface AmmoRules {
	/** readied magazines on picking a class: the common value, and the classes given more */
	start: { default: number | null; more: Record<string, number> };
	/** readied magazines on respawning at a reinforcement point */
	respawn: number | null;
	/** the class that burns fuel on the same counter, with its own numbers */
	fuel: { mos: string[]; start: number | null; cap: number | null; tiers: EncumbranceTier[] };
	/** magazines one use of a pack or a case readies */
	perUse: number | null;
	/** the Magazines item: catalog charges, and the uses left on one the script drops or airdrops */
	pack: { start: number | null; max: number | null; ground: number | null; airdrop: number | null };
	case: { start: number | null; max: number | null };
	magsPerReload: number | null;
	/** the low-ammo tone plays at mag / this */
	lowAmmoAt: number | null;
	cap: number | null;
	tiers: EncumbranceTier[];
	/** Drop Magazine takes this many readied and puts them in a pack */
	dropMags: number | null;
	/** on death, one pack per this many readied */
	deathDropPer: number | null;
	dropmagsPause: number | null;
	spawn: {
		first: number | null;
		every: number | null;
		packs: { base: number; perPlayers: number } | null;
		cases: number | null;
		skipMode: number | null;
	};
	/** low and high of the random count each weapon cache spawns */
	cache: { packs: number[] | null; cases: number[] | null };
	/** the Skill Identifier that multiplies the cap */
	combatLoad: { si: number; mult: number } | null;
}

export interface Rules {
	/** The highest hero level, and the skill points each level gives (see $lib/builds). */
	levels: { max: number; pointsPerLevel: number };
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
		/** every class reloads on its own once the magazine is empty and it fires again */
		autoWhenDry: boolean;
		autoExcluded: string[];
		soldierSkills: { base: number; perLevel: number } | null;
	};
	ammo: AmmoRules;
	groups: MechanicGroup[];
}

const raw = rawMechanics as { rules: Rules; mos: MosMechanics[] };

export const rules: Rules = raw.rules;

/** The most skill points a hero can spend: one per level, the first at level 1, up to the cap. */
export const skillPoints: number = rules.levels.max * rules.levels.pointsPerLevel;
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
