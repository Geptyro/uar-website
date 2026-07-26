import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withLock } from '../src/lib/mutex.ts';

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('runs same-key work one at a time', async () => {
	const events: string[] = [];
	const job = (id: string) => async () => {
		events.push(`${id}:start`);
		await tick(20);
		events.push(`${id}:end`);
		return id;
	};
	const [a, b, c] = await Promise.all([
		withLock('ingest', job('a')),
		withLock('ingest', job('b')),
		withLock('ingest', job('c'))
	]);
	assert.deepEqual([a, b, c], ['a', 'b', 'c']);
	// no interleaving: every start is followed by its own end
	assert.deepEqual(events, [
		'a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end'
	]);
});

test('different keys do not block each other', async () => {
	const order: string[] = [];
	await Promise.all([
		withLock('one', async () => {
			await tick(30);
			order.push('slow');
		}),
		withLock('two', async () => {
			order.push('fast');
		})
	]);
	assert.deepEqual(order, ['fast', 'slow']);
});

test('a thrown job still releases the lock', async () => {
	await assert.rejects(() =>
		withLock('ingest', async () => {
			throw new Error('boom');
		})
	);
	assert.equal(await withLock('ingest', async () => 'next runs'), 'next runs');
});
