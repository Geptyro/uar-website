<svelte:options namespace="svg" />

<script lang="ts">
	/** One thing at one point, big enough to read at a glance. Game coordinates. */
	import { getContext } from 'svelte';
	import { MAP_CTX, type HoverInfo, type MapCtx, type MapTone } from './context';

	let {
		x,
		y,
		tone,
		label = null,
		side = null,
		info = null,
		spread = 0,
		spreadOf = 1
	}: {
		x: number;
		y: number;
		tone: MapTone;
		label?: string | null;
		/** Which side of the pin the label sits; left alone, whichever side keeps it on the map. */
		side?: 'left' | 'right' | null;
		/** What the tooltip says when the pointer is on it. */
		info?: HoverInfo | null;
		/** This pin's place among `spreadOf` pins on the same spot, fanned out sideways. */
		spread?: number;
		spreadOf?: number;
	} = $props();

	const m = getContext<MapCtx>(MAP_CTX);
	/* pins on one spot step sideways so each stays visible */
	const px = $derived(x + (spread - (spreadOf - 1) / 2) * 9 * m.k);
	/* the name is written by the map's label layer, laid out with the others;
	   `side` is a wish it honours when it can */
	const id = $props.id();
	$effect(() => {
		m.label(id, label ? { id, x: px, y: m.flip(y), text: label, tone, r: 5.6 * m.k, priority: 1 } : null);
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
	<circle class="m-halo t-{tone}" cx={px} cy={m.flip(y)} r={5.6 * m.k} />
	<circle class="m-pin t-{tone}" cx={px} cy={m.flip(y)} r={3.2 * m.k} />
</g>

