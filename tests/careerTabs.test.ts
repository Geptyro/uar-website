import test from 'node:test';
import assert from 'node:assert/strict';
import { CAREER_TABS, careerHref, tabSegment } from '../src/lib/careerTabs.ts';

test('the ranks take the base URL and the rest a segment of their own', () => {
	assert.deepEqual(
		CAREER_TABS.map((t) => careerHref(t.segment)),
		['/career', '/career/si', '/career/medals', '/career/camos']
	);
});

test('a route id maps back to its tab, and nothing outside the section does', () => {
	assert.equal(tabSegment('/career'), '');
	assert.equal(tabSegment('/career/si'), 'si');
	assert.equal(tabSegment('/career/camos'), 'camos');
	assert.equal(tabSegment('/players/[toon]/collection'), null);
	assert.equal(tabSegment('/si'), null);
	assert.equal(tabSegment(null), null);
});
