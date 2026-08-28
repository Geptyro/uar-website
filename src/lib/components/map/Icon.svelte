<svelte:options namespace="svg" />

<script lang="ts">
	/**
	 * A unit at a point, shown by its own icon: a round portrait in a ring of
	 * the tone, with the name beside it. Screen-sized, like a pin. Game
	 * coordinates.
	 */
	import { getContext } from 'svelte';
	import { MAP_CTX, type HoverInfo, type MapCtx, type MapTone } from './context';

	let {
		x,
		y,
		href,
		tone,
		label = null,
		size = 9,
		info = null,
		spread = 0,
		spreadOf = 1
	}: {
		x: number;
		y: number;
		/** The icon image. */
		href: string;
		tone: MapTone;
		label?: string | null;
		/** Diameter in map units at zoom 1. */
		size?: number;
		/** What the tooltip says when the pointer is on it. */
		info?: HoverInfo | null;
		/** This icon's place among `spreadOf` markers on the same spot, fanned out sideways. */
		spread?: number;
		spreadOf?: number;
	} = $props();

	const m = getContext<MapCtx>(MAP_CTX);
	const r = $derived((size / 2) * m.k);
	const cy = $derived(m.flip(y));
	const px = $derived(x + (spread - (spreadOf - 1) / 2) * (size + 3) * m.k);
	/* the name is written by the map's label layer, laid out with the others */
	const id = $props.id();
	$effect(() => {
		m.label(id, label ? { id, x: px, y: cy, text: label, tone, r: r + 1.2 * m.k, priority: 2 } : null);
		return () => m.label(id, null);
	});
</script>

<!-- the tooltip is a hover aid; what it says is also in the page's text, so this stays pointer-only -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<g
	onpointerenter={(e) => info && m.hover(info, e)}
	onpointermove={(e) => info && m.hover(info, e)}
	onpointerleave={() => info && m.hover(null)}
>
	<circle class="m-icon-ring t-{tone}" cx={px} {cy} r={r + 1.2 * m.k} />
	<image
		class="m-icon"
		{href}
		x={px - r}
		y={cy - r}
		width={2 * r}
		height={2 * r}
		preserveAspectRatio="xMidYMid slice"
	/>
</g>

