/**
 * Laying out a trigger graph as layers of chips, for the chain chart.
 *
 * A trigger group's page hands this module its handful of triggers and gets
 * back the layers to render (sources first) and the edges to route; nothing
 * here touches the DOM or the data files, so it runs in a plain node test.
 */
import type { FlowNode } from './flow';

export type EdgeKind = 'enable' | 'execute' | 'timer' | 'disable' | 'gate';

export interface FlowEdge {
	id: string;
	source: string;
	target: string;
	/** Edges leaving one node by one kind share a bus: one trunk, many stubs. */
	bus: string;
	data: EdgeKind;
}

/**
 * An edge the script has but the extractor cannot see: a trigger that opens
 * the way for another by setting a variable the other tests. Declared by hand
 * on a mission, with the variable named so a reader can check it.
 */
export interface GateEdge {
	from: string;
	to: string;
	/** The variable in the script, e.g. `gv_mULEinitialized`. */
	via: string;
}

/** Forward edges — the ones that make a trigger run or arm. */
const forward = (n: FlowNode) => [...n.enables, ...n.executes, ...n.timerTo];

/**
 * The edges among the shown nodes, one per (source, target, kind), with a
 * kind's edge dropped when a stronger kind already joins the pair: enabling a
 * trigger and also running it is one arrow, not two.
 */
export function flowEdges(
	shown: Set<string>,
	byId: Map<string, FlowNode>,
	gates: GateEdge[] = []
): FlowEdge[] {
	const edges: FlowEdge[] = [];
	for (const id of shown) {
		const n = byId.get(id);
		if (!n) continue;
		for (const t of n.enables)
			if (shown.has(t))
				edges.push({ id: `${id}>e>${t}`, source: id, target: t, bus: `${id}|en`, data: 'enable' });
		for (const t of n.executes)
			if (shown.has(t) && !n.enables.includes(t))
				edges.push({ id: `${id}>x>${t}`, source: id, target: t, bus: `${id}|ex`, data: 'execute' });
		for (const t of n.timerTo)
			if (shown.has(t) && !n.enables.includes(t) && !n.executes.includes(t))
				edges.push({ id: `${id}>t>${t}`, source: id, target: t, bus: `${id}|tm`, data: 'timer' });
		for (const t of n.disables)
			if (shown.has(t))
				edges.push({ id: `${id}>d>${t}`, source: id, target: t, bus: `${id}|off`, data: 'disable' });
	}
	for (const g of gates) {
		if (shown.has(g.from) && shown.has(g.to))
			edges.push({
				id: `${g.from}>g>${g.to}`,
				source: g.from,
				target: g.to,
				bus: `${g.from}|gate`,
				data: 'gate'
			});
	}
	return edges;
}

/**
 * Median-of-neighbors ordering (barycenter sweeps): chained triggers line up
 * across layers instead of scattering alphabetically, so the wiring is
 * shorter and calmer on hub selections. The given order is the seed and the
 * tie-break. Returns new arrays; the input is not touched.
 */
export function orderLayers(
	layers: FlowNode[][],
	byId: Map<string, FlowNode>,
	gates: GateEdge[] = []
): FlowNode[][] {
	const out = layers.map((l) => [...l]);
	const shown = new Set(out.flat().map((n) => n.id));
	const pos = new Map<string, number>();
	for (const l of out) l.forEach((n, i) => pos.set(n.id, i));
	const neigh = new Map<string, string[]>();
	for (const id of shown) neigh.set(id, []);
	const link = (a: string, b: string) => {
		if (shown.has(a) && shown.has(b)) {
			neigh.get(a)!.push(b);
			neigh.get(b)!.push(a);
		}
	};
	for (const id of shown) {
		const n = byId.get(id);
		if (!n) continue;
		for (const t of [...forward(n), ...n.disables]) link(id, t);
	}
	for (const g of gates) link(g.from, g.to);
	for (let sweep = 0; sweep < 4; sweep++) {
		for (let li = 0; li < out.length; li++) {
			out[li] = out[li]
				.map((n) => {
					const ps = neigh
						.get(n.id)!
						.map((m) => pos.get(m)!)
						.sort((a, b) => a - b);
					const med = ps.length ? ps[Math.floor(ps.length / 2)] : pos.get(n.id)!;
					return { n, med };
				})
				.sort((a, b) => a.med - b.med || a.n.name.localeCompare(b.n.name))
				.map((x) => x.n);
			out[li].forEach((n, i) => pos.set(n.id, i));
		}
	}
	return out;
}

/**
 * Layers of a fixed set of triggers, sources first: a trigger sits one layer
 * past the last of the triggers that arm, run or gate it. A cycle (a loop
 * that re-arms its own starter) is cut at the node with the fewest pending
 * parents, so every node lands somewhere and the chart still reads left to
 * right. Within a layer, the given order is kept.
 */
export function sourceLayers(nodes: FlowNode[], gates: GateEdge[] = []): FlowNode[][] {
	const ids = new Set(nodes.map((n) => n.id));
	const parents = new Map<string, Set<string>>(nodes.map((n) => [n.id, new Set()]));
	for (const n of nodes) for (const t of forward(n)) if (ids.has(t)) parents.get(t)!.add(n.id);
	for (const g of gates) if (ids.has(g.from) && ids.has(g.to)) parents.get(g.to)!.add(g.from);

	const layerOf = new Map<string, number>();
	let pending = [...nodes];
	while (pending.length) {
		let ready = pending.filter((n) => [...parents.get(n.id)!].every((p) => layerOf.has(p)));
		if (!ready.length) {
			const unmet = (n: FlowNode) => [...parents.get(n.id)!].filter((p) => !layerOf.has(p)).length;
			ready = [pending.reduce((a, b) => (unmet(b) < unmet(a) ? b : a))];
		}
		for (const n of ready) {
			const ps = [...parents.get(n.id)!].map((p) => layerOf.get(p)).filter((l): l is number => l !== undefined);
			layerOf.set(n.id, ps.length ? Math.max(...ps) + 1 : 0);
		}
		const done = new Set(ready.map((n) => n.id));
		pending = pending.filter((n) => !done.has(n.id));
	}
	const layers: FlowNode[][] = [];
	for (const n of nodes) {
		const l = layerOf.get(n.id)!;
		(layers[l] ??= []).push(n);
	}
	return layers.filter((l) => l?.length);
}
