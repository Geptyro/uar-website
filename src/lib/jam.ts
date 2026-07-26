// Weapon-jam arithmetic, mirroring the map's Jam trigger. Kept free of imports so
// plain `node --test` can load it — $lib/mechanics re-exports these for site code.
//
// Each shot rolls two independent checks and jams only if both hit:
//   1. RandomInt(0, magSize) == 1   -> a 1/(magSize+1) gate
//   2. RandomInt(0, odds) == 1      -> a 1/(odds+1) confirm, where `odds` shrinks
//      the longer the player has gone without jamming (so the risk grows).
// The mag size used is the one set when the class spawned, which no reload ever
// updates — weapon swaps and Magazine Extender change how much ammo you carry, not
// how likely a jam is.

export interface PityStep {
	/** seconds since this player's last jam */
	after: number;
	/** RandomInt bound once that much time has passed — lower means likelier */
	odds: number;
}

/** Odds bound in effect `seconds` after the player's last jam. */
export function oddsAfter(pity: PityStep[], defaultOdds: number, seconds: number): number {
	// steps are checked high-to-low, matching the trigger's if/else-if chain
	const hit = [...pity].sort((a, b) => b.after - a.after).find((s) => seconds > s.after);
	return hit ? hit.odds : defaultOdds;
}

/** Chance that a single shot jams, given the spawn mag size and an odds bound. */
export function jamChance(magSize: number, odds: number): number {
	return 1 / (magSize + 1) / (odds + 1);
}

/**
 * Best and worst per-shot jam chance for a class: `min` right after a jam, `max`
 * once the pity timer has run all the way out.
 */
export function jamChanceRange(
	magSize: number,
	pity: PityStep[],
	defaultOdds: number
): { min: number; max: number } {
	const bounds = [defaultOdds, ...pity.map((s) => s.odds)];
	return {
		min: jamChance(magSize, Math.max(...bounds)),
		max: jamChance(magSize, Math.min(...bounds))
	};
}

/** Expected shots between jams at a given per-shot chance. */
export function shotsPerJam(chance: number): number {
	return chance > 0 ? 1 / chance : Infinity;
}
