<script lang="ts">
	/**
	 * The two columns of a class overview: the main column, and the 290px rail
	 * beside it. The class layout draws a class this way and the vehicle tab
	 * draws the vehicle this way, so the grid and its folding rules live once.
	 *
	 * Below 1080px the rail's blocks become a grid of cards under the main
	 * column; on a phone the identity card leads, ahead of the skill trees.
	 * One column there, still a grid: a column flex box would take align-items
	 * from the rule above and size each half to its widest child rather than
	 * the page, which puts a scrollbar under the whole thing.
	 */
	import type { Snippet } from 'svelte';

	let { children, rail }: { children: Snippet; rail: Snippet } = $props();
</script>

<div class="layout">
	<div class="main">{@render children()}</div>
	<div class="rail">{@render rail()}</div>
</div>

<style>
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 290px;
		gap: 0 28px;
		align-items: start;
	}
	.main {
		min-width: 0;
	}
	.rail {
		min-width: 0;
	}

	/* The tabs render into .main, so the frame owns the rhythm above their
	   first heading rather than each tab repeating it. A direct child, so it
	   is only the page's own first heading and not every section that wraps
	   its own. */
	.main > :global(h2.section:first-child) {
		margin-top: 4px;
	}

	@media (max-width: 1080px) {
		.layout {
			display: block;
		}
		.rail {
			margin: 16px 0 4px;
		}
	}
	@media (max-width: 899.98px) {
		.layout {
			display: grid;
			grid-template-columns: minmax(0, 1fr);
		}
		.rail {
			order: -1;
			margin: 0 0 18px;
		}
	}
</style>
