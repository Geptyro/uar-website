<script lang="ts">
	import { browser } from '$app/environment';
	import { GridDiagram, type GridEdge } from 'grid-router/svelte';
	import {
		flowNodes,
		flowById,
		upstream,
		eventLabel,
		fmtTime,
		fmtDuration,
		timedStarts,
		type FlowNode
	} from '$lib/flow';

	let query = $state('');
	let selectedId = $state<string>('gt_MayorGate');

	const selected = $derived(flowById.get(selectedId) ?? flowNodes[0]);

	const results = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return [];
		return flowNodes
			.filter(
				(n) =>
					n.name.toLowerCase().includes(q) ||
					n.succeed.some((m) => m.name.toLowerCase().includes(q)) ||
					n.fail.some((m) => m.name.toLowerCase().includes(q))
			)
			.slice(0, 12);
	});

	function pick(id: string) {
		selectedId = id;
		query = '';
	}

	// ---- neighborhood graph: layers by chain depth around the selection ----
	const UP = 2; // ancestor levels
	const DOWN = 3; // descendant levels

	interface Layer {
		depth: number;
		nodes: FlowNode[];
	}

	const graph = $derived.by(() => {
		const depth = new Map<string, number>([[selected.id, 0]]);
		// downstream BFS over enables+executes
		let frontier = [selected.id];
		for (let d = 1; d <= DOWN && frontier.length; d++) {
			const next: string[] = [];
			for (const id of frontier) {
				const n = flowById.get(id);
				if (!n) continue;
				for (const t of [...n.enables, ...n.executes, ...n.timerTo]) {
					if (!depth.has(t) && flowById.has(t)) {
						depth.set(t, d);
						next.push(t);
					}
				}
			}
			frontier = next;
		}
		// upstream BFS
		frontier = [selected.id];
		for (let d = 1; d <= UP && frontier.length; d++) {
			const next: string[] = [];
			for (const id of frontier) {
				for (const p of upstream(id)) {
					if (!depth.has(p.id)) {
						depth.set(p.id, -d);
						next.push(p.id);
					}
				}
			}
			frontier = next;
		}

		const layers: Layer[] = [];
		for (let d = -UP; d <= DOWN; d++) {
			const all = [...depth.entries()]
				.filter(([, dd]) => dd === d)
				.map(([id]) => flowById.get(id))
				.filter((n): n is FlowNode => !!n)
				.sort((a, b) => a.name.localeCompare(b.name));
			if (!all.length) continue;
			layers.push({ depth: d, nodes: all });
		}
		const shown = new Set(layers.flatMap((l) => l.nodes.map((n) => n.id)));

		const edges: GridEdge[] = [];
		for (const id of shown) {
			const n = flowById.get(id);
			if (!n) continue;
			for (const t of n.enables)
				if (shown.has(t)) edges.push({ id: `${id}>e>${t}`, source: id, target: t, bus: `${id}|en`, data: 'enable' });
			for (const t of n.executes)
				if (shown.has(t) && !n.enables.includes(t))
					edges.push({ id: `${id}>x>${t}`, source: id, target: t, bus: `${id}|ex`, data: 'execute' });
			for (const t of n.timerTo)
				if (shown.has(t) && !n.enables.includes(t) && !n.executes.includes(t))
					edges.push({ id: `${id}>t>${t}`, source: id, target: t, bus: `${id}|tm`, data: 'timer' });
			for (const t of n.disables)
				if (shown.has(t)) edges.push({ id: `${id}>d>${t}`, source: id, target: t, bus: `${id}|off`, data: 'disable' });
		}
		return { layers, edges };
	});

	const KIND_COLOR: Record<string, string> = {
		enable: '#7fa35c',
		execute: '#7fadd1',
		disable: '#d06a52',
		timer: '#cfa95c'
	};

	let violations = $state(0);

	// ---- hover highlight: light a whole bus, or everything touching a node ----
	let hoveredBus = $state<string | undefined>(undefined);
	let hoveredNode = $state<string | undefined>(undefined);
	const busKey = (e: GridEdge) => `${e.source}|${e.bus ?? ''}`;
	const activeBuses = $derived.by(() => {
		const s = new Set<string>();
		if (hoveredBus) s.add(hoveredBus);
		else if (hoveredNode) {
			for (const e of graph.edges) {
				if (e.source === hoveredNode || e.target === hoveredNode) s.add(busKey(e));
			}
		}
		return s;
	});
	const anyHover = $derived(activeBuses.size > 0);
	const litNodes = $derived.by(() => {
		const s = new Set<string>();
		if (hoveredNode) s.add(hoveredNode);
		for (const e of graph.edges) {
			if (activeBuses.has(busKey(e))) {
				s.add(e.source);
				s.add(e.target);
			}
		}
		return s;
	});
