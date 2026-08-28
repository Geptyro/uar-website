import test from 'node:test';
import assert from 'node:assert/strict';
import { flowEdges, orderLayers, sourceLayers } from '../src/lib/flowLayout.ts';
import type { FlowNode } from '../src/lib/flow.ts';

const node = (id: string, edges: Partial<FlowNode> = {}): FlowNode => ({
	id,
	name: id,
	events: [],
	armed: true,
	enables: [],
	disables: [],
	executes: [],
	timerTo: [],
	timers: [],
	succeed: [],
	fail: [],
	...edges
});

/* the MULE's shape: an initializer that arms four triggers, one of which arms
   a fifth, and a second source that only gates */
const ini = node('ini', { enables: ['select', 'unselect', 'activate', 'deactivate', 'scraps'] });
const debris = node('debris');
const scraps = node('scraps');
const select = node('select');
const unselect = node('unselect');
const activate = node('activate', { enables: ['deactivate'] });
const deactivate = node('deactivate');
const nodes = [ini, debris, scraps, select, unselect, activate, deactivate];
const byId = new Map(nodes.map((n) => [n.id, n]));
const gates = [{ from: 'debris', to: 'activate', via: 'gv_x' }];

test('sourceLayers: sources first, a node one past its last parent, gates count', () => {
	const layers = sourceLayers(nodes, gates).map((l) => l.map((n) => n.id));
	assert.deepEqual(layers, [
		['ini', 'debris'],
		['scraps', 'select', 'unselect', 'activate'],
		['deactivate']
	]);
});

test('sourceLayers: a cycle is cut, every node lands once', () => {
	const a = node('a', { enables: ['b'] });
	const b = node('b', { enables: ['c'] });
	const c = node('c', { enables: ['a'] });
	const layers = sourceLayers([a, b, c]);
	assert.deepEqual(layers.flat().map((n) => n.id).sort(), ['a', 'b', 'c']);
	assert.equal(layers.length, 3);
});

test('flowEdges: one arrow per pair, strongest kind wins, gates added', () => {
	const both = node('both', { enables: ['t'], executes: ['t'], timerTo: ['t'] });
	const t = node('t');
	const edges = flowEdges(new Set(['both', 't']), new Map([['both', both], ['t', t]]));
	assert.deepEqual(
		edges.map((e) => e.data),
		['enable']
	);
	const withGate = flowEdges(new Set(nodes.map((n) => n.id)), byId, gates);
	assert.ok(withGate.some((e) => e.data === 'gate' && e.source === 'debris' && e.target === 'activate'));
	assert.equal(withGate.filter((e) => e.data === 'enable').length, 6);
});

test('orderLayers keeps every layer whole and does not touch its input', () => {
	const layers = sourceLayers(nodes, gates);
	const before = layers.map((l) => l.map((n) => n.id));
	const ordered = orderLayers(layers, byId, gates);
	assert.deepEqual(
		ordered.map((l) => l.map((n) => n.id).sort()),
		before.map((l) => [...l].sort())
	);
	assert.deepEqual(
		layers.map((l) => l.map((n) => n.id)),
		before
	);
});
