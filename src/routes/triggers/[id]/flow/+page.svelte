<script lang="ts">
	/**
	 * The group's chain, on a canvas of its own: the whole column and the
	 * whole height the shell leaves under the tabs, edge to edge, panning
	 * and zooming the way the map does.
	 */
	import { Page } from 'sveltekit-commons';
	import Seo from '$lib/components/Seo.svelte';
	import FlowChart from '$lib/components/FlowChart.svelte';
	import type { FlowNode } from '$lib/flow';
	import { orderLayers, sourceLayers } from '$lib/flowLayout';
	import { GROUP_TYPES } from '$lib/groups';

	let { data } = $props();

	const group = $derived(data.group);
	const kind = $derived(GROUP_TYPES.find((t) => t.type === group.type)!);
	const flow = $derived(data.flow as FlowNode[]);
	const byId = $derived(new Map(flow.map((n) => [n.id, n])));
	const layers = $derived(orderLayers(sourceLayers(flow, data.gates), byId, data.gates));
	let selectedId = $state<string | undefined>(undefined);
	$effect(() => {
		if (!selectedId && flow.length) selectedId = flow[0].id;
	});
</script>

<!-- no gutters: the canvas is the page -->
<Page fill style="--content-pad-top: 0; --content-pad-x: 0; --content-pad-bottom: 0">
	<Seo
		title="{group.name} — flow"
		description="How the map script runs {group.name}, a {kind.label} of {flow.length} triggers: which arms which, what loops, what pays and what shuts down, read from the map file."
	/>
	<div class="canvas">
		<FlowChart {layers} {byId} gates={data.gates} bind:selectedId />
	</div>
</Page>

<style>
	.canvas {
		height: 100%;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
</style>
