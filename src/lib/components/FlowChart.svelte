<script lang="ts">
	/**
	 * The chain chart: triggers as chips, top to bottom, wired by what they
	 * enable, run, time or shut down, routed on a grid, on a canvas that pans
	 * and zooms the way the map does.
	 *
	 * The layers are the caller's (see $lib/flowLayout, sources first); this
	 * stacks them, one chip per row, earliest on top, routes the edges down
	 * the side, lights a bus or a node on hover, and shows the selected
	 * trigger's facts in a card over the canvas. Clicking a chip selects it
	 * and tells the caller; dragging anywhere pans; the wheel zooms.
	 *
	 * Zoom is a change of layout, not a transform: the chips' type, their
	 * padding and the router's grid cell all scale together and the diagram
	 * re-routes, because the router measures screen rectangles against
	 * layout heights and a scaled ancestor would put the two at odds. Panning
	 * is a translate, which the router does not notice.
	 */
	import { browser } from '$app/environment';
	import { tick } from 'svelte';
	import { GridDiagram } from 'grid-router/svelte';
	import { eventLabel, fmtDuration, triggerRole, type FlowNode } from '$lib/flow';
	import { flowEdges, type EdgeKind, type GateEdge } from '$lib/flowLayout';

	let {
		layers,
		byId,
		gates = [],
		selectedId = $bindable(),
		onpick
	}: {
		layers: FlowNode[][];
		byId: Map<string, FlowNode>;
		/** Hand-declared edges the extractor cannot see (a variable one sets, another tests). */
		gates?: GateEdge[];
		selectedId?: string;
		onpick?: (id: string) => void;
	} = $props();

	const shown = $derived(new Set(layers.flat().map((n) => n.id)));
	const edges = $derived(flowEdges(shown, byId, gates));
	const selected = $derived(selectedId ? (byId.get(selectedId) ?? null) : null);
	const key = $derived(layers.map((l) => l.map((n) => n.id).join(',')).join('|'));

	// Auto-relief ladder: a lane violation means this neighborhood is
	// undersupplied, so escalate and let the diagram re-measure + re-route —
	// first widen the gaps (corridor supply), then drop to a finer grid
	// (endpoint supply: a chip's ring holds ~perimeter/res exclusive stubs,
	// and gaps can't grow a ring). The banner stays as the canary for layouts
	// the whole ladder can't absorb.
	const RELIEF = [1, 1.35, 1.7];
	let relief = $state(0);
	let fineRes = $state(false);
	let violations = $state(0);
	$effect(() => {
		void key;
		relief = 0;
		fineRes = false;
	});

	// Endpoint demand: every edge claims an exclusive ring cell on BOTH of its
	// nodes, so a hub needs ~degree cells of perimeter. A ~210×50 chip on the
	// res-12 grid supplies ~40 — dense hubs (Activate Timer2: 43) start on the
	// finer grid outright instead of flashing through a failed first pass.
	const maxDegree = $derived.by(() => {
		const deg = new Map<string, number>();
		for (const e of edges) {
			deg.set(e.source, (deg.get(e.source) ?? 0) + 1);
			deg.set(e.target, (deg.get(e.target) ?? 0) + 1);
		}
		return Math.max(0, ...deg.values());
	});
	/* the canvas: pan by translate, zoom by layout (state up here, the grid
	   cell below reads it) */
	let zoom = $state(1);
	let tx = $state(0);
	let ty = $state(0);
	const baseRes = $derived(fineRes || maxDegree > 30 ? 8 : 12);
	/* the grid cell scales with the chips, so a zoomed chart routes the same */
	const res = $derived(Math.max(3, Math.round(baseRes * zoom)));

	const KIND_COLOR: Record<EdgeKind, string> = {
		enable: '#7fa35c',
		execute: '#7fadd1',
		disable: '#d06a52',
		timer: '#cfa95c',
		gate: '#b08ad6'
	};
	const hasGates = $derived(edges.some((e) => e.data === 'gate'));

	// ---- hover highlight: light a whole bus, or everything touching a node ----
	let hoveredBus = $state<string | undefined>(undefined);
	let hoveredNode = $state<string | undefined>(undefined);
	const busKey = (e: { source: string; bus?: string }) => `${e.source}|${e.bus ?? ''}`;
	const activeBuses = $derived.by(() => {
		const s = new Set<string>();
		if (hoveredBus) s.add(hoveredBus);
		else if (hoveredNode) {
			for (const e of edges) {
				if (e.source === hoveredNode || e.target === hoveredNode) s.add(busKey(e));
			}
		}
		return s;
	});
	const anyHover = $derived(activeBuses.size > 0);
	const litNodes = $derived.by(() => {
		const s = new Set<string>();
		if (hoveredNode) s.add(hoveredNode);
		for (const e of edges) {
			if (activeBuses.has(busKey(e))) {
				s.add(e.source);
				s.add(e.target);
			}
		}
		return s;
	});

	function pick(id: string) {
		selectedId = id;
		onpick?.(id);
	}

	/* ---------- the canvas: pan by translate, zoom by layout ---------- */
	let board = $state<HTMLDivElement | null>(null);
	let world = $state<HTMLDivElement | null>(null);
	let fitted = $state(false);
	const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

	/** The chart centered in the box, or at its top when taller than it. */
	async function fit() {
		await tick();
		if (!board || !world) return;
		const vw = board.clientWidth;
		const vh = board.clientHeight;
		const ww = world.offsetWidth;
		const wh = world.offsetHeight;
		tx = Math.max(0, (vw - ww) / 2);
		ty = wh < vh ? (vh - wh) / 2 : 0;
		fitted = true;
	}
	$effect(() => {
		void key;
		fitted = false;
	});
	/** Zoom to `nz`, keeping the point (cx, cy) of the box where it is. */
	function zoomTo(nz: number, cx?: number, cy?: number) {
		if (!board) return;
		nz = clamp(nz, 0.35, 2.5);
		const px = cx ?? board.clientWidth / 2;
		const py = cy ?? board.clientHeight / 2;
		const ratio = nz / zoom;
		tx = px - (px - tx) * ratio;
		ty = py - (py - ty) * ratio;
		zoom = nz;
	}
	function reset() {
		zoom = 1;
		void fit();
	}
	function onwheel(e: WheelEvent) {
		if (!board) return;
		e.preventDefault();
		const r = board.getBoundingClientRect();
		zoomTo(zoom * Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
	}
	let drag: { x: number; y: number; tx: number; ty: number } | null = null;
	let dragged = false;
	let dragging = $state(false);
	function onpointerdown(e: PointerEvent) {
		if (!board || e.button !== 0) return;
		board.focus({ preventScroll: true });
		dragged = false;
		drag = { x: e.clientX, y: e.clientY, tx, ty };
	}
	function onpointermove(e: PointerEvent) {
		if (!drag || !board) return;
		if (!dragged) {
			if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) <= 3) return;
			/* a drag, not a click on a chip: only now take the pointer */
			dragged = true;
			dragging = true;
			board.setPointerCapture(e.pointerId);
		}
		tx = drag.tx + (e.clientX - drag.x);
		ty = drag.ty + (e.clientY - drag.y);
	}
	function onpointerup() {
		drag = null;
		dragging = false;
	}
	function onclickcapture(e: MouseEvent) {
		if (!dragged) return;
		e.stopPropagation();
		e.preventDefault();
	}
	function onkeydown(e: KeyboardEvent) {
		if ((e.target as HTMLElement).tagName === 'BUTTON' && e.key === ' ') return;
		const step = 80;
		const keys: Record<string, () => void> = {
			'+': () => zoomTo(zoom * 1.25),
			'=': () => zoomTo(zoom * 1.25),
			'-': () => zoomTo(zoom / 1.25),
			'0': reset,
			ArrowLeft: () => (tx += step),
			ArrowRight: () => (tx -= step),
			ArrowUp: () => (ty += step),
			ArrowDown: () => (ty -= step)
		};
		const fn = keys[e.key];
		if (!fn) return;
		e.preventDefault();
		fn();
	}

	/** The gates that open the selected trigger, for its detail card. */
	const openedBy = $derived(
		selected ? gates.filter((g) => g.to === selected.id && byId.has(g.from)) : []
	);
