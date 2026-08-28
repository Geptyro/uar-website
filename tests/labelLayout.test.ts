import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutLabels, type LabelRequest } from '../src/lib/components/map/labelLayout.ts';

const req = (id: string, x: number, y: number, text = id, extra: Partial<LabelRequest> = {}): LabelRequest => ({
	id,
	x,
	y,
	text,
	tone: 'gold',
	r: 4,
	...extra
});

test('two names on one point are written apart', () => {
	const { placed, hidden } = layoutLabels([req('a', 100, 100, 'Route 1'), req('b', 100, 100, 'Route 2')], 1, 256);
	assert.equal(hidden, 0);
	assert.equal(placed.length, 2);
	const [a, b] = placed;
	assert.notDeepEqual([a.tx, a.ty, a.anchor], [b.tx, b.ty, b.anchor]);
});

test('a crowd on one point spills outward with leaders before anything is hidden', () => {
	const many = Array.from({ length: 10 }, (_, i) => req(`n${i}`, 100, 100, `Name ${i}`));
	const { placed, hidden } = layoutLabels(many, 1, 256);
	assert.equal(hidden, 0);
	assert.ok(placed.some((p) => p.lead !== null), 'the ones past the first ring say where they belong');
	for (const p of placed) assert.ok(Number.isFinite(p.tx) && Number.isFinite(p.ty));
});

test('a name with no room is hidden and counted, not written over another', () => {
	// a ring of names crowding one point at a zoom where nothing fits
	const crowd = Array.from({ length: 30 }, (_, i) => req(`n${i}`, 100 + (i % 6) * 2, 100 + Math.floor(i / 6) * 2, 'A fairly long name'));
	const { placed, hidden } = layoutLabels(crowd, 4, 256);
	assert.ok(hidden > 0);
	assert.equal(placed.length + hidden, crowd.length);
});

test('a fixed name stays where it is and others keep clear of it', () => {
	const fixed = req('region', 100, 100, 'Thalim', { fixed: { x: 100, y: 90, anchor: 'middle' }, priority: 3 });
	const { placed } = layoutLabels([fixed, req('p', 100, 92, 'Point')], 1, 256);
	const f = placed.find((p) => p.id === 'region')!;
	assert.deepEqual([f.tx, f.ty, f.anchor], [100, 90, 'middle']);
	const p = placed.find((p) => p.id === 'p')!;
	assert.ok(Math.abs(p.ty - f.ty) > 3 || Math.abs(p.tx - f.tx) > 20, 'the point name went elsewhere');
});

test('names stay inside the map', () => {
	const { placed } = layoutLabels([req('edge', 254, 2, 'A name at the corner')], 1, 256);
	assert.equal(placed.length, 1);
	assert.ok(placed[0].anchor === 'end' || placed[0].tx < 200, 'written back into the map');
});
