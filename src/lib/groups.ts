/**
 * The trigger groups, as the extractor cut them from the map script.
 *
 * The script has no mission objects, only triggers; what a player meets as
 * one thing is a handful of them: a mission, a mechanic like the MULE, a
 * timed event. `group_missions` in uar/extract_flow.py finds them from how
 * triggers arm each other and what they work on, and types each one:
 *
 *   mission   awards or fails an outcome, or creates an objective
 *   mechanic  fired by what a player does (an ability, a selection, a chat)
 *   event     fired by the clock
 *   world     fired by units and regions
 *
 * This file is the small, client-safe list: name, type, trigger ids, the
 * outcomes and what armed it. The triggers themselves, with everything they
 * reference, stay on the server (`$lib/server/triggers`).
 *
 * Relative import only: the test reads this with plain node.
 */
import raw from './data/groups.json' with { type: 'json' };

export type GroupType = 'mission' | 'mechanic' | 'event' | 'world';

/** In the order the index shows them, missions first. */
export const GROUP_TYPES: { type: GroupType; label: string; plural: string; blurb: string }[] = [
	{ type: 'mission', label: 'mission', plural: 'Missions', blurb: 'awards or fails an outcome, or sets an objective' },
	{ type: 'mechanic', label: 'mechanic', plural: 'Mechanics', blurb: 'run by what a player does: an ability, a selection, a command' },
	{ type: 'event', label: 'event', plural: 'Events', blurb: 'run by the clock' },
	{ type: 'world', label: 'world', plural: 'World', blurb: 'run by units and regions, with nothing to win or lose' }
];

export interface GroupOutcome {
	/** The outcome string's id in the script; one text can stand for several ids, paid differently. */
	id: string;
	name: string;
	/** XP on success, or null when this is the failure line. */
	xp: number | null;
	/** XP lost on failure, or null when this is the success line. */
	fail: number | null;
}

export interface TriggerGroup {
	id: string;
	name: string;
	type: GroupType;
	/** Trigger ids in the script, in script order. */
	triggers: string[];
	outcomes: GroupOutcome[];
	/** Triggers outside the group that arm one of its triggers. */
	armedBy: { id: string; name: string }[];
}

export const groups: TriggerGroup[] = raw as TriggerGroup[];
export const groupById = new Map(groups.map((g) => [g.id, g]));
/** The group a trigger belongs to, for linking one group's context to another. */
export const groupOfTrigger = new Map(groups.flatMap((g) => g.triggers.map((t) => [t, g.id])));

export const groupIds: string[] = groups.map((g) => g.id);
export const groupHref = (id: string) => `/triggers/${id}`;

export function hasGroup(id: string): boolean {
	return groupById.has(id);
}

/** The success XP a group can pay, at most; 0 when it pays nothing. */
export function groupXp(g: TriggerGroup): number {
	return Math.max(0, ...g.outcomes.map((o) => o.xp ?? 0));
}
