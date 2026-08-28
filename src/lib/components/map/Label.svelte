<svelte:options namespace="svg" />

<script lang="ts">
	/** Free text placed on the map — a name for a cluster of dots. Game coordinates. */
	import { getContext } from 'svelte';
	import { FONT, MAP_CTX, type MapCtx, type MapTone } from './context';

	let {
		x,
		y,
		text,
		tone,
		anchor = 'start'
	}: { x: number; y: number; text: string; tone: MapTone; anchor?: 'start' | 'middle' | 'end' } =
		$props();

	const m = getContext<MapCtx>(MAP_CTX);
</script>

<text class="m-text t-{tone}" style:font-size="{FONT * m.k}px" {x} y={m.flip(y)} text-anchor={anchor}
	>{text}</text
>
