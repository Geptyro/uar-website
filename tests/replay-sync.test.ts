/**
 * The browser sync engine's decision tree, with every port faked.
 *
 * The ordering test is the one that matters most: the map-title check has to
 * happen before the sha probe, or a player who syncs a folder full of ladder
 * games tells the server the hash of every one of them. That is a privacy
 * promise, and it is exactly the kind of thing a later refactor "tidies" into
 * the wrong order because the probe is cheaper.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_UPLOAD_SIZE } from 'uar-shared/replay';
import { syncReplays, tally, type ReplayFile, type SyncPorts } from '../src/lib/replay/sync.ts';

function file(name: string, size = 1024, bytes?: () => Promise<Uint8Array>): ReplayFile {
	return {
		name,
		size,
		lastModified: 1_700_000_000_000,
		bytes: bytes ?? (async () => new Uint8Array(size))
	};
}

/** An in-memory stand-in for the IndexedDB verdict store. */
function memoryCache() {
	const map = new Map<string, string>();
	return {
		map,
		recall: async (key: string) => map.get(key),
		remember: async (key: string, outcome: string) => void map.set(key, outcome)
	};
}

interface Spy {
	ports: SyncPorts;
	calls: string[];
}

function spyPorts(over: Partial<SyncPorts> = {}): Spy {
	const calls: string[] = [];
	const ports: SyncPorts = {
		examine: async () => {
			calls.push('examine');
			return { isUAR: true, sha256: 'deadbeef' };
		},
		exists: async () => {
			calls.push('exists');
			return false;
		},
		upload: async (name) => {
			calls.push(`upload:${name}`);
			return { ok: true, duplicate: false };
		},
		delay: async () => {
			calls.push('delay');
		},
		...over
	};
	return { ports, calls };
}

async function run(files: ReplayFile[], ports: SyncPorts, opts = {}) {
	const events = [];
	for await (const e of syncReplays(files, ports, opts)) events.push(e);
	return events;
}

test('a replay that is not ours never reaches the network', async () => {
	const spy = spyPorts({
		examine: async () => ({ isUAR: false, sha256: '' }),
		exists: async () => assert.fail('sha probe ran for a foreign replay'),
		upload: async () => assert.fail('uploaded a foreign replay')
	});
	const events = await run([file('ladder.SC2Replay')], spy.ports);
	assert.deepEqual(events, [{ file: 'ladder.SC2Replay', outcome: 'not-uar' }]);
});

test('the map-title check runs before the sha probe', async () => {
	const spy = spyPorts();
	await run([file('a.SC2Replay')], spy.ports);
	assert.ok(
		spy.calls.indexOf('examine') < spy.calls.indexOf('exists'),
		`expected examine before exists, got ${spy.calls.join(' → ')}`
	);
});

test('a replay the server already has is not uploaded', async () => {
	const spy = spyPorts({
		exists: async () => true,
		upload: async () => assert.fail('uploaded a known replay')
	});
	const events = await run([file('known.SC2Replay')], spy.ports);
	assert.deepEqual(events, [{ file: 'known.SC2Replay', outcome: 'duplicate' }]);
});

test('a 409 counts as a duplicate, not a failure', async () => {
	const spy = spyPorts({
		upload: async () => ({ ok: false, duplicate: true, message: 'already ingested' })
	});
	const [event] = await run([file('teammate.SC2Replay')], spy.ports);
	assert.equal(event.outcome, 'duplicate');
	assert.equal(event.message, 'already ingested');
});

test('a failed upload is reported, and the run continues', async () => {
	let n = 0;
	const spy = spyPorts({
		upload: async (name) =>
			++n === 1
				? { ok: false, duplicate: false, message: 'boom' }
				: { ok: true, duplicate: false, message: undefined }
	});
	const events = await run([file('a.SC2Replay'), file('b.SC2Replay')], spy.ports);
	assert.deepEqual(
		events.map((e) => e.outcome),
		['failed', 'uploaded']
	);
});

test('an oversized file is skipped without being read', async () => {
	const spy = spyPorts();
	const events = await run(
		[file('huge.SC2Replay', MAX_UPLOAD_SIZE + 1, async () => assert.fail('read an oversized file'))],
		spy.ports
	);
	assert.deepEqual(events, [{ file: 'huge.SC2Replay', outcome: 'too-large' }]);
});

test('an unreadable archive is skipped rather than uploaded blind', async () => {
	const spy = spyPorts({
		examine: async () => {
			throw new Error('not an SC2 replay');
		},
		upload: async () => assert.fail('uploaded an unreadable file')
	});
	const [event] = await run([file('corrupt.SC2Replay')], spy.ports);
	assert.equal(event.outcome, 'unreadable');
	assert.match(event.message ?? '', /not an SC2 replay/);
});

test('a failed sha probe falls through to uploading, not to skipping', async () => {
	// the probe is an optimisation; the endpoint's own 409 is the real dedupe
	const spy = spyPorts({
		exists: async () => {
			throw new Error('offline');
		}
	});
	const [event] = await run([file('a.SC2Replay')], spy.ports);
	assert.equal(event.outcome, 'uploaded');
});

test('uploads are paced, but nothing waits before the first one', async () => {
	const spy = spyPorts();
	await run([file('a.SC2Replay'), file('b.SC2Replay'), file('c.SC2Replay')], spy.ports);
	const order = spy.calls.filter((c) => c === 'delay' || c.startsWith('upload'));
	assert.deepEqual(order, [
		'upload:a.SC2Replay',
		'delay',
		'upload:b.SC2Replay',
		'delay',
		'upload:c.SC2Replay'
	]);
});

