/**
 * The extracted trigger groups against the graph they were cut from, and
 * the one grouping the user asked for by name: the MULE is its four
 * triggers, and a mechanic.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GROUP_TYPES, groups, groupById, groupOfTrigger, groupXp } from '../src/lib/groups.ts';
import { triggerRole } from '../src/lib/triggerRole.ts';

const triggers = JSON.parse(
	readFileSync(fileURLToPath(new URL('../src/lib/data/triggers.json', import.meta.url)), 'utf8')
) as Parameters<typeof triggerRole>[0][];
const ids = new Set(triggers.map((t) => t.id));
const byId = new Map(triggers.map((t) => [t.id, t]));

test('every group is url-safe, non-empty, typed, and names triggers the script has', () => {
	const seen = new Set<string>();
	const types = new Set(GROUP_TYPES.map((t) => t.type));
	for (const g of groups) {
		assert.match(g.id, /^[a-z0-9-]+$/, `${g.id}: url-safe id`);
		assert.ok(!seen.has(g.id), `${g.id}: unique id`);
		seen.add(g.id);
		assert.ok(g.name.trim().length > 0, `${g.id}: has a name`);
		assert.ok(types.has(g.type), `${g.id}: known type ${g.type}`);
		assert.ok(g.triggers.length >= 1, `${g.id}: at least one trigger`);
		for (const t of g.triggers) assert.ok(ids.has(t), `${g.id}: unknown trigger ${t}`);
		for (const a of g.armedBy) assert.ok(ids.has(a.id), `${g.id}: unknown armer ${a.id}`);
		const outcomeIds = g.outcomes.map((o) => o.id);
		assert.equal(new Set(outcomeIds).size, outcomeIds.length, `${g.id}: outcome ids unique`);
		for (const o of g.outcomes) assert.match(o.id, /^[0-9A-F]{8}$/, `${g.id}: outcome id ${o.id}`);
	}
});

test('a trigger belongs to one group at most', () => {
	const owner = new Map<string, string>();
	for (const g of groups)
		for (const t of g.triggers) {
			assert.ok(!owner.has(t), `${t} is in both ${owner.get(t)} and ${g.id}`);
			owner.set(t, g.id);
		}
	assert.equal(groupOfTrigger.size, owner.size);
});

test('a group with an outcome is a mission; one without and player-driven is a mechanic', () => {
	for (const g of groups) {
		if (g.outcomes.length) assert.equal(g.type, 'mission', `${g.id}: pays, so a mission`);
	}
	assert.ok(groups.some((g) => g.type === 'mechanic'));
});

test('the MULE is a mechanic of its four triggers, armed by the City Guard initializer', () => {
	const id = groupOfTrigger.get('gt_EngineersActivatetheMULE');
	assert.ok(id, 'Activate the MULE belongs to a group');
	const g = groupById.get(id!)!;
	assert.equal(g.type, 'mechanic');
	assert.deepEqual(
		[...g.triggers].sort(),
		[
			'gt_EngineersActivatetheMULE',
			'gt_EngineersDeactivatetheMULE',
			'gt_EngineersSelecttheMULE',
			'gt_EngineersUnselecttheMule'
		]
	);
	assert.ok(g.armedBy.some((a) => a.id === 'gt_EngineersIniCityGuard'));
	assert.equal(groupXp(g), 0);
	assert.equal(triggerRole(byId.get('gt_EngineersActivatetheMULE')!), 'player action');
	assert.equal(triggerRole(byId.get('gt_EngineersDeactivatetheMULE')!), 'enter region');
});

test('triggerRole reads the ends, the loops and the timeouts', () => {
	const roles = new Map<string, number>();
	for (const t of triggers) roles.set(triggerRole(t), (roles.get(triggerRole(t)) ?? 0) + 1);
	for (const r of ['success', 'fail', 'loop', 'scheduled', 'player action', 'enter region'])
		assert.ok((roles.get(r) ?? 0) > 5, `${r}: ${roles.get(r)}`);
	assert.equal(triggerRole(byId.get('gt_MayorTimeout')!), 'fail');
	assert.equal(triggerRole(byId.get('gt_MayorHouse')!), 'success');
});
