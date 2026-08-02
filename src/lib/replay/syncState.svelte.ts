/**
 * Sync progress as module state rather than component state, so a run outlives
 * the page that started it.
 *
 * A first sync of a large folder is minutes of work. Component state dies the
 * moment someone clicks through to a player page, which would silently abandon
 * a run halfway and leave half a backlog uploaded with nothing said about it.
 * A module lives as long as the tab, so the sync keeps going and the top-bar
 * chip can report it from anywhere on the site.
 *
 * The limit is honest and worth saying out loud in the UI: this survives
 * in-app navigation, not a reload and not closing the tab. There is no way to
 * keep reading a folder handle without a live page.
 */

import { collectReplays, ensureReadPermission, type DirectoryHandle } from './folder.ts';
import { syncReplays, emptyTally, type Tally } from './sync.ts';
import { browserPorts } from './ports.ts';

export type Phase = 'idle' | 'scanning' | 'syncing' | 'done';

class SyncRun {
	phase = $state<Phase>('idle');
	counts = $state<Tally>(emptyTally());
	/** Uploads that happened on *this* run, as opposed to files already known. */
	uploadedNow = $state(0);
	done = $state(0);
	total = $state(0);
	/** Files discovered so far while scanning — the folder walk is not instant. */
	found = $state(0);
	current = $state('');
	problem = $state('');
	folderName = $state('');

	#controller: AbortController | null = null;

	get running(): boolean {
		return this.phase === 'scanning' || this.phase === 'syncing';
	}

	get rateLimited(): boolean {
		return this.counts['rate-limited'] > 0;
	}

	get alreadyThere(): number {
		return this.counts.uploaded + this.counts.duplicate - this.uploadedNow;
	}

	get skipped(): number {
		return this.counts.failed + this.counts.unreadable + this.counts['too-large'];
	}

	reset(): void {
		this.phase = 'idle';
		this.counts = emptyTally();
		this.uploadedNow = 0;
		this.done = 0;
		this.total = 0;
		this.found = 0;
		this.current = '';
		this.problem = '';
	}

	stop(): void {
		this.#controller?.abort();
	}

	/**
	 * Files the player picked by hand, rather than a whole folder.
	 *
	 * Same engine, so a hand-picked replay gets the same treatment: checked
	 * locally, deduplicated against what the site has, and never sent if it
	 * belongs to another map. The only difference is where the list came from
	 * — which also means this path works in every browser, since it needs a
	 * file input rather than the Chromium-only directory picker.
	 */
	async startFiles(picked: File[]): Promise<void> {
		if (this.running || !picked.length) return;
		this.reset();
		this.folderName = picked.length === 1 ? picked[0].name : `${picked.length} files`;
		this.total = picked.length;
		this.found = picked.length;
		this.phase = 'syncing';
		this.#controller = new AbortController();

		const files = picked.map((file) => ({
			name: file.name,
			size: file.size,
			lastModified: file.lastModified,
			bytes: async () => new Uint8Array(await file.arrayBuffer())
		}));

		try {
			for await (const event of syncReplays(files, browserPorts(), {
				signal: this.#controller.signal
			})) {
				this.current = event.file;
				this.counts[event.outcome]++;
				if (event.outcome === 'uploaded' && !event.cached) this.uploadedNow++;
				this.done++;
			}
		} catch (e) {
			this.problem = e instanceof Error ? e.message : String(e);
		}
		this.current = '';
		this.phase = 'done';
	}

	/**
	 * Must be called from a click: asking for folder permission needs a user
	 * gesture, and a tab that has been reopened will not have one to spend.
	 */
	async start(folder: DirectoryHandle): Promise<void> {
		if (this.running) return;
		this.reset();
		this.folderName = folder.name;

		if (!(await ensureReadPermission(folder))) {
			this.problem = 'Without read access to the folder there is nothing to sync.';
			return;
		}

		this.phase = 'scanning';
		let files;
		try {
			files = await collectReplays(folder, (n) => (this.found = n));
		} catch (e) {
			this.problem = e instanceof Error ? e.message : String(e);
			this.phase = 'idle';
			return;
		}

		this.total = files.length;
		if (!this.total) {
			this.problem = 'No .SC2Replay files under that folder — try the one above it.';
			this.phase = 'idle';
			return;
		}

		this.phase = 'syncing';
		this.#controller = new AbortController();
		try {
			for await (const event of syncReplays(files, browserPorts(), {
				signal: this.#controller.signal
			})) {
				this.current = event.file;
				this.counts[event.outcome]++;
				if (event.outcome === 'uploaded' && !event.cached) this.uploadedNow++;
				this.done++;
			}
		} catch (e) {
			this.problem = e instanceof Error ? e.message : String(e);
		}
		this.current = '';
		this.phase = 'done';
	}
}

/** One run per tab. Shared by the /replays panel and the top-bar chip. */
export const syncRun = new SyncRun();
