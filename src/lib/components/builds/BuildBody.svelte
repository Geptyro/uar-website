<script lang="ts">
	/**
	 * A guide's document as the reader sees it: the block tree drawn by
	 * BuildBlocks, inside Rich, which carries what the renderer's HTML needs
	 * from the page (the styles of its elements, the hover card on its chips).
	 */
	import type { Rendered } from '$lib/buildRender';
	import BuildBlocks from './BuildBlocks.svelte';
	import Rich from './Rich.svelte';

	let { blocks }: { blocks: Rendered[] } = $props();
</script>

<Rich>
	<div class="bsections">
		<BuildBlocks {blocks} />
	</div>
</Rich>

<style>
	.bsections > :global(* + *) {
		margin-top: 14px;
	}
</style>
