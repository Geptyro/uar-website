import raw from '$lib/data/refs.json';

/**
 * Which triggers of the map's script name a unit — the reverse index of the
 * trigger graph, built by extract_refs.py from MapScript.galaxy. A trigger
 * names a unit through a string literal in a spawn call or a unit-type test,
 * through a global unit variable the script binds to a spawned unit, or
 * through an event registered on that variable.
 *
 * Server-side only (entities/[id]/+page.server.ts): thousands of references
 * for hundreds of units, and a page needs its own handful. The trigger's own
 * name and events are joined from triggers.json there, not repeated here.
 */

export type RefRole = 'spawns' | 'event' | 'removes' | 'uses';

export interface RefRow {
	/** Trigger id, as in triggers.json / flow.json. */
	t: string;
	roles: RefRole[];
	/** The gf_ helper the reference sits in, when it is not in the trigger's own body. */
	via: string | null;
}

const data = raw as Record<string, RefRow[]>;

export function scriptRefs(unitId: string): RefRow[] {
	return data[unitId] ?? [];
}

export const roleLabel: Record<RefRole, string> = {
	spawns: 'spawns it',
	event: 'listens to it',
	removes: 'removes it',
	uses: 'mentions it'
};
