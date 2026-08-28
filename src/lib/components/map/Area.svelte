<svelte:options namespace="svg" />

<script lang="ts">
	/**
	 * A ring around a place — a circular region, a zone, an approximate
	 * "around here". Geography: it grows with the ground. Game coordinates.
	 */
	import { getContext } from 'svelte';
	import { FONT, MAP_CTX, textWidth, within, type HoverInfo, type MapCtx, type MapTone } from './context';

	let {
		x,
		y,
		r,
		tone,
		label = null,
		labelFrom = 1,
		hot = false,
		on = false,
		faint = false,
		onpick = null,
		onenter = null,
		onleave = null,
		info = null
	}: {
		x: number;
		y: number;
		r: number;
		tone: MapTone;
		label?: string | null;
		/** Show the label only from this zoom on (1 = always). */
		labelFrom?: number;
		/** Highlighted from elsewhere (a list hovered). */
		hot?: boolean;
		/** Selected. */
		on?: boolean;
		/** Stepped back, so the others read. */
		faint?: boolean;
		onpick?: (() => void) | null;
		onenter?: (() => void) | null;
		onleave?: (() => void) | null;
		/** What the tooltip says when the pointer is on it. */
		info?: HoverInfo | null;
	} = $props();

	const m = getContext<MapCtx>(MAP_CTX);
	const cy = $derived(m.flip(y));
	/* over the ring, unless that is off the top of the map — then in it; and
	   slid sideways to stay on the map */
	const half = $derived(label ? textWidth(label, m.k) / 2 : 0);
	const lx = $derived(within(x, half, m.size - half));
	const ly = $derived(cy - r - 3 * m.k < FONT * m.k ? cy + 2.5 * m.k : cy - r - 3 * m.k);
	/* written by the map's label layer, where it is; the others keep clear */
	const id = $props.id();
	$effect(() => {
		const show = !!label && 1 / m.k >= labelFrom;
		m.label(id, show ? { id, x, y: cy, text: label!, tone, r, priority: 3, fixed: { x: lx, y: ly, anchor: 'middle' } } : null);
		return () => m.label(id, null);
	});
</script>

<!-- keyboard users reach a region through the page's list; the shape itself only answers the pointer -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<circle
	class="m-area t-{tone}"
	class:pick={!!onpick}
	class:hot
	class:on
	class:faint
	cx={x}
	{cy}
	{r}
	role={onpick ? 'button' : undefined}
	onclick={onpick ?? undefined}
	onpointerenter={(e) => {
		onenter?.();
		if (info) m.hover(info, e);
	}}
	onpointermove={(e) => info && m.hover(info, e)}
	onpointerleave={() => {
		onleave?.();
		if (info) m.hover(null);
	}}
/>

