<script lang="ts">
	/**
	 * Replay sync without installing anything — for the players who say no to
	 * an exe. Reads the folder they hand over, filters to this map on their
	 * own machine, uploads what the site does not already have.
	 *
	 * The run itself lives in `syncState.svelte.ts`, not here: a first sync of
	 * a large folder takes minutes, and component state would abandon it the
	 * moment someone clicked through to a player page. This is a view over it,
	 * and the top-bar chip is another.
	 *
	 * Chromium desktop only, and rather than hide the section elsewhere the
	 * unsupported branch says so plainly and points at the app: someone on
	 * Firefox reading "install the app" understands it; a section that is
	 * simply missing looks broken.
	 */
	import { onMount } from 'svelte';
	import {
		isFolderSyncSupported,
		pickReplayFolder,
		rememberFolder,
		recallFolder,
		forgetFolder,
		type DirectoryHandle
	} from '../replay/folder.ts';
	import { syncRun } from '../replay/syncState.svelte.ts';

	/**
	 * Three states, not two. Feature detection only exists on the client, so
	 * starting at `false` renders "your browser cannot do this" during SSR and
	 * flashes it at every Chrome user until hydration corrects it. `null` means
	 * "not known yet" and renders neither branch.
	 */
	let supported = $state<boolean | null>(null);
	let folder = $state<DirectoryHandle | null>(null);
	/**
	 * Installed apps keep a folder grant between sessions; a plain tab cannot
	 * (Chrome 122+, installed only). So the tab gets told the one dialog is
	 * expected — an unexplained permission prompt on a page about uploading
	 * your files is exactly the moment someone closes the tab.
	 */
	let installed = $state(false);

	onMount(async () => {
		supported = isFolderSyncSupported();
		installed = window.matchMedia('(display-mode: standalone)').matches;
		if (supported) folder = await recallFolder();
	});

	async function choose() {
		try {
			const picked = await pickReplayFolder();
			if (!picked) return; // they closed the picker
			folder = picked;
			await rememberFolder(picked);
			await syncRun.start(picked);
		} catch (e) {
			syncRun.problem = e instanceof Error ? e.message : String(e);
		}
	}

	async function useAnother() {
		await forgetFolder();
		folder = null;
		syncRun.reset();
		await choose();
	}
</script>

<h2 class="section">Or sync your whole replay folder</h2>

{#if supported === null}
	<!-- server render and the moment before hydration: say nothing rather than
	     guess wrong in either direction -->
	<p class="note placeholder" aria-hidden="true">&nbsp;</p>
{:else if !supported}
	<p class="note">
		Your browser cannot hand a folder to a web page — that needs Chrome, Edge or another
		Chromium browser on desktop. On Firefox, Safari or a phone, the
		<a href="/companion">UAR Companion</a> is the way to keep your
		replays in sync.
	</p>
{:else}
	<p class="note">
		Point this at your StarCraft II replay folder and it uploads the Undead Assault Reborn games
		it finds. Everything else is ignored — the map is checked
		<b>on your machine</b>, before anything is sent. The site never learns where the folder is,
		only that you allowed it to read one, and you can take that back in your browser settings.
	</p>
	<p class="note small">
		A big folder takes a while, so it keeps running while you browse the rest of the site — watch
		the progress in the top bar. Closing the tab or reloading does stop it, but nothing is lost:
		start again and it carries on from where it got to. To have it happen while you play, without
		thinking about it at all, that's what the <a href="/companion">UAR Companion</a> is for.
	</p>

	{#if syncRun.phase === 'syncing' || (syncRun.phase === 'done' && syncRun.done)}
		<div class="tiles">
			<div class="tile"><b>{syncRun.uploadedNow}</b><span>uploaded now</span></div>
			<div class="tile"><b>{syncRun.alreadyThere}</b><span>already on the site</span></div>
			<div class="tile"><b>{syncRun.counts['not-uar']}</b><span>other maps</span></div>
			{#if syncRun.skipped}
				<div class="tile bad"><b>{syncRun.skipped}</b><span>skipped</span></div>
			{/if}
		</div>
	{/if}

	<div class="row">
		{#if syncRun.phase === 'idle'}
			<button class="go" onclick={() => (folder ? syncRun.start(folder) : choose())}>
				{folder ? `Sync ${folder.name}` : 'Choose your replay folder'}
			</button>
			{#if folder}
				<button class="quiet" onclick={useAnother}>Use a different folder</button>
			{/if}
		{:else if syncRun.phase === 'scanning'}
			<span class="status">Looking through {syncRun.folderName}… {syncRun.found ? `${syncRun.found} replays` : ''}</span>
		{:else if syncRun.phase === 'syncing'}
			<span class="status mono">{syncRun.done}/{syncRun.total} · {syncRun.current}</span>
			<button class="quiet" onclick={() => syncRun.stop()}>Stop</button>
		{:else}
			<button class="go" onclick={() => folder && syncRun.start(folder)}>Sync again</button>
			<button class="quiet" onclick={useAnother}>Use a different folder</button>
		{/if}
	</div>

	{#if syncRun.rateLimited}
		<p class="note problem">
			The server takes a limited number of uploads an hour, and this run reached it — everything
			above went through. Come back in an hour and press sync again: the games already sent are
			remembered, so it picks up exactly where it stopped.
		</p>
	{:else if syncRun.problem}
		<p class="note problem">{syncRun.problem}</p>
	{/if}

	{#if folder && !installed && syncRun.phase === 'idle'}
		<p class="note small">
			Your folder is remembered, but a browser tab only holds the permission until you close it —
			so Chrome asks once more each visit. Installing this site as an app
			(<b>⋮ → Cast, save and share → Install page as app</b>) keeps the permission, and the sync
			becomes a single click.
		</p>
	{/if}
{/if}

<style>
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		margin-top: 12px;
	}
	button {
		font: inherit;
		font-size: 13px;
		border-radius: var(--radius-2);
		border: 1px solid var(--border);
		padding: 8px 14px;
		cursor: pointer;
	}
	.go {
		background: var(--accent);
		color: var(--accent-contrast);
		border-color: var(--accent);
		font-weight: 600;
	}
	.quiet {
		background: transparent;
		color: var(--text-dim);
	}
	button:hover {
		filter: brightness(1.08);
	}
	.status {
		font-size: 13px;
		color: var(--text-dim);
		/* a long replay name must not reflow the buttons next to it */
		max-width: 46ch;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tile span {
		font-size: 11px;
		color: var(--text-faint);
	}
	.tile.bad b {
		color: var(--danger);
	}
	.problem {
		color: var(--danger);
		margin-top: 10px;
	}
</style>
