<script lang="ts">
	import { page } from '$app/state';

	let { data, children } = $props();
	const replays = $derived([...data.replays].reverse());

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
			Ingested replays <span class="counthint">{replays.length}</span>
		</a>
		<ol>
			{#each replays as r (r.file)}
				{@const id = replayId(r.file)}
				<li>
					<a href="/replays/{id}" class:active={page.params.id === id}>
						<span class="rdate">{r.playedAt.slice(0, 16).replace('T', ' ')}</span>
						<span class="rmeta">
							{r.players} profile{r.players === 1 ? '' : 's'} · {fmtSize(r.size)}
						</span>
					</a>
				</li>
			{/each}
		</ol>
	</nav>

	<div class="rmain">
		{@render children()}
	</div>
</div>

<style>
	.split {
		display: flex;
		gap: 28px;
		align-items: flex-start;
	}

	.rlist {
		flex: 0 0 218px;
		position: sticky;
		top: 0;
		max-height: calc(100dvh - var(--topbar-h) - 52px);
		display: flex;
		flex-direction: column;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--r);
		box-shadow: var(--shadow-1);
		overflow: hidden;
	}
	.rlist-head {
		display: flex;
		align-items: baseline;
		gap: 6px;
		font-family: var(--mono);
		font-size: 10.5px;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-2);
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
		color: var(--ink-3);
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
		border-radius: var(--r-sm);
		text-decoration: none;
		transition: background 100ms ease;
	}
	ol a:hover {
		background: var(--surface-2);
	}
	ol a.active {
		background: var(--accent-soft);
		box-shadow: inset 2.5px 0 0 var(--accent);
	}
	.rdate {
		font-family: var(--mono);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		color: var(--ink);
		font-weight: 550;
	}
	ol a.active .rdate {
		color: var(--accent);
	}
	.rmeta {
		font-size: 11px;
		color: var(--ink-3);
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
