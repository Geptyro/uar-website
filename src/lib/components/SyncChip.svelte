<script lang="ts">
	/**
	 * The always-there way to get a replay onto the site, and the progress of
	 * one already going up.
	 *
	 * Two modes because they suit different people and different browsers. A
	 * file picker works everywhere and is what someone reaches for when a
	 * team-mate sends them a recording; the folder sync is the whole backlog in
	 * one go, and only Chromium can do it. Offering both here means the answer
	 * to "how do I upload this" is in the same place on every page, not only on
	 * /replays.
	 *
	 * The run itself lives in a module, so starting one here and then wandering
	 * off to a player page keeps it going — and keeps this chip counting.
	 */
	import { syncRun } from '../replay/syncState.svelte.ts';
	import {
		isFolderSyncSupported,
		pickReplayFolder,
		rememberFolder,
		recallFolder
	} from '../replay/folder.ts';

	let { compact = false }: { compact?: boolean } = $props();

	let open = $state(false);
	let canPickFolder = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);
	let wrap = $state<HTMLElement | null>(null);

	$effect(() => {
		canPickFolder = isFolderSyncSupported();
	});

	const pct = $derived(syncRun.total ? Math.round((syncRun.done / syncRun.total) * 100) : 0);

	function chooseFiles() {
		open = false;
		fileInput?.click();
	}

	async function onFiles(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const picked = [...(input.files ?? [])];
		input.value = ''; // so picking the same file twice still fires
		await syncRun.startFiles(picked);
	}

	async function chooseFolder() {
		open = false;
		try {
			// reuse the remembered folder rather than making them find it again
			const folder = (await recallFolder()) ?? (await pickReplayFolder());
			if (!folder) return;
			await rememberFolder(folder);
			await syncRun.start(folder);
		} catch (e) {
			syncRun.problem = e instanceof Error ? e.message : String(e);
		}
	}
</script>

<!-- close on any click that is not inside this control, and on Escape.
     Testing containment rather than stopping propagation keeps the wrapper
     a plain, non-interactive element. -->
<svelte:window
	onclick={(e) => {
		if (open && wrap && !wrap.contains(e.target as Node)) open = false;
	}}
	onkeydown={(e) => {
		if (e.key === 'Escape') open = false;
	}}
/>

<input
	type="file"
	accept=".SC2Replay"
	multiple
	bind:this={fileInput}
	onchange={onFiles}
	hidden
	aria-hidden="true"
	tabindex="-1"
/>

<div class="wrap" bind:this={wrap}>
	{#if syncRun.running}
		<a
			class="chip busy"
			class:compact
			href="/replays"
			title="{syncRun.done} of {syncRun.total} replays checked — click to watch"
		>
			<span class="spinner" aria-hidden="true"></span>
			{#if syncRun.phase === 'scanning'}
				<span class="label">Scanning{syncRun.found ? ` ${syncRun.found}` : ''}</span>
			{:else}
				<span class="label mono">{pct}%</span>
				{#if !compact}<span class="sub">{syncRun.uploadedNow} sent</span>{/if}
			{/if}
		</a>
	{:else}
		<button
			class="chip"
			class:compact
			aria-haspopup="menu"
			aria-expanded={open}
			title="Upload a replay"
			onclick={() => (open = !open)}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true">
				<path
					d="M8 11V3m0 0L5 6m3-3 3 3M2.5 10.5v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
			{#if !compact}<span class="label">Upload</span>{/if}
		</button>

		{#if open}
			<div class="menu" role="menu">
				<button role="menuitem" onclick={chooseFiles}>
					<b>Upload a replay</b>
					<span>Pick one or more files — works in any browser</span>
				</button>
				{#if canPickFolder}
					<button role="menuitem" onclick={chooseFolder}>
						<b>Sync my replay folder</b>
						<span>Whole backlog at once, checked on your machine</span>
					</button>
				{:else}
					<a role="menuitem" href="/companion">
						<b>Sync your whole folder</b>
						<span>Needs Chrome or Edge — or the companion app</span>
					</a>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	.wrap {
		position: relative;
		display: inline-flex;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		height: 28px;
		padding: 0 10px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface);
		color: var(--text-dim);
		font: inherit;
		font-size: 12px;
		text-decoration: none;
		white-space: nowrap;
		cursor: pointer;
	}
	.chip:hover {
		border-color: var(--accent);
		color: var(--text);
	}
	.compact {
		padding: 0 8px;
	}
	.chip svg {
		width: 13px;
		height: 13px;
	}
	.label {
		font-variant-numeric: tabular-nums;
	}
	.sub {
		color: var(--text-faint);
	}
	.menu {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		z-index: 40;
		min-width: 244px;
		display: grid;
		padding: 4px;
		border: 1px solid var(--border);
		border-radius: var(--radius-2);
		background: var(--surface-raised, var(--surface));
		box-shadow: var(--shadow-2);
	}
	.menu button,
	.menu a {
		display: grid;
		gap: 1px;
		padding: 7px 9px;
		border: 0;
		border-radius: var(--radius-2);
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}
	.menu button:hover,
	.menu a:hover {
		background: var(--surface-sunken, var(--surface));
	}
	.menu b {
		font-size: 12.5px;
		font-weight: 600;
		color: var(--text);
	}
	.menu span {
		font-size: 11px;
		color: var(--text-faint);
	}
	.spinner {
		width: 10px;
		height: 10px;
		border: 2px solid var(--border-strong);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	/* a permanently spinning ring is the one thing on this bar that moves;
	   respect anyone who has asked the OS for less of that */
	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation: none;
		}
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
