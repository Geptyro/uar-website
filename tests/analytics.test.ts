import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rememberUmamiId } from '../src/lib/analytics.ts';

const KEY = 'uar:umami-id';

function stubStorage(impl?: Partial<Storage>) {
	const store = new Map<string, string>();
	(globalThis as { localStorage?: unknown }).localStorage = {
		getItem: (k: string) => store.get(k) ?? null,
		setItem: (k: string, v: string) => void store.set(k, v),
		removeItem: (k: string) => void store.delete(k),
		...impl
	};
	return store;
}

test('a battletag is cached under the key app.html reads', () => {
	const store = stubStorage();
	rememberUmamiId('Geptyro#2569');
	assert.equal(store.get(KEY), 'Geptyro#2569');
});

test('signing out forgets it, so the next load starts anonymous', () => {
	const store = stubStorage();
	rememberUmamiId('Geptyro#2569');
	rememberUmamiId(null);
	assert.equal(store.has(KEY), false);
});

test('storage that throws (private mode) costs analytics, not the page', () => {
	stubStorage({
		setItem: () => {
			throw new DOMException('quota', 'QuotaExceededError');
		},
		removeItem: () => {
			throw new DOMException('quota', 'QuotaExceededError');
		}
	});
	assert.doesNotThrow(() => rememberUmamiId('Geptyro#2569'));
	assert.doesNotThrow(() => rememberUmamiId(null));
});
