<script lang="ts">
	import { page } from '$app/state';
	import Pager from '$lib/components/Pager.svelte';
	import OutcomeMark from '$lib/components/OutcomeMark.svelte';
	import { fmtDuration } from '$lib/outcome';
	import ModeMark from '$lib/components/ModeMark.svelte';
	import ModifierMark from '$lib/components/ModifierMark.svelte';
	import { orderModifiers } from '$lib/modifiers';

	let { data, children } = $props();
	const replays = $derived(data.replays); // already newest-first from the server

	function replayId(file: string): string {
		return file.replace(/\.SC2Replay$/, '');
	}

	function fmtSize(bytes: number): string {
		return bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
	}
</script>

<div class="split">
	<nav class="rlist" aria-label="Ingested replays">
		<a class="rlist-head" href="/replays" class:active={!page.params.id}>
			Ingested replays <span class="counthint">{data.total}</span>
		</a>
		<ol>
			{#each replays as r (r.file)}
				{@const id = replayId(r.file)}
				<li>
					<a href="/replays/{id}" class:active={page.params.id === id}>
						<span class="rdate">
							{r.playedAt.slice(0, 16).replace('T', ' ')}
							<OutcomeMark outcome={r.outcome} />
						</span>
						<span class="rmeta">
							{#if r.mode || r.modifiers?.length}<span class="rtags"
								>{#if r.mode}<ModeMark mode={r.mode} />{/if}{#each orderModifiers(
									r.modifiers ?? []
								) as id (id)}<ModifierMark {id} iconOnly focusable={false} />{/each}</span
							> · {/if}{r.players} profile{r.players === 1 ? '' : 's'}{#if r.gameLoops}
								· <span class="rdur">{fmtDuration(r.gameLoops)}</span>{/if} ·
							<span class:struck={r.blobPruned}>{fmtSize(r.size)}</span
							>{#if r.blobPruned}<span
									class="notstored"
									title="File no longer stored — the game is still on record"
								>
									· not stored</span
								>{/if}
						</span>
					</a>
				</li>
			{/each}
		</ol>
		<div class="rpager">
			<Pager page={data.page} pages={data.pages} total={data.total} label="replays" />
		</div>
	</nav>

	<div class="rmain">
		{@render children()}
	</div>
</div>

<style>
	.rpager {
		padding: 0 10px;
	}
	.split {
		display: flex;
		gap: 28px;
		align-items: flex-start;
	}

	.rlist {
		flex: 0 0 218px;
		position: sticky;
		top: 0;
		max-height: calc(100dvh - var(--chrome-h) - 52px);
		display: flex;
		flex-direction: column;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-3);
		box-shadow: var(--shadow-1);
		overflow: hidden;
	}
	.rlist-head {
		display: flex;
		align-items: baseline;
		gap: 6px;
		font-family: var(--font-mono);
		font-size: 10.5px;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text-dim);
		text-decoration: none;
		padding: 11px 13px 9px;
		border-bottom: 1px solid var(--border);
	}
	.rlist-head:hover {
		color: var(--accent);
	}
	.rlist-head.active {
		color: var(--accent);
		box-shadow: inset 2.5px 0 0 var(--accent);
	}
	.counthint {
		font-weight: 400;
		color: var(--text-faint);
	}

	ol {
		list-style: none;
		margin: 0;
		padding: 5px;
		overflow-y: auto;
	}
	ol a {
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding: 6px 9px;
		border-radius: var(--radius-2);
		text-decoration: none;
		transition: background 100ms ease;
	}
	ol a:hover {
		background: var(--surface-raised);
	}
	ol a.active {
		background: var(--accent-soft);
		box-shadow: inset 2.5px 0 0 var(--accent);
	}
	.rdate {
		display: flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-mono);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		color: var(--text);
		font-weight: 550;
	}
	ol a.active .rdate {
		color: var(--accent);
	}
	.rmeta {
		font-size: 11px;
		color: var(--text-faint);
	}
	/* the mode mark and the modifier chips share a centre line rather than a
	   baseline — a bordered chip and plain coloured text do not sit on the same
	   one — and the group as a whole aligns to the middle of the meta text it
	   leads */
	.rmeta .rtags {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		vertical-align: middle;
	}
	.rmeta .rdur {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	/* the size stays part of the game's record, but the bytes are gone — strike
	   it so the row does not advertise a download that is not there */
	.rmeta .struck {
		text-decoration: line-through;
		opacity: 0.6;
	}
	.rmeta .notstored {
		opacity: 0.75;
		font-style: italic;
	}

	.rmain {
		flex: 1;
		min-width: 0;
	}

	@media (max-width: 820px) {
		.split {
			flex-direction: column-reverse;
		}
		.rlist {
			position: static;
			max-height: 320px;
			flex: none;
			width: 100%;
		}
		.rmain {
			width: 100%;
		}
	}
</style>
