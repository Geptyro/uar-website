/**
 * The MPQ reader has two bindings over one platform-free core: native zlib on
 * the server, fflate in the browser. If they ever disagree, the client either
 * uploads replays it promised to filter out or refuses ones it should send —
 * and neither failure is visible from the server side.
 *
 * The browser binding is deliberately partial, and this file is where that
 * boundary is written down. SC2 writes `replay.details` as zlib and
 * everything deeper as bzip2, so the client can do the map-title check and
 * nothing else. The tests below assert both halves of that: byte-identical
 * `replay.details`, and a clear failure on the entries only the server reads.
 *
 * Fixtures are the committed real UAR recordings — the only data that proves
 * the browser path handles what SC2 actually writes.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MPQArchive as NodeArchive } from '../src/lib/server/replay/mpq-node.ts';
import { MPQArchive as BrowserArchive } from '../src/lib/replay/mpq-browser.ts';
import { isUARReplay, bytesInclude } from '../src/lib/replay/sniff.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, 'fixtures');
const NAMES = ['20260723-1802', '20260723-1808'];

/** Entries SC2 stores as bzip2 — server-only, by measurement not by choice. */
const BZIP2_ENTRIES = ['replay.initData', 'replay.game.events', 'replay.tracker.events'];

function load(name: string): Uint8Array {
	return new Uint8Array(readFileSync(join(FIXTURES, `${name}.SC2Replay`)));
}

for (const name of NAMES) {
	test(`${name}: replay.details is byte-identical across bindings`, () => {
		const data = load(name);
		const node = new NodeArchive(data);
		const browser = new BrowserArchive(data);

		assert.deepEqual(browser.userDataContent, node.userDataContent, 'user-data header differs');

		const a = node.readFile('replay.details');
		const b = browser.readFile('replay.details');
		assert.ok(a && a.length > 0, 'replay.details missing under the node binding');
		assert.deepEqual(b, a, 'replay.details differs between bindings');
	});

	test(`${name}: recognised as a UAR replay in the browser`, () => {
		assert.equal(isUARReplay(load(name)), true);
	});

	test(`${name}: deeper entries fail loudly in the browser`, () => {
		// Pins the boundary. If a future SC2 build switches these to zlib, or
		// someone adds bzip2 to the browser binding, this test fails and the
		// comment in mpq-browser.ts needs revisiting — which is the point.
		const browser = new BrowserArchive(load(name));
		for (const entry of BZIP2_ENTRIES) {
			assert.throws(
				() => browser.readFile(entry, 64 * 1024),
				/bzip2 MPQ sectors are not supported/,
				`${entry} unexpectedly readable in the browser`
			);
		}
	});

	test(`${name}: the server binding still reads everything`, () => {
		const node = new NodeArchive(load(name));
		for (const entry of BZIP2_ENTRIES) {
			const out = node.readFile(entry, 64 * 1024);
			assert.ok(out && out.length > 0, `${entry} unreadable server-side`);
		}
	});
}

test('bytesInclude matches Buffer.includes semantics', () => {
	const hay = new TextEncoder().encode('abcdef');
	assert.equal(bytesInclude(hay, new TextEncoder().encode('cde')), true);
	assert.equal(bytesInclude(hay, new TextEncoder().encode('abcdef')), true);
	assert.equal(bytesInclude(hay, new TextEncoder().encode('acf')), false);
	assert.equal(bytesInclude(hay, new TextEncoder().encode('efg')), false);
	assert.equal(bytesInclude(hay, new Uint8Array()), true);
	assert.equal(bytesInclude(new Uint8Array(), new TextEncoder().encode('a')), false);
});

test('a non-replay is rejected rather than silently passed', () => {
	assert.throws(() => isUARReplay(new Uint8Array(64)), /not an SC2 replay/);
});
