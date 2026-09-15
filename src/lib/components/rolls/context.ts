/**
 * What a roll's chips and cards need from the page without every variant passing
 * it down: the in-game text for each unit and effect a roll names (resolved on the
 * server, so units.json stays out of the client) and the ailment rules, for the
 * mode buttons' cards. Getters, so a page reused across effects reads the new data.
 */
import { getContext, setContext } from 'svelte';
import type { AilmentRules } from '$lib/rolls';

export interface RollsContext {
	/** Keyed `unit:<id>` and `effect:<id>`. */
	readonly tips: Record<string, string>;
	readonly rules: AilmentRules | null;
}

const KEY = Symbol('rolls');

export function setRolls(ctx: RollsContext): void {
	setContext(KEY, ctx);
}

export function getRolls(): RollsContext | undefined {
	return getContext<RollsContext | undefined>(KEY);
}
