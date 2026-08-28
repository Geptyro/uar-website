/* flow.json is the mission-relevant subgraph. The Mission flow page that
   drew it is gone (folded into /triggers), but the entity pages still read
   `flowById` to know which of a unit's triggers has a page, so the data and
   these exports stay until they move to $lib/groups. */
import rawFlow from '$lib/data/flow.json';

export { triggerRole, type TriggerRole } from './triggerRole';

export interface FlowEvent {
	type: string;
	arg: string | number | null;
}

export interface FlowOutcome {
	/** The outcome string's id in the script (`EF9EAC5D`): one text can stand for several ids. */
	id: string;
	xp: number;
	name: string;
}

/** Something a trigger puts in front of the player, and the call that does. */
export interface TriggerShow {
	kind: 'mission' | 'message' | 'objective' | 'tag' | 'ping';
	text: string;
}

export interface MapPlace {
	x: number;
	y: number;
	name: string;
}

/**
 * What a trigger references in its own block. Only the full graph
 * (triggers.json, server-side) carries these; flow.json does not.
 */
export interface TriggerRefs {
	/** Region ids in map.json. */
	regions: number[];
	points: { id: number; name: string; x: number; y: number }[];
	/** Pre-placed units from the map's Objects file. */
	units: { id: number; type: string; x: number; y: number }[];
	/** Units (and props: an actor with no unit under it) the trigger creates, with where when the call names a place. */
	spawns: { type: string; kind: 'unit' | 'prop'; point?: number; region?: number }[];
	/** The named unit variables it works on: what the author calls them, and the unit they hold when the script says. */
	actors: { var: string; name: string; type: string | null }[];
	/** A stretch something may appear along: a random point between two places. */
	segments: { a: MapPlace; b: MapPlace; }[];
	/** A route: points in the order the script fills them or orders a unit along them. */
	paths: { var: string; name: string; points: { id: number; name: string; x: number; y: number }[] }[];
	/** Items it spawns through gf_SpawnItem. */
	items: string[];
	shows: TriggerShow[];
	pings: number;
	/** Unit-typed globals it works on (gv_mULE). */
	entities: string[];
	/** Boolean flags it sets / its conditions test, as `gv_x=true`. */
	sets: string[];
	tests: string[];
}

export interface FlowNode {
	id: string;
	name: string;
	events: FlowEvent[];
	/** false = starts disabled and must be enabled by another trigger. */
	armed: boolean;
	enables: string[];
	disables: string[];
	executes: string[];
	/** Triggers fired by timers this node starts. */
	timerTo: string[];
	timers: { var: string; dur: string }[];
	succeed: FlowOutcome[];
	fail: FlowOutcome[];
	refs?: TriggerRefs;
}

export const flowNodes: FlowNode[] = rawFlow as FlowNode[];
export const flowById = new Map(flowNodes.map((n) => [n.id, n]));

/** Triggers that enable, execute or (via a timer) fire the given node. */
export function upstream(id: string): FlowNode[] {
	return flowNodes.filter(
		(n) => n.enables.includes(id) || n.executes.includes(id) || n.timerTo.includes(id)
	);
}

export function fmtTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.round(seconds % 60);
	return `${m}:${String(s).padStart(2, '0')}`;
}

export function fmtDuration(expr: string): string {
	const rand = expr.match(/RandomFixed\(([\d.]+),\s*([\d.]+)\)/);
	if (rand) return `random ${fmtTime(+rand[1])}–${fmtTime(+rand[2])}`;
	const n = Number(expr);
	if (!Number.isNaN(n)) return fmtTime(n);
	return expr;
}

/** `ChooseCombatEngineer` → `Choose Combat Engineer`: an id read as words. */
const prettify = (id: string) => id.replace(/(?<=[a-z0-9])(?=[A-Z])/g, ' ');

export function eventLabel(e: FlowEvent): string {
	switch (e.type) {
		case 'TimeElapsed':
			return `at ${fmtTime(Number(e.arg))} game time`;
		case 'TimePeriodic':
			return `every ${fmtTime(Number(e.arg))}`;
		case 'UnitRegion':
			return e.arg === 'entire map' ? 'unit moves (anywhere)' : `unit enters ${e.arg}`;
		case 'UnitDied':
			return 'a unit dies';
		case 'UnitAbility':
			return e.arg ? `${prettify(String(e.arg))} is used` : 'an ability is used';
		case 'UnitSelected':
			return e.arg === 'deselected' ? 'the unit is deselected' : 'the unit is selected';
		case 'UnitBehaviorChange':
			return 'a behavior changes';
		case 'DialogControl':
			return 'dialog button clicked';
		case 'PlayerEffectUsed':
			return 'an effect is used';
		case 'ChatMessage':
			return e.arg ? `chat "${e.arg}"` : 'chat message';
		case 'Timer':
			return `timer ${String(e.arg ?? '').replace('gv_', '')} expires`;
		case 'UnitInventoryChange':
			return 'inventory changes';
		case 'UnitDamaged':
			return 'a unit is damaged';
		case 'UnitCreated': {
			/* the class picks are dummy units named Choose<Class>, made when a
			   player takes the class: say that, not the unit's id */
			const pick = /^Choose(\w+)$/.exec(String(e.arg ?? ''));
			if (pick) return `a ${prettify(pick[1])} is picked`;
			return e.arg ? `${prettify(String(e.arg))} is created` : 'a unit is created';
		}
		case 'MapInit':
			return 'map start';
		case 'UnitGainLevel':
			return 'hero levels up';
		default:
			return e.type.replace(/(?<=[a-z])(?=[A-Z])/g, ' ').toLowerCase();
	}
}

/** Triggers that (re)start the global side-mission scheduler timer. */
export const schedulerStarts = flowNodes
	.map((n) => ({
		node: n,
		timers: n.timers.filter((t) => t.var.includes('missiontimer'))
	}))
	.filter((x) => x.timers.length);

/** Triggers armed by a fixed game-time event, sorted chronologically. */
export const timedStarts = flowNodes
	.map((n) => ({ node: n, at: n.events.find((e) => e.type === 'TimeElapsed')?.arg }))
	.filter((x): x is { node: FlowNode; at: number } => typeof x.at === 'number')
	.sort((a, b) => a.at - b.at);
