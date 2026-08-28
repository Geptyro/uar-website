import test from 'node:test';
import assert from 'node:assert/strict';
import { TRIGGER_TABS, triggerHref, tabSegment } from '../src/lib/triggerTabs.ts';

test('a group page has an overview and a flow tab', () => {
	assert.deepEqual(
		TRIGGER_TABS.map((t) => t.segment),
		['', 'flow']
	);
});

test('triggerHref builds the group URL and its tabs', () => {
	assert.equal(triggerHref('mule'), '/triggers/mule');
	assert.equal(triggerHref('mule', 'flow'), '/triggers/mule/flow');
});

test('tabSegment reads the route id, not the URL', () => {
	assert.equal(tabSegment('/triggers/[id]'), '');
	assert.equal(tabSegment('/triggers/[id]/flow'), 'flow');
	assert.equal(tabSegment('/triggers/[id]/nope'), null);
	assert.equal(tabSegment('/triggers'), null);
	assert.equal(tabSegment('/mos/[id]'), null);
});
