/** Unit tests for the ready-roster pub/sub (npm test). */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	publishReadyChange,
	readyListenerCount,
	subscribeReady
} from '../src/lib/server/events.ts';

test('publish reaches every subscriber; unsubscribe stops delivery', () => {
	let a = 0;
	let b = 0;
	const offA = subscribeReady(() => a++);
	const offB = subscribeReady(() => b++);
	publishReadyChange();
	assert.equal(a, 1);
	assert.equal(b, 1);

	offA();
	publishReadyChange();
	assert.equal(a, 1);
	assert.equal(b, 2);

	offB();
	assert.equal(readyListenerCount(), 0);
});

test('a throwing subscriber does not break the others', () => {
	let called = 0;
	const offBad = subscribeReady(() => {
		throw new Error('boom');
	});
	const offGood = subscribeReady(() => called++);
	publishReadyChange();
	assert.equal(called, 1);
	offBad();
	offGood();
});
