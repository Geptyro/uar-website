/** Unit tests for holdData, the guard against a route's data changing under it on the way out (npm test). */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { holdData } from '../src/lib/heldData.ts';

test("keeps the last data that was the component's own", () => {
	const hold = holdData((d: { unit?: { id: string } }) => !!d.unit);
	const spitter = { unit: { id: 'Spitter' } };
	assert.equal(hold(spitter), spitter);
	assert.equal(hold({}), spitter, "the next route's data, on the way out");
	const crab = { unit: { id: 'Crab' } };
	assert.equal(hold(crab), crab, 'its own again: taken');
});
