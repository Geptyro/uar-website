/**
 * Telling "the worker failed" apart from "the file is bad".
 *
 * This is not a detail of error handling: the upload endpoint maps the first to
 * 503 and the second to 400, and the Companion retries a 503 while recording a
 * 400 as a permanent verdict on the file — it never offers that game again. So
 * mixing the two up loses replays that were never wrong. Both directions are
 * asserted, because either one costs something: a worker failure sold as a bad
 * file discards a good game, and a bad file sold as a worker failure gets
 * retried forever.
 *
 * Runs in its own file because `offthread` keeps its worker in module state,
 * and this one has to be started against a deliberately broken worker.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// picked up by workerPath() on the first parse, so it must be set before the
// module spawns anything
process.env.REPLAY_WORKER = join(here, 'fixtures', 'dying-worker.mjs');

const { parseReplayOffThread, ReplayWorkerError } = await import(
	'../src/lib/server/replay/offthread.ts'
);

const mosIds = new Set<string>();

test('a worker that dies is the worker failing, not the file', async () => {
	const data = new Uint8Array(readFileSync(join(here, 'fixtures', '20260723-1808.SC2Replay')));
	await assert.rejects(
		() => parseReplayOffThread('x.SC2Replay', data, mosIds),
		(e: unknown) => {
			assert.ok(
				e instanceof ReplayWorkerError,
				`a good replay must not be blamed for the worker dying, got ${(e as Error)?.name}`
			);
			return true;
		}
	);
});

test('an unreadable file is the file, even though it also rejects', async () => {
	// same rejection shape as above, and the endpoint has nothing but the error
	// type to tell it apart — a plain Error here is what earns the 400
	const { peekReplay } = await import('../src/lib/server/replay/extract.ts');
	assert.throws(
		() => peekReplay(new Uint8Array(Buffer.from('not a replay at all, not even close'))),
		(e: unknown) => {
			assert.ok(
				!(e instanceof ReplayWorkerError),
				'a genuinely unreadable replay must not look like a worker failure, or it is retried forever'
			);
			return true;
		}
	);
});
