/**
 * Decompression-bomb guards for the MPQ reader.
 *
 * Uploads are unauthenticated, so every byte the parser expands comes from
 * an attacker. A few hundred KB of deflate expands to hundreds of MB in a
 * fraction of a second — enough for one request to OOM the machine — so the
 * decoders must refuse before allocating, not after.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { decompressChunk, MAX_FILE_BYTES } from '../src/lib/server/replay/mpq.ts';

/** `2` is the zlib compression byte MPQ sectors are framed with. */
function deflateChunk(bytes: number): Uint8Array {
	return Buffer.concat([Buffer.from([2]), deflateSync(Buffer.alloc(bytes))]);
}

test('a sector that expands past its declared size is rejected', () => {
	const bomb = deflateChunk(64 * 1024 * 1024);
	assert.ok(bomb.length < 100 * 1024, 'fixture should be a small payload');
	const started = process.hrtime.bigint();
	assert.throws(() => decompressChunk(bomb, 4096), /maxOutputLength|too large|buffer/i);
	const ms = Number(process.hrtime.bigint() - started) / 1e6;
	assert.ok(ms < 1000, `should bail early, took ${ms}ms`);
});

test('a declared size past the ceiling is refused before decoding', () => {
	assert.throws(() => decompressChunk(deflateChunk(1024), MAX_FILE_BYTES + 1), /refusing/);
	assert.throws(() => decompressChunk(deflateChunk(1024), Infinity), /refusing/);
	assert.throws(() => decompressChunk(deflateChunk(1024), 0), /refusing/);
});

test('a sector within its declared size still decodes', () => {
	const out = decompressChunk(deflateChunk(4096), 4096);
	assert.equal(out.length, 4096);
});
