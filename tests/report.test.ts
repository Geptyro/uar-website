import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	REPORT_LOG_MAX,
	REPORT_MESSAGE_MAX,
	tailOf,
	validateReport
} from '../src/lib/report.ts';

test('tailOf keeps the end of a long log, starting on a line boundary', () => {
	const lines = Array.from({ length: 5000 }, (_, i) => `2026-08-29T00:00:00.000Z line ${i}`);
	const cut = tailOf(lines.join('\n'));
	assert.ok(cut.length <= REPORT_LOG_MAX + 30, 'trimmed to the cap plus the marker');
	assert.ok(cut.startsWith('[earlier lines trimmed]\n'), 'says it was cut');
	assert.ok(cut.endsWith('line 4999'), 'the last thing the app did is kept');
	assert.ok(!cut.includes('line 0\n'), 'the beginning is gone');
	// every kept line is whole
	for (const line of cut.split('\n').slice(1)) {
		assert.match(line, /^2026-08-29T00:00:00\.000Z line \d+$/);
	}
});

test('tailOf leaves a short log alone', () => {
	assert.equal(tailOf('one\ntwo'), 'one\ntwo');
});

test('a log with no note is a valid report, and so is a note with no log', () => {
	const logOnly = validateReport({ log: 'uncaught exception: boom' });
	assert.ok(logOnly.ok && logOnly.fields.log === 'uncaught exception: boom');
	assert.equal(logOnly.ok && logOnly.fields.message, undefined);

	const noteOnly = validateReport({ message: '  it crashed on shutdown  ' });
	assert.ok(noteOnly.ok && noteOnly.fields.message === 'it crashed on shutdown');
});

test('nothing to report is refused', () => {
	for (const body of [{}, { message: '   ' }, { log: '  \n ' }, null, 'text']) {
		assert.equal(validateReport(body).ok, false, JSON.stringify(body));
	}
});

test('an over-long message is refused, an over-long log is trimmed', () => {
	const long = validateReport({ message: 'x'.repeat(REPORT_MESSAGE_MAX + 1) });
	assert.equal(long.ok, false);
	const big = validateReport({ log: 'y'.repeat(REPORT_LOG_MAX * 3) });
	assert.ok(big.ok && big.fields.log!.length <= REPORT_LOG_MAX + 30, 'server trims too');
});

test('app metadata is an allowlist, stringified and capped', () => {
	const v = validateReport({
		log: 'x',
		app: {
			version: '0.10.1',
			platform: 'win32',
			signedIn: true,
			sc2: null,
			note: 'invented field',
			crashedAt: 'a'.repeat(500)
		}
	});
	assert.ok(v.ok);
	assert.deepEqual(Object.keys(v.fields.app!).sort(), ['crashedAt', 'platform', 'signedIn', 'version']);
	assert.equal(v.fields.app!.signedIn, 'true', 'coerced to a string');
	assert.equal(v.fields.app!.crashedAt!.length, 200, 'capped');
	assert.ok(!('note' in v.fields.app!), 'unknown fields dropped');
});
