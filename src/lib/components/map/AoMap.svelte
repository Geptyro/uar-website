<script lang="ts">
	/**
	 * AO Thalim, with things drawn on it.
	 *
	 * The minimap as an SVG in map units, so the numbers the trigger script
	 * uses place the markers; the markers are children (Pin, Area, Rect, Dots,
	 * Label from this folder), written in game coordinates. This owns the
	 * viewport: drag to pan, wheel / double-click / buttons / keys to zoom,
	 * and it hands every marker the scale `k` through context, so a pin keeps
	 * its size on screen while the ground under it grows and a knot of
	 * points comes apart when you look closer. Areas are geography and grow
	 * with the ground; only their strokes stay thin.
	 *
	 * Markers carry no styles of their own: the tones and shapes are set here,
	 * once, under `.aomap`, the way GuideShell styles the guides' markup.
	 */
	import { setContext, type Snippet } from 'svelte';
	import { mapSize } from '$lib/map';
	import { MAP_CTX, type HoverInfo, type MapCtx, type MapLegendEntry } from './context';
	import { layoutLabels, type LabelRequest } from './labelLayout';

	let {
		title = null,
		alt,
		zoom: zoomable = true,
		maxZoom = 8,
		wheel = 'armed',
		fill = false,
		legend = [],
		caption = null,
		children
	}: {
		/** Eyebrow over the map. */
		title?: string | null;
		/** What the picture says, for a reader who cannot see it. */
		alt: string;
		/** Pan and zoom; off, the map is a still picture. */
		zoom?: boolean;
		maxZoom?: number;
		/**
		 * `armed`: the wheel zooms once the map has been clicked (or with
		 * ctrl/cmd), so scrolling the page past it does not catch; `always`:
		 * the wheel zooms as soon as the pointer is over the map.
		 */
		wheel?: 'armed' | 'always';
		/** Sized by the height it is given rather than its width: a square map in a column of a fixed height. */
		fill?: boolean;
		legend?: MapLegendEntry[];
		/** A line under the map — where the numbers come from, usually. */
		caption?: string | null;
		/** The markers, in game coordinates. */
		children?: Snippet;
	} = $props();

	/** game coords have their origin bottom-left, the SVG's is top-left */
	const flip = (y: number) => mapSize - y;

	/* ---------- the viewport, in SVG units ----------
	   a small margin around the ground, so a marker on the map's edge keeps
	   its halo and its label; and some slack past that, so the map can be
	   dragged at any zoom and an edge can be brought to the middle */
	const PAD = 6;
	const SLACK = 0.3;
	let z = $state(1);
	let cx = $state(mapSize / 2);
	let cy = $state(mapSize / 2);
	const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
	const view = $derived.by(() => {
		const w = (mapSize + 2 * PAD) / z;
		const slack = w * SLACK;
		return {
			x: clamp(cx - w / 2, -PAD - slack, mapSize + PAD - w + slack),
			y: clamp(cy - w / 2, -PAD - slack, mapSize + PAD - w + slack),
			w
		};
	});
	const k = $derived(1 / z);
	const moved = $derived(z > 1 || cx !== mapSize / 2 || cy !== mapSize / 2);

	/* ---------- the tooltip: what a marker says when the pointer is on it ---------- */
	let frame = $state<HTMLElement | null>(null);
	let tip = $state<{ info: HoverInfo; x: number; y: number; left: boolean; up: boolean } | null>(null);
	function hover(info: HoverInfo | null, e?: { clientX: number; clientY: number }) {
		if (!info || !e || !frame) {
			tip = null;
			return;
		}
		const r = frame.getBoundingClientRect();
		const x = e.clientX - r.left;
		const y = e.clientY - r.top;
		tip = { info, x, y, left: x > r.width * 0.6, up: y > r.height * 0.7 };
	}

	/* ---------- the names: one layer, laid out together ---------- */
	const labels = $state<Record<string, LabelRequest>>({});
	function label(id: string, req: LabelRequest | null) {
		if (req) labels[id] = req;
		else delete labels[id];
	}
	const names = $derived(layoutLabels(Object.values(labels), k, mapSize));

	setContext<MapCtx>(MAP_CTX, {
		get k() {
			return k;
		},
		flip,
		size: mapSize,
		hover,
		label
	});

	let svg = $state<SVGSVGElement | null>(null);
	let focused = $state(false);
	let dragging = $state(false);
	/* shown when the wheel turns over a map that is not armed: what to do */
	let hint = $state(false);
	let hintTimer: ReturnType<typeof setTimeout> | undefined;

	/** Zoom to `nz`, keeping the SVG point (px, py) where it is on screen. */
	function zoomTo(nz: number, px = cx, py = cy) {
		nz = clamp(nz, 1, maxZoom);
		const ratio = z / nz;
		cx = px - (px - cx) * ratio;
		cy = py - (py - cy) * ratio;
		z = nz;
	}
	function reset() {
		z = 1;
		cx = mapSize / 2;
		cy = mapSize / 2;
	}
	/** The SVG point under a pointer event. */
	function at(e: { clientX: number; clientY: number }) {
		const r = svg!.getBoundingClientRect();
		return {
			x: view.x + ((e.clientX - r.left) / r.width) * view.w,
			y: view.y + ((e.clientY - r.top) / r.height) * view.w
		};
	}
	/* the wheel zooms when the map has been clicked or ctrl/cmd is held, so
	   scrolling past the page does not catch on it */
	function onwheel(e: WheelEvent) {
		if (!zoomable || !svg) return;
		if (wheel === 'armed' && !(focused || e.ctrlKey || e.metaKey)) {
			hint = true;
			clearTimeout(hintTimer);
			hintTimer = setTimeout(() => (hint = false), 1400);
			return;
		}
		e.preventDefault();
		const p = at(e);
		zoomTo(z * Math.exp(-e.deltaY * 0.0015), p.x, p.y);
	}
	let drag: { x: number; y: number; cx: number; cy: number } | null = null;
	/* a press that panned is not a click on whatever it ended over */
	let dragged = false;
	function onpointerdown(e: PointerEvent) {
		if (!zoomable || !svg || e.button !== 0) return;
		focused = true;
		svg.focus({ preventScroll: true });
		dragged = false;
		drag = { x: e.clientX, y: e.clientY, cx, cy };
		hint = false;
	}
	function onpointermove(e: PointerEvent) {
		if (!drag || !svg) return;
		if (!dragged) {
			if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) <= 3) return;
			/* a drag, not a click: only now take the pointer, so that a plain
			   click still lands on the marker under it (with capture, the
			   click would fire on the svg instead) */
			dragged = true;
			dragging = true;
			tip = null;
			svg.setPointerCapture(e.pointerId);
		}
		const s = view.w / svg.getBoundingClientRect().width;
		cx = drag.cx - (e.clientX - drag.x) * s;
		cy = drag.cy - (e.clientY - drag.y) * s;
	}
	function onclickcapture(e: MouseEvent) {
		if (!dragged) return;
		e.stopPropagation();
		e.preventDefault();
	}
	function onpointerup() {
		drag = null;
		dragging = false;
	}
	function onkeydown(e: KeyboardEvent) {
		if (!zoomable) return;
		const step = view.w / 8;
		const keys: Record<string, () => void> = {
			'+': () => zoomTo(z * 1.6),
			'=': () => zoomTo(z * 1.6),
			'-': () => zoomTo(z / 1.6),
			'0': reset,
			ArrowLeft: () => (cx -= step),
			ArrowRight: () => (cx += step),
			ArrowUp: () => (cy -= step),
			ArrowDown: () => (cy += step)
		};
		const fn = keys[e.key];
		if (!fn) return;
		e.preventDefault();
		fn();
	}