</script>

<!-- the canvas takes the pointer for panning; the chips inside are the buttons -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="board"
	class:dragging
	bind:this={board}
	role="application"
	aria-label="Trigger chain; drag to pan, scroll to zoom, arrows and +/- on the keyboard"
	tabindex="-1"
	{onwheel}
	{onpointerdown}
	{onpointermove}
	{onpointerup}
	onpointercancel={onpointerup}
	{onclickcapture}
	{onkeydown}
>
	{#if browser}
		<div class="world" bind:this={world} style:transform="translate({tx}px, {ty}px)" style:--zoom={zoom}>
			<GridDiagram
				{edges}
				opts={{ res, exitCost: 6 }}
				revision={`${key}:${relief}:${res}`}
				connStyle={(c) => ({
					color: KIND_COLOR[(c.data ?? 'enable') as EdgeKind] ?? KIND_COLOR.enable,
					dashed: c.data === 'disable',
					class: anyHover ? (activeBuses.has(c.bus) ? 'active' : 'dim') : ''
				})}
				onrouted={(info) => {
					violations = info.violations;
					if (info.violations > 0) {
						if (relief < RELIEF.length - 1) relief++;
						else if (!fineRes) {
							fineRes = true;
							relief = 0;
						}
					}
					if (!fitted) void fit();
				}}
				onconnenter={(c) => {
					hoveredNode = undefined;
					hoveredBus = c.bus;
				}}
				onconnleave={(c) => {
					if (hoveredBus === c.bus) hoveredBus = undefined;
				}}
			>
				{#snippet children(register)}
					<div class="levels" style:--gap-scale={RELIEF[relief]}>
						{#each layers as layer, li (li)}
							<div class="level">
								{#each layer as n (n.id)}
									<button
										class="chip"
										class:sel={n.id === selectedId}
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
											<span class="ev"><span class="role">{triggerRole(n)}</span> · {eventLabel(n.events[0])}</span>
										{:else}
											<span class="ev"><span class="role">{triggerRole(n)}</span></span>
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

	<div class="legend">
		{#if violations > 0}
			<span class="viol">{violations} routing violations — report layout</span>
		{/if}
		<span><i style="background: {KIND_COLOR.enable}"></i> enables</span>
		<span><i style="background: {KIND_COLOR.execute}"></i> runs</span>
		<span><i style="background: {KIND_COLOR.timer}"></i> via timer</span>
		{#if hasGates}
			<span><i style="background: {KIND_COLOR.gate}"></i> opens (a flag it sets)</span>
		{/if}
		<span><i class="dash" style="background: {KIND_COLOR.disable}"></i> shuts down</span>
	</div>

	<div class="zoom">
		<button type="button" aria-label="Zoom in" onclick={() => zoomTo(zoom * 1.25)}>+</button>
		<button type="button" aria-label="Zoom out" onclick={() => zoomTo(zoom / 1.25)}>−</button>
		<button type="button" aria-label="Reset the view" onclick={reset}>⟲</button>
	</div>

	{#if selected}
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
				{#if openedBy.length}
					<div>
						<div class="sub-label">Waits for</div>
						{#each openedBy as g (g.from)}
							<div class="ev">{byId.get(g.from)?.name} · sets {g.via.replace('gv_', '')}</div>
						{/each}
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
						{#each selected.succeed as m (m.id)}<div class="ev gain">+{m.xp} · {m.name}</div>{/each}
						{#each selected.fail as m (m.id)}<div class="ev loss">−{m.xp} · {m.name}</div>{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	/* ---------- the canvas ---------- */
	.board {
		position: relative;
		flex: 1;
		min-height: 0;
		overflow: hidden;
		background: var(--surface);
		--grid-diagram-bg: var(--surface);
		cursor: grab;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		outline: none;
	}
	.board.dragging {
		cursor: grabbing;
	}
	.board:focus-visible {
		box-shadow: inset 0 0 0 2px var(--accent-soft);
	}
	.world {
		position: absolute;
		top: 0;
		left: 0;
		will-change: transform;
	}

	/* ---------- the overlays ---------- */
	.legend,
	.zoom,
	.detail {
		position: absolute;
		z-index: 3;
	}
	.legend {
		top: 10px;
		left: 12px;
		display: flex;
		flex-wrap: wrap;
		gap: 6px 14px;
		max-width: calc(100% - 120px);
		padding: 6px 10px;
		border-radius: var(--radius-2);
		background: color-mix(in srgb, var(--surface) 88%, transparent);
		border: 1px solid var(--border);
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--text-dim);
		pointer-events: none;
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
	.zoom {
		top: 10px;
		right: 12px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.zoom button {
		width: 26px;
		height: 26px;
		padding: 0;
		font: 600 14px/1 var(--font-mono);
		color: var(--text);
		background: color-mix(in srgb, var(--surface) 88%, transparent);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-2);
		cursor: pointer;
	}
	.zoom button:hover {
		border-color: var(--accent);
	}
	.detail {
		left: 12px;
		bottom: 12px;
		max-width: min(460px, calc(100% - 24px));
		max-height: 42%;
		overflow: auto;
		background: color-mix(in srgb, var(--surface) 92%, transparent);
		backdrop-filter: blur(6px);
		cursor: auto;
	}

	/* ---------- the chart, sized by --zoom ---------- */
	/* one column, earliest on top: a layer's chips stack in their order, the
	   next layer's under them; the sides are free for the lanes to run down.
	   The row gap is the router's, in cells, so it scales with the grid. */
	.levels {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: calc((var(--gr-row-gap, 54px) * 0.8 + 6px * var(--zoom, 1)) * var(--gap-scale, 1));
		padding: calc(24px * var(--zoom, 1)) calc(160px * var(--zoom, 1));
	}
	.level {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: calc((var(--gr-row-gap, 54px) * 0.8 + 6px * var(--zoom, 1)) * var(--gap-scale, 1));
	}
	.chip {
		display: flex;
		flex-direction: column;
		gap: calc(2px * var(--zoom, 1));
		max-width: calc(250px * var(--zoom, 1));
		text-align: left;
		font: inherit;
		color: var(--text);
		background: var(--surface-raised);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-2);
		padding: calc(8px * var(--zoom, 1)) calc(11px * var(--zoom, 1));
		cursor: pointer;
		transition: border-color 120ms ease;
	}
	.chip:hover {
		border-color: var(--accent);
	}
	.chip.sel {
		border-color: var(--accent);
		box-shadow: 0 0 0 2px var(--accent-soft);
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
		font-size: calc(12.5px * var(--zoom, 1));
		font-weight: 600;
		line-height: 1.3;
	}
	.ev {
		font-family: var(--font-mono);
		font-size: calc(10px * var(--zoom, 1));
		color: var(--text-dim);
		line-height: 1.45;
	}
	.ev .role {
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-faint);
	}
	.ev.gain {
		color: var(--accent);
	}
	.ev.loss {
		color: var(--hostile);
	}
	.detail .ev {
		font-size: 10px;
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
		grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr));
		gap: 14px;
	}
	.sub-label {
		font-family: var(--font-mono);
		font-size: 9.5px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text-faint);
		margin-bottom: 3px;
	}
</style>
