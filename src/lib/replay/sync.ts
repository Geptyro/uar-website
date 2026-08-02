/**
 * Browser-side replay sync — the same job the companion's upload queue does,
 * for players who will not install a desktop app.
 *
 * Everything the browser cannot provide is injected, so the whole decision
 * tree is testable under plain node:test: what counts as ours, what the
 * server already has, how fast to go. `browserPorts()` at the bottom wires
 * the real ones.
 *
 * Order matters and is not arbitrary. The map-title check runs *before* the
 * sha lookup even though sniffing costs more, because the sha lookup is a
 * network round trip that tells the server "someone here has a file with
 * this hash" — and for a replay that turns out not to be ours, that is one
 * bit more than the player agreed to share.
 */

import { MAX_UPLOAD_SIZE } from 'uar-shared/replay';

export type SyncOutcome =
	| 'uploaded'
	| 'duplicate'
	| 'not-uar'
	| 'unreadable'
	| 'too-large'
	| 'rate-limited'
	| 'failed';

export interface SyncEvent {
	file: string;
	outcome: SyncOutcome;
	/** Server wording where there is any, for the "what happened" line. */
	message?: string;
	/** Settled on a previous run — nothing was read, parsed or requested. */
	cached?: boolean;
}

/** One candidate on disk. Bytes are read lazily — a folder can hold hundreds. */
export interface ReplayFile {
	name: string;
	size: number;
	/** Epoch millis, part of the identity key. Never read from disk. */
	lastModified: number;
	bytes(): Promise<Uint8Array>;
}

/**
 * Identity without opening the file. SC2 writes a replay once and never
 * touches it again, so name plus size plus mtime is stable enough to skip on
 * — and all three come from the directory listing, which is the whole point.
 */
export function fileKey(file: ReplayFile): string {
	return `${file.name}:${file.size}:${file.lastModified}`;
}

/**
 * Verdicts worth remembering. A failure must be retried, and "unreadable" is
 * not necessarily permanent — syncing seconds after a game ends can catch a
 * replay SC2 is still writing, and that file becomes perfectly readable a
 * moment later. Caching that would hide the game forever.
 */
const SETTLED: ReadonlySet<SyncOutcome> = new Set<SyncOutcome>([
	'uploaded',
	'duplicate',
	'not-uar'
]);

export interface SyncPorts {
	/**
	 * Is this one of ours, and what is its digest? One call because the two
	 * answers come from the same pass over the same bytes — and because in the
	 * browser that pass happens in a worker, so asking separately would mean
	 * shipping the file across the thread boundary twice.
	 *
	 * Throws when the archive cannot be read at all.
	 */
	examine(bytes: Uint8Array): Promise<{ isUAR: boolean; sha256: string }>;
	/** GET /api/replays?sha256= — cheap "already have it?" probe. */
	exists(sha256: string): Promise<boolean>;
	/** POST /api/replays. Resolves for every answer; never throws for a 4xx. */
	upload(
		name: string,
		bytes: Uint8Array
	): Promise<{ ok: boolean; duplicate: boolean; rateLimited?: boolean; message?: string }>;
	delay(ms: number): Promise<void>;
	/** Local memory of settled files. Optional: without it, every run is a cold one. */
	recall?(key: string): Promise<string | undefined>;
	remember?(key: string, outcome: SyncOutcome): Promise<void>;
}

export interface SyncOptions {
	/**
	 * Gap between uploads. The endpoint allows 1000/hour per address and a
	 * first-time sync of a long-running player can be hundreds of files, so
	 * a backlog trickles rather than burning the whole allowance at once —
	 * and rather than saturating the uplink of someone who may be in a game.
	 */
	pauseBetweenUploadsMs?: number;
	signal?: AbortSignal;
}

/**
 * Walks the candidates, yielding one event per file as it is decided.
 * A generator rather than a callback so the caller drives the pace and can
 * stop simply by not asking for the next one.
 */
export async function* syncReplays(
	files: Iterable<ReplayFile> | AsyncIterable<ReplayFile>,
	ports: SyncPorts,
	options: SyncOptions = {}
): AsyncGenerator<SyncEvent> {
	const pause = options.pauseBetweenUploadsMs ?? 1_500;
	let uploadedSomething = false;

	for await (const file of files) {
		if (options.signal?.aborted) return;

		// cheapest possible skip: decided last time, and the file has not
		// changed since. No read, no parse, no request.
		const key = fileKey(file);
		const remembered = (await ports.recall?.(key)) as SyncOutcome | undefined;
		if (remembered && SETTLED.has(remembered)) {
			yield { file: file.name, outcome: remembered, cached: true };
			continue;
		}

		if (file.size > MAX_UPLOAD_SIZE) {
			yield { file: file.name, outcome: 'too-large' };
			continue;
		}

		let bytes: Uint8Array;
		try {
			bytes = await file.bytes();
		} catch (e) {
			yield { file: file.name, outcome: 'unreadable', message: String(e) };
			continue;
		}

		// ours? — decided locally, before anything about this file is sent
		let sha: string;
		try {
			const seen = await ports.examine(bytes);
			if (!seen.isUAR) {
				await settle(ports, key, 'not-uar');
				yield { file: file.name, outcome: 'not-uar' };
				continue;
			}
			sha = seen.sha256;
		} catch (e) {
			yield { file: file.name, outcome: 'unreadable', message: String(e) };
			continue;
		}

		try {
			if (await ports.exists(sha)) {
				await settle(ports, key, 'duplicate');
				yield { file: file.name, outcome: 'duplicate' };
				continue;
			}
		} catch {
			// the probe is an optimisation; a failed one just means we upload
			// and let the endpoint's own 409 do the deduplicating
		}

		// pace before the upload, not after, so a run that ends on an upload
		// does not sit waiting for nothing
		if (uploadedSomething) await ports.delay(pause);
		if (options.signal?.aborted) return;

		const result = await ports.upload(file.name, bytes);
		uploadedSomething = true;

		// The endpoint allows a fixed number of uploads an hour per address.
		// A player with a couple of thousand recordings can reach it, and once
		// they have, every remaining file would fail for the same reason — so
		// stop rather than grind through hundreds of guaranteed rejections and
		// present them as "skipped".
		if (result.rateLimited) {
			yield { file: file.name, outcome: 'rate-limited', message: result.message };
			return;
		}

		const outcome: SyncOutcome = result.ok
			? 'uploaded'
			: result.duplicate
				? 'duplicate'
				: 'failed';
		await settle(ports, key, outcome);
		yield { file: file.name, outcome, message: result.message };
	}
}

/** Records a verdict if it is one worth not repeating. */
async function settle(ports: SyncPorts, key: string, outcome: SyncOutcome): Promise<void> {
	if (SETTLED.has(outcome)) await ports.remember?.(key, outcome);
}

export type Tally = Record<SyncOutcome, number>;

/**
 * A zero tally to count into. Callers with thousands of files should hold one
 * of these and increment it, rather than keeping every event and re-reducing:
 * a folder of 2000 replays makes that O(n²), and the copying costs more than
 * the uploading.
 */
export function emptyTally(): Tally {
	return {
		uploaded: 0,
		duplicate: 0,
		'not-uar': 0,
		unreadable: 0,
		'too-large': 0,
		'rate-limited': 0,
		failed: 0
	};
}

/** Running totals, for the progress line. */
export function tally(events: SyncEvent[]): Tally {
	const out = emptyTally();
	for (const e of events) out[e.outcome]++;
	return out;
}
