/**
 * Replay parsing, off the request thread.
 *
 * Parsing a long game costs a few hundred milliseconds of solid CPU —
 * decompressing MPQ sectors and walking bit-packed event streams, all
 * synchronous. On the single always-on machine that meant every page
 * request waited behind whatever the companion was uploading, which is
 * very visible during a backfill. This runs the same code in a worker
 * thread so the event loop keeps answering while it works.
 *
 * The main thread talks to it through `offthread.ts`; it never imports
 * this file directly.
 */

import { parentPort } from 'node:worker_threads';
import { parseReplay, peekReplay } from './extract.ts';

export interface WorkerRequest {
	id: number;
	op: 'peek' | 'parse';
	data: Uint8Array;
	/** parse only — the canonical replay name and the known MOS ids. */
	name?: string;
	mosIds?: string[];
}

export interface WorkerResponse {
	id: number;
	result?: unknown;
	/** Errors do not survive structured cloning, so send the parts we use. */
	error?: { name: string; message: string; stack?: string };
}

if (!parentPort) throw new Error('replay worker started outside a worker thread');
const port = parentPort;

port.on('message', (msg: WorkerRequest) => {
	try {
		const result =
			msg.op === 'peek'
				? peekReplay(msg.data)
				: parseReplay(msg.name!, msg.data, new Set(msg.mosIds));
		port.postMessage({ id: msg.id, result } satisfies WorkerResponse);
	} catch (e) {
		const err = e as Error;
		port.postMessage({
			id: msg.id,
			error: { name: err?.name ?? 'Error', message: err?.message ?? String(e), stack: err?.stack }
		} satisfies WorkerResponse);
	}
});
