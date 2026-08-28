<svelte:options namespace="svg" />

<script lang="ts">
	/** Many small things of one kind — item spawns, cases on the ground. Game coordinates. */
	import { getContext } from 'svelte';
	import { MAP_CTX, type MapCtx, type MapTone } from './context';

	let { points, tone }: { points: [number, number][]; tone: MapTone } = $props();

	const m = getContext<MapCtx>(MAP_CTX);
</script>

{#each points as [x, y] (`${x},${y}`)}
	<circle class="m-dot t-{tone}" cx={x} cy={m.flip(y)} r={1.4 * m.k} />
{/each}