</script>

<svelte:head>
	<title>Mission flow — UAR Unit Database</title>
</svelte:head>

<p class="note">
	How missions start and chain, reconstructed from the map's trigger script: {flowNodes.length} mission-related
	triggers with their arming events, the triggers they enable or shut down, and their XP outcomes.
</p>

<h2 class="section">Scheduled at fixed game time</h2>
<div class="timeline card">
	{#each timedStarts as t (t.node.id)}
		<div class="tl-row">
			<span class="tl-time">{fmtTime(t.at)}</span>
			<button class="link" onclick={() => pick(t.node.id)}>{t.node.name}</button>
		</div>
	{/each}
</div>

<h2 class="section">Chain graph</h2>
<div class="graph-controls">
	<div class="search-wrap">
		<input
			type="search"
			placeholder="Find a trigger or mission…"
			aria-label="Find a trigger or mission"
			bind:value={query}
		/>
		{#if results.length}
			<div class="results card">
				{#each results as r (r.id)}
					<button class="result" onclick={() => pick(r.id)}>
						{r.name}
						{#if r.succeed.length}<span class="mono dim">{r.succeed[0].name}</span>{/if}
					</button>
				{/each}
			</div>
		{/if}
	</div>
	<div class="legend">
		{#if violations > 0}
			<span class="viol">{violations} routing violations — report layout</span>
		{/if}
		<span><i style="background: {KIND_COLOR.enable}"></i> enables</span>
		<span><i style="background: {KIND_COLOR.execute}"></i> runs</span>
		<span><i style="background: {KIND_COLOR.timer}"></i> via timer</span>
		<span><i class="dash" style="background: {KIND_COLOR.disable}"></i> shuts down</span>
	</div>
</div>

{#if browser}
	<div class="board card">
		<GridDiagram
			edges={graph.edges}
			opts={{ res: 12, exitCost: 6 }}
			revision={selectedId}
			connStyle={(c) => ({
				color: KIND_COLOR[String(c.data ?? 'enable')] ?? KIND_COLOR.enable,
				dashed: c.data === 'disable',
				class: anyHover ? (activeBuses.has(c.bus) ? 'active' : 'dim') : ''
			})}
			onrouted={(info) => (violations = info.violations)}
			onconnenter={(c) => {
				hoveredNode = undefined;
				hoveredBus = c.bus;
			}}
			onconnleave={(c) => {
				if (hoveredBus === c.bus) hoveredBus = undefined;
			}}
		>
			{#snippet children(register)}
				<div class="levels">
					{#each graph.layers as layer (layer.depth)}
						<div class="level">
							{#each layer.nodes as n (n.id)}
							<button
								class="chip"
								class:sel={n.id === selected.id}
								class:has-mission={n.succeed.length > 0 || n.fail.length > 0}
								class:lit={litNodes.has(n.id)}
								class:faded={anyHover && !litNodes.has(n.id)}
								use:register={n.id}
								onclick={() => pick(n.id)}
								onpointerenter={() => {
									hoveredBus = undefined;
									hoveredNode = n.id;
								}}
								onpointerleave={() => {
									if (hoveredNode === n.id) hoveredNode = undefined;
								}}
							>
								<b>{n.name}</b>
								{#if n.events.length}
									<span class="ev">{eventLabel(n.events[0])}</span>
								{:else if !n.armed}
									<span class="ev">chained</span>
								{/if}
								{#if n.succeed.length}
									<span class="ev gain">+{n.succeed[0].xp} {n.succeed[0].name}</span>
								{/if}
									{#if n.fail.length}
										<span class="ev loss">−{n.fail[0].xp} {n.fail[0].name}</span>
									{/if}
								</button>
							{/each}
						</div>
					{/each}
				</div>
			{/snippet}
		</GridDiagram>
	</div>
{/if}

<div class="detail card">
	<div class="detail-head">
		<b>{selected.name}</b>
		<span class="tag" class:t-hostile={!selected.armed}>
			{selected.armed ? 'armed from start' : 'needs enabling'}
		</span>
	</div>
	<div class="detail-grid">
		{#if selected.events.length}
			<div>
				<div class="sub-label">Fires when</div>
				{#each selected.events as e, i (i)}<div class="ev">{eventLabel(e)}</div>{/each}
			</div>
		{/if}
		{#if selected.timers.length}
			<div>
				<div class="sub-label">Starts timers</div>
				{#each selected.timers as t (t.var + t.dur)}
					<div class="ev">{t.var.replace('gv_', '')} · {fmtDuration(t.dur)}</div>
				{/each}
			</div>
		{/if}
		{#if selected.succeed.length || selected.fail.length}
			<div>
				<div class="sub-label">Outcomes</div>
				{#each selected.succeed as m (m.name)}<div class="ev gain">+{m.xp} · {m.name}</div>{/each}
				{#each selected.fail as m (m.name)}<div class="ev loss">−{m.xp} · {m.name}</div>{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.timeline {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 6px 28px;
	}
	.tl-row {
		display: flex;
		align-items: baseline;
		gap: 12px;
	}
	.tl-time {
		font-family: var(--mono);
		font-size: 12px;
		font-weight: 650;
		color: var(--accent);
		min-width: 44px;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.link {
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		font-size: 13px;
		color: var(--ink);
		cursor: pointer;
		text-align: left;
	}
	.link:hover {
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.dim {
		color: var(--ink-3);
	}

	.graph-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 16px;
		margin-bottom: 14px;
	}
	.search-wrap {
		position: relative;
		width: min(440px, 100%);
	}
	.search-wrap input {
		width: 100%;
	}
	.results {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		z-index: 10;
		padding: 4px;
		display: flex;
		flex-direction: column;
		max-height: 320px;
		overflow-y: auto;
	}
	.result {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		background: none;
		border: none;
		font: inherit;
		font-size: 13px;
		color: var(--ink);
		text-align: left;
		padding: 7px 10px;
		border-radius: var(--r-sm);
		cursor: pointer;
	}
	.result:hover {
		background: var(--surface-2);
	}
	.legend {
		display: flex;
		gap: 14px;
		font-family: var(--mono);
		font-size: 11px;
		color: var(--ink-2);
		margin-left: auto;
	}
	.legend span {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.legend i {
		width: 14px;
		height: 3px;
		border-radius: 2px;
		display: inline-block;
	}
	.legend i.dash {
		background-image: linear-gradient(90deg, transparent 0 3px, currentColor 3px 6px);
	}
	.viol {
		color: var(--hostile);
		font-weight: 650;
	}

	.board {
		padding: 22px;
		overflow-x: auto;
		--grid-diagram-bg: var(--surface);
	}
	/* horizontal timeline: layers are columns, earliest on the left.
	   Corridor supply (corridorGaps): in this orientation the vertical gap
	   between stacked chips carries the horizontal lanes, so it needs the
	   row-gap supply; the column gap needs it too for the vertical trunks. */
	.levels {
		display: flex;
		align-items: center;
		gap: calc(var(--gr-row-gap, 54px) * 1.8);
		min-width: max-content;
		padding-block: 20px;
	}
	.level {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: calc(var(--gr-row-gap, 54px) + 6px);
	}
	.chip {
		display: flex;
		flex-direction: column;
		gap: 2px;
		max-width: 210px;
		text-align: left;
		font: inherit;
		color: var(--ink);
		background: var(--surface-2);
		border: 1px solid var(--border-strong);
		border-radius: var(--r-sm);
		padding: 8px 11px;
		cursor: pointer;
		transition: border-color 120ms ease;
	}
	.chip:hover {
		border-color: var(--accent);
	}
	.chip.sel {
		border-color: var(--accent);
		box-shadow: 0 0 0 2px var(--accent-soft);
		cursor: default;
	}
	.chip.lit {
		border-color: var(--accent);
	}
	.chip.faded {
		opacity: 0.35;
	}
	.board :global(path.gr-conn.active) {
		stroke-width: 2.4;
	}
	.board :global(path.gr-conn.dim) {
		opacity: 0.18;
	}
	.chip.has-mission {
		border-left: 3px solid var(--accent);
	}
	.chip b {
		font-size: 12.5px;
		font-weight: 600;
		line-height: 1.3;
	}
	.ev {
		font-family: var(--mono);
		font-size: 10px;
		color: var(--ink-2);
		line-height: 1.45;
	}
	.ev.gain {
		color: var(--accent);
	}
	.ev.loss {
		color: var(--hostile);
	}
	.detail {
		margin-top: 16px;
	}
	.detail-head {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 8px;
	}
	.detail-head b {
		font-size: 14.5px;
		font-weight: 650;
	}
	.detail-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 14px;
	}
	.sub-label {
		font-family: var(--mono);
		font-size: 9.5px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-3);
		margin-bottom: 3px;
	}
</style>