test('skipped files do not trigger a pause', async () => {
	const spy = spyPorts({ examine: async () => ({ isUAR: false, sha256: '' }) });
	await run([file('a.SC2Replay'), file('b.SC2Replay')], spy.ports);
	assert.equal(spy.calls.includes('delay'), false);
});

test('an aborted run stops asking for more files', async () => {
	const controller = new AbortController();
	const spy = spyPorts({
		upload: async (name) => {
			controller.abort();
			return { ok: true, duplicate: false };
		}
	});
	const events = await run([file('a.SC2Replay'), file('b.SC2Replay')], spy.ports, {
		signal: controller.signal
	});
	assert.deepEqual(
		events.map((e) => e.file),
		['a.SC2Replay']
	);
});

test('a second run skips settled files without touching them', async () => {
	const cache = memoryCache();
	const first = spyPorts({ ...cache });
	await run([file('a.SC2Replay'), file('b.SC2Replay')], first.ports);
	assert.equal(cache.map.size, 2, 'nothing was remembered');

	// the same folder again: no read, no parse, no request
	const second = spyPorts({
		...cache,
		examine: async () => assert.fail('re-parsed a file settled last run'),
		exists: async () => assert.fail('re-probed a file settled last run'),
		upload: async () => assert.fail('re-uploaded a file settled last run')
	});
	const events = await run(
		[
			file('a.SC2Replay', 1024, async () => assert.fail('re-read a settled file')),
			file('b.SC2Replay', 1024, async () => assert.fail('re-read a settled file'))
		],
		second.ports
	);
	assert.deepEqual(
		events.map((e) => [e.outcome, e.cached]),
		[
			['uploaded', true],
			['uploaded', true]
		]
	);
});

test('a foreign replay is remembered, so it is only ever parsed once', async () => {
	const cache = memoryCache();
	await run([file('ladder.SC2Replay')], spyPorts({ ...cache, examine: async () => ({ isUAR: false, sha256: '' }) }).ports);
	assert.equal(cache.map.get('ladder.SC2Replay:1024:1700000000000'), 'not-uar');
});

test('a failure is not remembered, so the next run retries it', async () => {
	const cache = memoryCache();
	await run(
		[file('a.SC2Replay')],
		spyPorts({ ...cache, upload: async () => ({ ok: false, duplicate: false }) }).ports
	);
	assert.equal(cache.map.size, 0);
});

test('an unreadable file is not remembered — SC2 may still have been writing it', async () => {
	const cache = memoryCache();
	await run(
		[file('fresh.SC2Replay')],
		spyPorts({
			...cache,
			examine: async () => {
				throw new Error('truncated');
			}
		}).ports
	);
	assert.equal(cache.map.size, 0);
});

test('a rewritten file is a different key, so it is re-examined', async () => {
	const cache = memoryCache();
	await run([file('a.SC2Replay')], spyPorts({ ...cache }).ports);

	const changed: ReplayFile = { ...file('a.SC2Replay'), lastModified: 1_800_000_000_000 };
	const second = spyPorts({ ...cache });
	const [event] = await run([changed], second.ports);
	assert.equal(event.cached, undefined, 'a changed file was served from cache');
	assert.equal(event.outcome, 'uploaded');
});

test('the sync still works with no cache wired up at all', async () => {
	const spy = spyPorts(); // no recall/remember
	const events = await run([file('a.SC2Replay')], spy.ports);
	assert.deepEqual(
		events.map((e) => e.outcome),
		['uploaded']
	);
});

test('hitting the hourly cap stops the run instead of failing the rest', async () => {
	// a player with two thousand recordings can reach the endpoint's limit;
	// grinding on would turn every remaining file into a bogus "skipped"
	const cache = memoryCache();
	let attempts = 0;
	const spy = spyPorts({
		...cache,
		upload: async () => {
			attempts++;
			return attempts === 1
				? { ok: true, duplicate: false }
				: { ok: false, duplicate: false, rateLimited: true, message: 'Too many uploads' };
		}
	});
	const events = await run(
		[file('a.SC2Replay'), file('b.SC2Replay'), file('c.SC2Replay')],
		spy.ports
	);
	assert.deepEqual(
		events.map((e) => e.outcome),
		['uploaded', 'rate-limited'],
		'the run should stop at the cap, not push on'
	);
	assert.equal(attempts, 2, 'kept uploading past the cap');
});

test('a rate-limited file is not remembered, so it retries next hour', async () => {
	const cache = memoryCache();
	await run(
		[file('a.SC2Replay')],
		spyPorts({
			...cache,
			upload: async () => ({ ok: false, duplicate: false, rateLimited: true })
		}).ports
	);
	assert.equal(cache.map.size, 0);
});

test('tally counts every outcome', () => {
	const counts = tally([
		{ file: 'a', outcome: 'uploaded' },
		{ file: 'b', outcome: 'uploaded' },
		{ file: 'c', outcome: 'duplicate' },
		{ file: 'd', outcome: 'not-uar' }
	]);
	assert.equal(counts.uploaded, 2);
	assert.equal(counts.duplicate, 1);
	assert.equal(counts['not-uar'], 1);
	assert.equal(counts.failed, 0);
});
