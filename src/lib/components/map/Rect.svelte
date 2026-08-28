<svelte:options namespace="svg" />

<script lang="ts">
	/** A rectangular region, as most of the map's named regions are. Game coordinates. */
	import { getContext } from 'svelte';
	import { FONT, MAP_CTX, textWidth, within, type HoverInfo, type MapCtx, type MapTone } from './context';

	let {
		x1,
		y1,
		x2,
		y2,
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
		x1: number;
		y1: number;
		x2: number;
		y2: number;
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
	const top = $derived(m.flip(y2));
	/* over the top edge, unless that is off the map — then just inside it;
	   slid sideways to stay on the map */
	const half = $derived(label ? textWidth(label, m.k) / 2 : 0);
	const lx = $derived(within((x1 + x2) / 2, half, m.size - half));
	const ly = $derived(top - 3 * m.k < FONT * m.k ? top + 8 * m.k : top - 3 * m.k);
	/* written by the map's label layer, where it is; the others keep clear */
	const id = $props.id();
	$effect(() => {
		const show = !!label && 1 / m.k >= labelFrom;
		m.label(
			id,
			show ? { id, x: (x1 + x2) / 2, y: top, text: label!, tone, r: 0, priority: 3, fixed: { x: lx, y: ly, anchor: 'middle' } } : null
		);
		return () => m.label(id, null);
	});
</script>

<!-- keyboard users reach a region through the page's list; the shape itself only answers the pointer -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<rect
	class="m-area t-{tone}"
	class:pick={!!onpick}
	class:hot
	class:on
	class:faint
	x={x1}
	y={top}
	width={x2 - x1}
	height={y2 - y1}
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

