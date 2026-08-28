/**
 * Every trigger in the map script, with its edges as they are and everything
 * it references: regions, points, pre-placed units, what it creates, what it
 * shows, the flags it sets and tests.
 *
 * `flow.json` is the mission-relevant subgraph and ships to the browser for
 * /flow; this is the whole graph (1,100-odd triggers, half a megabyte), and
 * it stays on the server. A mission page names the handful it is about, and
 * gets those back with their edges cut down to the set, small enough to
 * serialize into the page. Missing ids are dropped rather than thrown: the
 * registry test is where a wrong id is caught, not a prerender.
 */
import raw from '$lib/data/triggers.json';
import type { FlowNode } from '$lib/flow';
import type { GateEdge } from '$lib/flowLayout';

const all = raw as FlowNode[];
const byId = new Map(all.map((n) => [n.id, n]));

export function triggerSubgraph(ids: string[]): FlowNode[] {
	const keep = new Set(ids);
	const within = (ts: string[]) => ts.filter((t) => keep.has(t));
	return ids
		.map((id) => byId.get(id))
		.filter((n): n is FlowNode => !!n)
		.map((n) => ({
			...n,
			enables: within(n.enables),
			disables: within(n.disables),
			executes: within(n.executes),
			timerTo: within(n.timerTo)
		}));
}

/**
 * Flag gates among the given triggers: one sets a boolean that another one's
 * conditions test for the same value. The enable/execute edges do not show
 * these (Remove Debris sets gv_mULEinitialized; Activate the MULE tests it).
 */
export function gatesWithin(ids: string[]): GateEdge[] {
	const nodes = ids.map((id) => byId.get(id)).filter((n): n is FlowNode => !!n);
	const out: GateEdge[] = [];
	for (const a of nodes) {
		for (const flag of a.refs?.sets ?? []) {
			for (const b of nodes) {
				if (b.id !== a.id && b.refs?.tests.includes(flag))
					out.push({ from: a.id, to: b.id, via: flag.split('=')[0] });
			}
		}
	}
	return out;
}

/**
 * Triggers outside the set that set a flag one of its triggers tests: what a
 * mission waits for, with the trigger that opens it.
 */
export function gatesInto(ids: string[]): { from: FlowNode; to: string; via: string }[] {
	const keep = new Set(ids);
	const members = ids.map((id) => byId.get(id)).filter((n): n is FlowNode => !!n);
	const out: { from: FlowNode; to: string; via: string }[] = [];
	for (const b of members) {
		for (const flag of b.refs?.tests ?? []) {
			for (const a of all) {
				if (!keep.has(a.id) && a.refs?.sets.includes(flag))
					out.push({ from: a, to: b.id, via: flag.split('=')[0] });
			}
		}
	}
	return out;
}

export const triggerById = (id: string) => byId.get(id) ?? null;

/** Every trigger, for a server load that wants to sweep them. */
export const allTriggers = () => all;