</script>

<figure class="aomap" class:fill>
	{#if title}<figcaption class="eyebrow">{title}</figcaption>{/if}
	<div class="frame" class:zoomable class:dragging bind:this={frame}>
		<!-- focusable only when it pans and zooms, and then its role is application;
		     the checker cannot see the role is conditional -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<svg
			bind:this={svg}
			class="svg"
			viewBox="{view.x} {view.y} {view.w} {view.w}"
			role={zoomable ? 'application' : 'img'}
			aria-label={alt}
			tabindex={zoomable ? 0 : undefined}
			{onwheel}
			{onpointerdown}
			{onpointermove}
			{onpointerup}
			{onkeydown}
			{onclickcapture}
			onpointercancel={onpointerup}
			onfocus={() => (focused = true)}
			onblur={() => (focused = false)}
			ondblclick={(e) => {
				if (!zoomable) return;
				const p = at(e);
				zoomTo(z * 2, p.x, p.y);
			}}
		>
			<image href="/map/minimap.png" width={mapSize} height={mapSize} />
			{@render children?.()}
			<!-- the names last, over everything, each where the layout put it -->
			{#each names.placed as l (l.id)}
				{#if l.lead}
					<line class="m-lead t-{l.tone}" x1={l.lead.x1} y1={l.lead.y1} x2={l.lead.x2} y2={l.lead.y2} />
				{/if}
				<text class="m-text t-{l.tone}" style:font-size="{l.fontSize}px" x={l.tx} y={l.ty} text-anchor={l.anchor}
					>{l.text}</text
				>
			{/each}
		</svg>
		{#if names.hidden}
			<div class="hidden-names" aria-live="polite">{names.hidden} name{names.hidden === 1 ? '' : 's'} hidden, zoom in</div>
		{/if}
		{#if fill}
			<!-- filling the height, the notes float over the map's foot -->
			<div class="notes">{@render notes()}</div>
		{/if}
		{#if tip}
			<div
				class="tip"
				class:left={tip.left}
				class:up={tip.up}
				style:left="{tip.x}px"
				style:top="{tip.y}px"
				role="tooltip"
			>
				{#if tip.info.icon}<img class="tip-icon" src={tip.info.icon} alt="" />{/if}
				<div class="tip-text">
					{#if tip.info.kind}<div class="tip-kind">{tip.info.kind}</div>{/if}
					<div class="tip-title">{tip.info.title}</div>
					{#each tip.info.lines ?? [] as line, i (i)}<div class="tip-line">{line}</div>{/each}
				</div>
			</div>
		{/if}
		{#if zoomable}
			<div class="zoom">
				<button type="button" aria-label="Zoom in" onclick={() => zoomTo(z * 1.6)}>+</button>
				<button type="button" aria-label="Zoom out" onclick={() => zoomTo(z / 1.6)} disabled={z <= 1}>−</button>
				<button type="button" aria-label="Reset the view" onclick={reset} disabled={!moved}>⟲</button>
			</div>
			{#if hint}
				<div class="hint" aria-hidden="true">Click the map, then scroll to zoom. Ctrl + scroll works right away.</div>
			{/if}
		{/if}
	</div>

	{#if !fill}
		{@render notes()}
	{/if}
</figure>

{#snippet notes()}
	{#if legend.length}
		<ul class="legend">
			{#each legend as l (l.label)}
				<li>
					<span class="sw {l.shape ?? 'dot'} t-{l.tone}"></span>
					{l.label}
				</li>
			{/each}
		</ul>
	{/if}
	{#if caption || zoomable}
		<p class="caption">
			{caption ?? ''}{#if zoomable}{caption ? ' ' : ''}Drag to pan, scroll or double-click to zoom.{/if}
		</p>
	{/if}
{/snippet}

<style>
	.aomap {
		margin: 0;
		min-width: 0;
	}
	/* filling: the frame takes the height left after the legend and the
	   caption, and the square map is as tall as that, its width following */
	.aomap.fill {
		height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		min-height: 0;
	}
	/* the frame is the square: its height is what the column leaves, its
	   width follows from the ratio (a replaced svg's auto width does not read
	   the viewBox in a flex item, and came out two pixels wide) */
	/* the square is as large as fits both ways: its width is the column's, its
	   height follows the ratio and is clamped by the height it has, and the
	   ratio then takes the width back down. No set height: an explicit one
	   is not shrunk by the ratio, and the map came out letterboxed */
	.aomap.fill .frame {
		flex: none;
		width: 100%;
		height: auto;
		aspect-ratio: 1;
		max-height: 100%;
		align-self: flex-start;
	}
	.aomap.fill .svg {
		width: 100%;
		height: 100%;
	}
	.aomap.fill .notes {
		position: absolute;
		left: 8px;
		right: 44px;
		bottom: 8px;
		z-index: 4;
		padding: 6px 10px;
		border-radius: var(--radius-2);
		background: color-mix(in srgb, var(--surface) 86%, transparent);
		backdrop-filter: blur(4px);
		border: 1px solid var(--border);
		pointer-events: none;
	}
	.aomap.fill .notes .legend {
		margin: 0;
		font-size: 11px;
	}
	.aomap.fill .notes .caption {
		margin: 4px 0 0;
		font-size: 10.5px;
	}
	.aomap.fill .hidden-names {
		bottom: auto;
		top: 8px;
	}
	.eyebrow {
		margin: 0 0 8px;
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-faint);
	}
	.frame {
		position: relative;
	}
	.svg {
		display: block;
		width: 100%;
		border: 1px solid var(--border);
		border-radius: var(--radius-2);
		background: var(--surface-sunken);
		outline: none;
		/* nothing on the map is text to select or an image to drag off it */
		user-select: none;
		-webkit-user-select: none;
	}
	.svg image {
		pointer-events: none;
	}
	.zoomable .svg {
		cursor: grab;
		touch-action: none;
	}
	.dragging .svg {
		cursor: grabbing;
	}
	.tip {
		position: absolute;
		z-index: 5;
		transform: translate(14px, 12px);
		max-width: 300px;
		display: flex;
		align-items: stretch;
		border-radius: var(--radius-2);
		overflow: hidden;
		background: color-mix(in srgb, var(--surface) 94%, transparent);
		backdrop-filter: blur(6px);
		border: 1px solid var(--border-strong);
		box-shadow: var(--shadow-2);
		pointer-events: none;
	}
	.tip.left {
		transform: translate(calc(-100% - 14px), 12px);
	}
	.tip.up {
		transform: translate(14px, calc(-100% - 12px));
	}
	.tip.left.up {
		transform: translate(calc(-100% - 14px), calc(-100% - 12px));
	}
	/* the picture is the tooltip's left edge: as tall as the whole tooltip,
	   as wide as it is tall, nothing around it; the text carries the padding */
	.tip-icon {
		flex: none;
		align-self: stretch;
		height: auto;
		width: auto;
		aspect-ratio: 1;
		min-height: 44px;
		object-fit: cover;
		border-right: 1px solid var(--border-strong);
		background: #0b0d10;
	}
	.tip-text {
		min-width: 0;
		padding: 8px 11px;
	}
	.tip-kind {
		font-family: var(--font-mono);
		font-size: 9.5px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text-faint);
	}
	.tip-title {
		font-size: 13px;
		font-weight: 650;
		color: var(--text);
	}
	.tip-line {
		font-size: 11.5px;
		line-height: 1.4;
		color: var(--text-dim);
		margin-top: 2px;
	}
	.hidden-names {
		position: absolute;
		left: 8px;
		bottom: 8px;
		padding: 3px 8px;
		border-radius: var(--radius-2);
		background: color-mix(in srgb, var(--surface) 88%, transparent);
		border: 1px solid var(--border);
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--text-dim);
		pointer-events: none;
	}
	.hint {
		position: absolute;
		inset: auto 0 0 0;
		margin: 0 auto;
		width: fit-content;
		padding: 6px 12px;
		border-radius: var(--radius-2) var(--radius-2) 0 0;
		background: color-mix(in srgb, var(--surface) 92%, transparent);
		border: 1px solid var(--border-strong);
		border-bottom: 0;
		font-family: var(--font-mono);
		font-size: 10.5px;
		color: var(--text-dim);
		pointer-events: none;
	}
	.zoomable .svg:focus-visible {
		border-color: var(--accent);
	}
	.zoom {
		position: absolute;
		top: 8px;
		right: 8px;
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
	.zoom button:hover:not(:disabled) {
		border-color: var(--accent);
	}
	.zoom button:disabled {
		opacity: 0.4;
		cursor: default;
	}

	/* ---------- the markers' one vocabulary ----------
	   tones as a custom property, so every shape is coloured by one class and
	   one rule; strokes are screen-sized, so the lines stay thin as the ground
	   zooms */
	.aomap :global(.t-accent) {
		--tone: var(--accent);
	}
	.aomap :global(.t-item) {
		--tone: var(--item);
	}
	.aomap :global(.t-mos) {
		--tone: var(--mos);
	}
	.aomap :global(.t-hostile) {
		--tone: var(--hostile);
	}
	.aomap :global(.t-gold) {
		--tone: var(--gold);
	}
	.aomap :global(.t-warn) {
		--tone: var(--warn);
	}
	.aomap :global(.t-lobby) {
		--tone: var(--lobby);
	}
	.aomap :global(.m-area) {
		fill: var(--tone);
		fill-opacity: 0.12;
		stroke: var(--tone);
		stroke-width: 1.2;
		stroke-dasharray: 3 3;
		vector-effect: non-scaling-stroke;
		transition: fill-opacity 100ms ease;
	}
	/* an area a page listens to: hover and selection, and the others stepping back */
	.aomap :global(.m-area.pick) {
		cursor: pointer;
		outline: none;
	}
	.aomap :global(.m-area.pick:hover),
	.aomap :global(.m-area.hot) {
		fill-opacity: 0.4;
		stroke-dasharray: none;
	}
	.aomap :global(.m-area.on) {
		fill-opacity: 0.5;
		stroke: #fff;
		stroke-dasharray: none;
		stroke-width: 1.6;
	}
	.aomap :global(.m-area.faint) {
		fill-opacity: 0.05;
		opacity: 0.55;
	}
	.aomap :global(.m-dot) {
		fill: var(--tone);
		stroke: #0b0d10;
		stroke-width: 0.6;
		vector-effect: non-scaling-stroke;
	}
	.aomap :global(.m-halo) {
		fill: none;
		stroke: var(--tone);
		stroke-width: 1.2;
		opacity: 0.7;
		vector-effect: non-scaling-stroke;
	}
	.aomap :global(.m-pin) {
		fill: var(--tone);
		stroke: #0b0d10;
		stroke-width: 1.3;
		vector-effect: non-scaling-stroke;
	}
	.aomap :global(.m-path) {
		fill: none;
		stroke: var(--tone);
		stroke-width: 1.6;
		stroke-linejoin: round;
		stroke-linecap: round;
		opacity: 0.9;
		vector-effect: non-scaling-stroke;
		pointer-events: none;
	}
	.aomap :global(.m-path.told) {
		pointer-events: stroke;
	}
	.aomap :global(.m-lead) {
		stroke: var(--tone);
		stroke-width: 0.8;
		opacity: 0.75;
		vector-effect: non-scaling-stroke;
		pointer-events: none;
	}
	.aomap :global(.m-path.dashed) {
		stroke-dasharray: 5 4;
	}
	.aomap :global(.m-vertex) {
		fill: var(--tone);
		stroke: #0b0d10;
		stroke-width: 0.8;
		vector-effect: non-scaling-stroke;
		pointer-events: none;
	}
	.aomap :global(.m-icon-ring) {
		fill: #0b0d10;
		stroke: var(--tone);
		stroke-width: 1.4;
		vector-effect: non-scaling-stroke;
	}
	.aomap :global(.m-icon) {
		clip-path: circle(50%);
		pointer-events: none;
	}
	.aomap :global(.m-text) {
		fill: var(--tone);
		font-family: var(--font-mono);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		/* the minimap under it is dark and busy: outline the glyphs rather
		   than box them, so nothing of the terrain is hidden */
		paint-order: stroke;
		stroke: #05070a;
		stroke-width: 2.2;
		stroke-linejoin: round;
		vector-effect: non-scaling-stroke;
		pointer-events: none;
		user-select: none;
		-webkit-user-select: none;
	}

	.legend {
		list-style: none;
		margin: 9px 0 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 5px 14px;
		font-size: 11.5px;
		color: var(--text-dim);
	}
	.legend li {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.sw {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--tone);
		flex: none;
	}
	.sw.ring {
		background: color-mix(in srgb, var(--tone) 18%, transparent);
		border: 1.5px dashed var(--tone);
	}
	.sw.pin {
		box-shadow: 0 0 0 1.5px var(--surface), 0 0 0 3px var(--tone);
		width: 7px;
		height: 7px;
		margin: 0 1.5px;
	}
	.caption {
		margin: 9px 0 0;
		font-size: 11.5px;
		line-height: 1.45;
		color: var(--text-faint);
	}
</style>
