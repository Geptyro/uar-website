/**
 * The player's replay folder, as far as a browser can reach it.
 *
 * The File System Access API hands back an opaque handle, not a path — the
 * site never learns where the files are, only that it may read them, and the
 * player revokes that in browser settings rather than by uninstalling
 * anything. That is the whole pitch over the desktop app, so it is worth
 * being precise about in the UI.
 *
 * Chromium desktop only: Firefox and Safari implement none of the pickers,
 * and no mobile browser does. `isFolderSyncSupported()` is the gate.
 */

import type { ReplayFile } from './sync.ts';

/**
 * Minimal shape of the bits we use. TypeScript's DOM library still does not
 * declare the picker, and pulling a whole @types package for one call is not
 * worth it.
 */
interface DirectoryHandle {
	kind: 'directory';
	name: string;
	values(): AsyncIterableIterator<DirectoryHandle | FileHandleLike>;
	queryPermission(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
	requestPermission(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
}
interface FileHandleLike {
	kind: 'file';
	name: string;
	getFile(): Promise<File>;
}
declare global {
	interface Window {
		showDirectoryPicker?: (options?: {
			mode?: 'read' | 'readwrite';
			startIn?: string;
			id?: string;
		}) => Promise<DirectoryHandle>;
	}
}

export type { DirectoryHandle };

const DB_NAME = 'uar-replay-sync';
const DB_VERSION = 2;
const STORE = 'handles';
const VERDICTS = 'verdicts';
const KEY = 'replay-folder';

/** How deep to walk. `Replays/Multiplayer` is two, so four is slack, not ambition. */
const MAX_DEPTH = 4;

export function isFolderSyncSupported(): boolean {
	return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
			if (!db.objectStoreNames.contains(VERDICTS)) db.createObjectStore(VERDICTS);
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

function tx<T>(
	name: string,
	mode: IDBTransactionMode,
	run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
	return openDb().then(
		(db) =>
			new Promise<T>((resolve, reject) => {
				const request = run(db.transaction(name, mode).objectStore(name));
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			})
	);
}

/**
 * A handle is structured-cloneable but not serialisable — there is no path
 * string inside it — so IndexedDB rather than localStorage, which only holds
 * strings.
 */
export async function rememberFolder(handle: DirectoryHandle): Promise<void> {
	await tx(STORE, 'readwrite', (store) => store.put(handle, KEY));
}

export async function recallFolder(): Promise<DirectoryHandle | null> {
	try {
		return (await tx<DirectoryHandle | undefined>(STORE, 'readonly', (s) => s.get(KEY))) ?? null;
	} catch {
		return null;
	}
}

export async function forgetFolder(): Promise<void> {
	await tx(STORE, 'readwrite', (store) => store.delete(KEY));
	await tx(VERDICTS, 'readwrite', (store) => store.clear());
}

/**
 * What this browser already decided about a file, so a second sync does not
 * re-read and re-parse a folder it has seen.
 *
 * Without this, every run costs one disk read plus one MPQ parse per file,
 * and one network probe per replay that turns out to be ours — on a player
 * with a few hundred recordings the second sync is as slow as the first, for
 * no new information. Only settled verdicts are stored; see `rememberVerdict`.
 */
export async function recallVerdict(key: string): Promise<string | undefined> {
	try {
		return await tx<string | undefined>(VERDICTS, 'readonly', (s) => s.get(key));
	} catch {
		return undefined; // a cache that cannot be read is just a slow sync
	}
}

export async function rememberVerdict(key: string, verdict: string): Promise<void> {
	try {
		await tx(VERDICTS, 'readwrite', (store) => store.put(verdict, key));
	} catch {
		/* not worth failing a sync over */
	}
}

export async function pickReplayFolder(): Promise<DirectoryHandle | null> {
	if (!window.showDirectoryPicker) throw new Error('folder picking is not supported here');
	try {
		// `id` makes the browser reopen where they chose last time
		return await window.showDirectoryPicker({ mode: 'read', id: 'uar-replays' });
	} catch (e) {
		// the picker rejects with AbortError when the player closes it
		if (e instanceof DOMException && e.name === 'AbortError') return null;
		throw e;
	}
}

/**
 * The handle survives a restart; the grant may not. Chrome can keep it for an
 * installed PWA, in which case this returns true without prompting — but a
 * prompt only works from a user gesture, so call this from a click, never on
 * page load.
 */
export async function ensureReadPermission(handle: DirectoryHandle): Promise<boolean> {
	const descriptor = { mode: 'read' } as const;
	if ((await handle.queryPermission(descriptor)) === 'granted') return true;
	return (await handle.requestPermission(descriptor)) === 'granted';
}

/**
 * Every `.SC2Replay` under the chosen folder. Players hand over `Replays`,
 * `Replays/Multiplayer`, or sometimes the account folder above both, so this
 * walks down rather than insisting they find the exact one.
 */
export async function collectReplays(
	handle: DirectoryHandle,
	onFound?: (count: number) => void,
	depth = 0,
	found: ReplayFile[] = []
): Promise<ReplayFile[]> {
	if (depth > MAX_DEPTH) return found;
	for await (const entry of handle.values()) {
		if (entry.kind === 'directory') {
			await collectReplays(entry, onFound, depth + 1, found);
			continue;
		}
		if (!entry.name.toLowerCase().endsWith('.sc2replay')) continue;
		// getFile() is a stat, not a read — but a folder can hold a couple of
		// thousand of them, and without a running count the UI sits on
		// "Looking through…" long enough to look hung
		const file = await entry.getFile();
		found.push({
			name: entry.name,
			size: file.size,
			lastModified: file.lastModified,
			bytes: async () => new Uint8Array(await file.arrayBuffer())
		});
		if (found.length % 50 === 0) onFound?.(found.length);
	}
	if (depth > 0) return found; // a nested level is not the finished list

	onFound?.(found.length);
	// newest first: a player watching a long sync sees the games they actually
	// remember playing show up before the ones from months ago
	return found.sort((a, b) => b.name.localeCompare(a.name));
}
