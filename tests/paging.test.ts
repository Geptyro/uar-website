import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paginate, pageNumber, pageWindow } from '../src/lib/paging.ts';

const rows = Array.from({ length: 120 }, (_, i) => i + 1);

test('paginate slices and reports totals', () => {
	const first = paginate(rows, null, 50);
	assert.deepEqual(first.rows.slice(0, 2), [1, 2]);
	assert.equal(first.rows.length, 50);
	assert.deepEqual([first.page, first.pages, first.total], [1, 3, 120]);

	const last = paginate(rows, '3', 50);
	assert.deepEqual(last.rows, [101, ...Array.from({ length: 19 }, (_, i) => 102 + i)]);
	assert.equal(last.page, 3);
});

test('page numbers out of range are clamped, not errors', () => {
	assert.equal(pageNumber(null, 5), 1);
	assert.equal(pageNumber('0', 5), 1);
	assert.equal(pageNumber('-2', 5), 1);
	assert.equal(pageNumber('nonsense', 5), 1);
	assert.equal(pageNumber('99', 5), 5);
	assert.equal(pageNumber('2.7', 5), 2);
	assert.equal(pageNumber('1', 0), 1, 'empty collection still has page 1');
});

test('an empty collection paginates to one empty page', () => {
	const p = paginate([], null, 50);
	assert.deepEqual(p, { rows: [], page: 1, pages: 1, total: 0, perPage: 50 });
});

test('page window keeps the ends and marks gaps', () => {
	assert.deepEqual(pageWindow(6, 20), [1, null, 4, 5, 6, 7, 8, null, 20]);
	assert.deepEqual(pageWindow(1, 3), [1, 2, 3]);
	assert.deepEqual(pageWindow(1, 1), [1]);
	assert.deepEqual(pageWindow(2, 20).at(-1), 20);
});
