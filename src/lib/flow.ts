import rawFlow from '$lib/data/flow.json';

export interface FlowEvent {
	type: string;
	arg: string | number | null;
}

export interface FlowOutcome {
	xp: number;
	name: string;
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
			return 'an ability is used';
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
		case 'UnitCreated':
			return 'a unit is created';
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
