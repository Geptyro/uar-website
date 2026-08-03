/**
 * Main-thread client for the replay parsing worker (`worker.ts`).
 *
 * One worker, spawned on first use and reused: ingest is serialised by the
 * replay lock, so there is never more than a job or two in flight, and
 * respawning per upload would cost more than it saves during a backfill.
 *
 * Every entry point falls back to parsing in-process. A worker that cannot
 * be found or refuses to start must not take uploads down with it — the
 * site simply goes back to the behaviour it had before, blocking the event
 * loop while it parses.
 */

import { Worker } from 'node:worker_threads';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseReplay, peekReplay, type ParsedReplay } from './extract.ts';
import type { WorkerRequest, WorkerResponse } from './worker.ts';

/** A parse that runs this long is not a replay we want to wait on. */
const JOB_TIMEOUT_MS = 30_000;

/**
 * The worker failed us — it timed out, died, or refused a job — as opposed to
 * the replay being unreadable.
 *
 * Worth a type of its own because the two are indistinguishable to whoever
 * awaits a parse, and answering the wrong one is not a cosmetic mistake: a
 * parse that merely ran out of time under load used to come back as "not a
 * readable StarCraft II replay", which is a permanent verdict about the file.
 * The Companion believes it, writes the path off in its state file and never
 * offers that game again — so a busy minute silently cost real replays.
 * A genuine parse failure still arrives as a normal Error, via the worker's
 * own catch, and still means what it says.
 */
export class ReplayWorkerError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = 'ReplayWorkerError';
	}
}

type Pending = {
	resolve: (value: unknown) => void;
	reject: (reason: Error) => void;
	timer: NodeJS.Timeout;
};

let worker: Worker | null = null;
let disabled = false;
let nextId = 1;
const pending = new Map<number, Pending>();

/**
 * Production runs the bundled worker next to the server build; dev runs the
 * source directly, which Node type-strips. Neither existing means we parse
 * in-process — tests and any other embedding still work.
 */
function workerPath(): string | null {
	const candidates = [
		process.env.REPLAY_WORKER,
		join(process.cwd(), 'build', 'replay-worker.mjs'),
		fileURLToPath(new URL('./worker.ts', import.meta.url))
	];
	return candidates.find((p) => p && existsSync(p)) ?? null;
}

function failAll(reason: Error): void {
	for (const [, job] of pending) {
		clearTimeout(job.timer);
		job.reject(reason);
	}
	pending.clear();
}

function getWorker(): Worker | null {
	if (disabled) return null;
	if (worker) return worker;

	const path = workerPath();
	if (!path) {
		disabled = true;
		console.warn('replay worker not found — parsing in-process');
		return null;
	}
	try {
		worker = new Worker(path);
	} catch (e) {
		disabled = true;
		console.warn('replay worker failed to start — parsing in-process:', e);
		return null;
	}
	worker.on('message', (msg: WorkerResponse) => {
		const job = pending.get(msg.id);
		if (!job) return;
		pending.delete(msg.id);
		clearTimeout(job.timer);
		if (msg.error) {
			const err = new Error(msg.error.message);
			err.name = msg.error.name;
			// keep the parse site in the log, not this message handler
			if (msg.error.stack) err.stack = msg.error.stack;
			job.reject(err);
		} else {
			job.resolve(msg.result);
		}
	});
	// a dead worker must not strand the requests waiting on it. Both of these
	// are the worker's failure, never the file's — including for the jobs that
	// were merely queued behind the one that killed it
	worker.on('error', (e) => {
		worker = null;
		failAll(new ReplayWorkerError('replay worker failed', { cause: e }));
	});
	worker.on('exit', () => {
		worker = null;
		failAll(new ReplayWorkerError('replay worker exited'));
	});
	// let the process shut down without waiting on an idle worker
	worker.unref();
	return worker;
}

function run<T>(req: Omit<WorkerRequest, 'id'>, inProcess: () => T): Promise<T> {
	const w = getWorker();
	if (!w) return Promise.resolve(inProcess());
	const id = nextId++;
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => {
			pending.delete(id);
			// it is wedged on this job; a fresh one starts on the next request
			void w.terminate();
			worker = null;
			reject(new ReplayWorkerError(`replay worker timed out after ${JOB_TIMEOUT_MS}ms`));
		}, JOB_TIMEOUT_MS);
		pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
		w.postMessage({ ...req, id } satisfies WorkerRequest);
	});
}

/**
 * Start the worker before the first upload needs it, so nobody pays the
 * spawn plus module load (protocol tables are not small) inside a request.
 * Called from hooks.server.ts at boot; safe to call more than once.
 */
export function warmReplayWorker(): void {
	getWorker();
}

/** Header/details peek — same result as `peekReplay`, off the event loop. */
export function peekReplayOffThread(data: Uint8Array): Promise<ReturnType<typeof peekReplay>> {
	return run({ op: 'peek', data }, () => peekReplay(data));
}

/** Full parse — same result as `parseReplay`, off the event loop. */
export function parseReplayOffThread(
	name: string,
	data: Uint8Array,
	mosIds: Set<string>
): Promise<ParsedReplay> {
	return run({ op: 'parse', data, name, mosIds: [...mosIds] }, () =>
		parseReplay(name, data, mosIds)
	);
}
