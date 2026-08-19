<script lang="ts" module>
	/**
	 * A colour a marker can take. Names, not values: each maps to one of the
	 * palette's semantic tokens, so a guide says "the city is item-coloured"
	 * the way the quick guide's AO does and never picks a hex of its own.
	 */
	export type MapTone = 'accent' | 'item' | 'mos' | 'hostile' | 'gold' | 'warn' | 'lobby';

	/** A ring around a place — a region, a zone, an approximate "around here". */
	export interface MapArea {
		x: number;
		y: number;
		r: number;
		tone: MapTone;
		label?: string;
	}

	/** One thing at one point, big enough to read at a glance. */
	export interface MapPin {
		x: number;
		y: number;
		tone: MapTone;
		label?: string;
		/** Which side of the pin the label sits; default right. */
		side?: 'left' | 'right';
	}

	/** Many small things of one kind — item spawns, cases on the ground. */
	export interface MapDots {
		points: [number, number][];
		tone: MapTone;
	}

	/** Free text placed on the map — a name for a cluster of dots. */
	export interface MapLabel {
		x: number;
		y: number;
		text: string;
		tone: MapTone;
		anchor?: 'start' | 'middle' | 'end';
	}

	export interface MapLegend {
		tone: MapTone;
		/** 'ring' draws the swatch as an outline, the way areas are drawn. */
		shape?: 'dot' | 'ring' | 'pin';
		label: string;
	}
</script>

<script lang="ts">
	/**
	 * The minimap with a class's objectives drawn on it.
	 *
	 * The quick guide draws two places on the AO — where you land, and the
	 * city — as an SVG over the minimap in map units, so the same numbers the
	 * trigger script uses place the markers. This is that drawing made
	 * reusable: a guide hands it areas, pins, dots and labels in game
	 * coordinates (origin bottom-left, as map.json has them) and it flips,
	 * scales and colours them. Nothing here knows what a scrap or a cave is.
	 *
	 * Sizes are in map units too, so a 3-unit pin is the same fraction of the
	 * map at every width; the text is the exception — it is set in the same
	 * 7-unit mono the AO uses, which reads at the widths the map is drawn.
	 */
	import { mapSize } from '$lib/map';

	let {
		title,
		areas = [],
		pins = [],
		dots = [],
		labels = [],
		legend = [],
		caption = null,
		alt
	}: {
		/** Eyebrow over the map. */
		title: string;
		areas?: MapArea[];
		pins?: MapPin[];
		dots?: MapDots[];
		labels?: MapLabel[];
		legend?: MapLegend[];
		/** A line under the map — where the numbers come from, usually. */
		caption?: string | null;
		/** What the picture says, for a reader who cannot see it. */
		alt: string;
	} = $props();

	/** game coords have their origin bottom-left, the SVG's is top-left */
	const flip = (y: number) => mapSize - y;
</script>

<figure class="omap">
	<figcaption class="omap-h">{title}</figcaption>
	<svg class="omap-svg" viewBox="0 0 {mapSize} {mapSize}" role="img" aria-label={alt}>
		<image href="/map/minimap.png" width={mapSize} height={mapSize} />

		{#each areas as a (a.label ?? `${a.x},${a.y}`)}
			<circle class="area t-{a.tone}" cx={a.x} cy={flip(a.y)} r={a.r} />
		{/each}

		{#each dots as d, i (i)}
			{#each d.points as [x, y] (`${x},${y}`)}
				<circle class="dot t-{d.tone}" cx={x} cy={flip(y)} r="1.6" />
			{/each}
		{/each}

		{#each pins as p (p.label ?? `${p.x},${p.y}`)}
			<circle class="halo t-{p.tone}" cx={p.x} cy={flip(p.y)} r="7" />
			<circle class="pin t-{p.tone}" cx={p.x} cy={flip(p.y)} r="4" />
		{/each}

		<!-- labels last so nothing draws over them -->
		{#each areas as a (a.label ?? `${a.x},${a.y}`)}
			{#if a.label}
				<!-- over the ring, unless that is off the top of the map — then in it -->
				<text
					class="t t-{a.tone}"
					x={a.x}
					y={flip(a.y) - a.r - 3 < 8 ? flip(a.y) + 2.5 : flip(a.y) - a.r - 3}
					text-anchor="middle">{a.label}</text
				>
			{/if}
		{/each}
		{#each pins as p (p.label ?? `${p.x},${p.y}`)}
			{#if p.label}
				<text
					class="t t-{p.tone}"
					x={p.side === 'left' ? p.x - 8 : p.x + 8}
					y={flip(p.y) + 2.6}
					text-anchor={p.side === 'left' ? 'end' : 'start'}>{p.label}</text
				>
			{/if}
		{/each}
		{#each labels as l (l.text)}
			<text class="t t-{l.tone}" x={l.x} y={flip(l.y)} text-anchor={l.anchor ?? 'start'}
				>{l.text}</text
			>
		{/each}
	</svg>

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
	{#if caption}
		<p class="omap-d">{caption}</p>
	{/if}
</figure>

<style>
	.omap {
		margin: 0;
		min-width: 0;
	}
	.omap-h {
		margin: 0 0 8px;
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-faint);
	}
	.omap-svg {
		display: block;
		width: 100%;
		border: 1px solid var(--border);
		border-radius: var(--radius-2);
		background: var(--surface-sunken);
	}

	/* the tone is a custom property so every shape below can be coloured by
	   one class and one rule */
	.t-accent {
		--tone: var(--accent);
	}
	.t-item {
		--tone: var(--item);
	}
	.t-mos {
		--tone: var(--mos);
	}
	.t-hostile {
		--tone: var(--hostile);
	}
	.t-gold {
		--tone: var(--gold);
	}
	.t-warn {
		--tone: var(--warn);
	}
	.t-lobby {
		--tone: var(--lobby);
	}

	.area {
		fill: var(--tone);
		fill-opacity: 0.12;
		stroke: var(--tone);
		stroke-width: 1.2;
		stroke-dasharray: 3 3;
	}
	.dot {
		fill: var(--tone);
		stroke: #0b0d10;
		stroke-width: 0.6;
	}
	.halo {
		fill: none;
		stroke: var(--tone);
		stroke-width: 1.4;
		opacity: 0.7;
	}
	.pin {
		fill: var(--tone);
		stroke: #0b0d10;
		stroke-width: 1.5;
	}
	.t {
		fill: var(--tone);
		font-family: var(--font-mono);
		font-size: 7px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		/* the minimap under it is dark and busy: outline the glyphs rather
		   than box them, so nothing of the terrain is hidden */
		paint-order: stroke;
		stroke: #05070a;
		stroke-width: 2.4;
		stroke-linejoin: round;
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
	.omap-d {
		margin: 9px 0 0;
		font-size: 11.5px;
		line-height: 1.45;
		color: var(--text-faint);
	}
</style>
