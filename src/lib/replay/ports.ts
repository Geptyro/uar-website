/**
 * The real implementations behind `SyncPorts` — everything that touches the
 * network, WebCrypto, or the MPQ reader. Split from `sync.ts` so the engine
 * there stays loadable (and testable) outside a browser.
 */

import type { SyncPorts } from './sync.ts';
import { isUARReplay } from './sniff.ts';
import { recallVerdict, rememberVerdict } from './folder.ts';
import type { ExamineRequest, ExamineResult } from './sniff-worker.ts';

async function sha256Hex(bytes: Uint8Array): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Same work the worker does, for when there is no worker to do it. */
async function examineInline(bytes: Uint8Array) {
	if (!isUARReplay(bytes)) return { isUAR: false, sha256: '' };
	return { isUAR: true, sha256: await sha256Hex(bytes) };
}

/**
 * One worker, many files, answers matched by id.
 *
 * Parsing an MPQ archive is synchronous CPU work, and a player can hand us a
 * folder of two thousand recordings — on the main thread that is a page that
 * stops responding for the length of the scan. One worker is enough: the sync
 * examines one file at a time anyway, and the uploads it feeds are paced.
 *
 * Falls back to doing the work inline if a worker cannot be created, because a
 * sluggish sync is better than no sync.
 */
function workerExaminer(): SyncPorts['examine'] {
	let worker: Worker | null = null;
	try {
		worker = new Worker(new URL('./sniff-worker.ts', import.meta.url), { type: 'module' });
	} catch {
		return examineInline;
	}

	const pending = new Map<
		number,
		{ resolve: (v: { isUAR: boolean; sha256: string }) => void; reject: (e: Error) => void }
	>();
	let nextId = 0;

	worker.onmessage = (event: MessageEvent<ExamineResult>) => {
		const { id, isUAR, sha256, error } = event.data;
		const waiting = pending.get(id);
		if (!waiting) return;
		pending.delete(id);
		if (error) waiting.reject(new Error(error));
		else waiting.resolve({ isUAR, sha256: sha256 ?? '' });
	};

	// a worker that dies takes every in-flight answer with it; fail them rather
	// than leave the sync hanging on promises that will never settle
	worker.onerror = () => {
		for (const [, waiting] of pending) waiting.reject(new Error('replay worker failed'));
		pending.clear();
	};

	return (bytes) =>
		new Promise((resolve, reject) => {
			const id = nextId++;
			pending.set(id, { resolve, reject });
			// structured clone rather than transfer: transferring would detach
			// the caller's buffer, and the caller still needs it to upload
			worker.postMessage({ id, bytes } satisfies ExamineRequest);
		});
}

/**
 * The endpoint answers errors as text, and SvelteKit renders them as an HTML
 * page unless JSON is asked for. Pull out the message either way rather than
 * showing a player a fragment of markup.
 */
function serverMessage(raw: string): string | undefined {
	const trimmed = raw.trim();
	if (!trimmed) return undefined;
	if (trimmed.startsWith('{')) {
		try {
			const body = JSON.parse(trimmed) as { message?: string; error?: string };
			return body.message ?? body.error ?? undefined;
		} catch {
			/* fall through to the raw text */
		}
	}
	if (trimmed.startsWith('<')) return undefined;
	return trimmed;
}

export function browserPorts(fetchImpl: typeof fetch = fetch): SyncPorts {
	return {
		examine: workerExaminer(),
		delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
		recall: recallVerdict,
		remember: rememberVerdict,

		async exists(sha256) {
			const res = await fetchImpl(`/api/replays?sha256=${sha256}`, {
				headers: { accept: 'application/json' }
			});
			if (!res.ok) throw new Error(`sha check: HTTP ${res.status}`);
			const body = (await res.json()) as { exists?: boolean };
			return body.exists === true;
		},

		async upload(name, bytes) {
			const form = new FormData();
			// same field name the companion uses, because it is the same endpoint
			form.append('replay', new Blob([bytes as BlobPart]), name);
			let res: Response;
			try {
				res = await fetchImpl('/api/replays', {
					method: 'POST',
					body: form,
					headers: { accept: 'application/json' }
				});
			} catch (e) {
				return { ok: false, duplicate: false, message: String(e) };
			}
			const message = serverMessage(await res.text().catch(() => ''));
			if (res.ok) return { ok: true, duplicate: false, message };
			// 409 is the endpoint saying someone already uploaded this game —
			// usually a team-mate's recording of it. Not a failure.
			// 429 is the hourly cap, and it will not clear during this run.
			return {
				ok: false,
				duplicate: res.status === 409,
				rateLimited: res.status === 429,
				message
			};
		}
	};
}
