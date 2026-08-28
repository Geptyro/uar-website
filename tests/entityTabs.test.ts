import test from 'node:test';
import assert from 'node:assert/strict';
import { ENTITY_TABS, entityHref, entityTabSegment } from '../src/lib/entityTabs.ts';

test('an entity has its sheet and its comments', () => {
	assert.deepEqual(ENTITY_TABS.map((t) => t.segment), ['', 'comments']);
	assert.equal(entityHref('Interceptor'), '/entities/Interceptor');
	assert.equal(entityHref('Interceptor', 'comments'), '/entities/Interceptor/comments');
});

test('entityTabSegment reads the route id, not the URL', () => {
	assert.equal(entityTabSegment('/entities/[id]'), '');
	assert.equal(entityTabSegment('/entities/[id]/comments'), 'comments');
	assert.equal(entityTabSegment('/entities'), null);
	assert.equal(entityTabSegment('/mos/[id]/comments'), null);
	assert.equal(entityTabSegment(null), null);
});
