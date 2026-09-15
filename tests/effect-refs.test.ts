/** Unit tests for grouping an effect's "applied by" / "cured by" references (npm test). */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groupRefs, type Effect } from '../src/lib/effects.ts';

const effects: Effect[] = JSON.parse(readFileSync(new URL('../src/lib/data/behaviors.json', import.meta.url), 'utf8'));
const mos: { id: string }[] = JSON.parse(readFileSync(new URL('../src/lib/data/mos.json', import.meta.url), 'utf8'));
const classes = new Set(mos.map((m) => m.id));
const isClass = (id: string) => classes.has(id);
const byId = (id: string) => effects.find((e) => e.id === id)!;

test('one row per ability name, whatever ids the data spreads it over', () => {
	const refs = byId('MinorLacerations').curedBy;
	const groups = groupRefs(refs, isClass);
	const names = groups.map((g) => g.name);
	assert.equal(new Set(names).size, names.length, 'no name twice');
	assert.ok(groups.length < refs.length / 4, `${refs.length} references fold into ${groups.length} rows`);
	const selfAid = groups.find((g) => g.name === 'Perform Self-Aid')!;
	assert.ok(selfAid.classes.length > 10, 'the classes that carry it');
	assert.ok(selfAid.units.length > 10, 'and the NPC units, from the Mini copy');
	assert.ok(isClass(selfAid.first.owner), 'the name links to a class card first');
});

test('every owner is listed once, and nothing is lost', () => {
	for (const e of effects) {
		for (const refs of [e.appliedBy, e.curedBy]) {
			const groups = groupRefs(refs, isClass);
			const owners = new Set(refs.map((r) => `${r.abilityName.trim().toLowerCase()}|${r.owner}`));
			const listed = groups.reduce((n, g) => n + g.classes.length + g.units.length, 0);
			assert.equal(listed, owners.size, e.id);
		}
	}
});

test('a level shows only when every copy of the ability has one', () => {
	const nano = groupRefs(byId('MinorLacerations').curedBy, isClass).find((g) => g.name === 'Nano-Injection')!;
	assert.deepEqual(nano.levels, [], 'one class copy at lv 1 does not make the row lv 1');
});
