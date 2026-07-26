/**
 * The worker must be invisible: same parse, same peek, same errors as
 * running in-process — it only changes which thread pays for it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseReplay, peekReplay } from '../src/lib/server/replay/extract.ts';
import { parseReplayOffThread, peekReplayOffThread } from '../src/lib/server/replay/offthread.ts';
import rawMos from '../src/lib/data/mos.json' with { type: 'json' };

const here = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(here, 'fixtures', '20260723-1808.SC2Replay'));
const data = new Uint8Array(fixture);
const mosIds = new Set((rawMos as { id: string }[]).map((m) => m.id));

test('peek off-thread matches peek in-process', async () => {
	assert.deepEqual(await peekReplayOffThread(data), peekReplay(data));
});

test('parse off-thread matches parse in-process', async () => {
	const viaWorker = await parseReplayOffThread('x.SC2Replay', data, mosIds);
	assert.deepEqual(viaWorker, parseReplay('x.SC2Replay', data, mosIds));
	assert.ok(viaWorker.sightings.length > 0, 'fixture should yield sightings');
});

test('a parse failure crosses the thread boundary as a rejection', async () => {
	const junk = new Uint8Array(Buffer.from('not a replay at all, not even close'));
	await assert.rejects(() => parseReplayOffThread('junk.SC2Replay', junk, mosIds));
	// and the worker survives it — the next parse still works
	const after = await parseReplayOffThread('x.SC2Replay', data, mosIds);
	assert.ok(after.sightings.length > 0);
});
