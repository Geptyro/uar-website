<script lang="ts">
	/**
	 * What a class can do: the standard abilities across the whole column, as
	 * the same cards the skill trees use — the text, and under it the numbers
	 * from the map data. The class panel's extra keys and the handling cards
	 * sit in the rail beside this, with the class's other facts: with the
	 * abilities laid out in full, the main column is the long one now. The
	 * class overview and the vehicle tab both draw this, so it lives once.
	 */
	import type { Mos } from '$lib/mos';
	import type { ClassStats } from '$lib/skillstats';
	import AbilityCards from '$lib/components/mos/AbilityCards.svelte';

	let {
		mos,
		stats = {},
		treeNames = {},
		lead = false,
		abilitiesLabel = 'Standard abilities',
		abilitiesNote = 'Commands this class has by default, with their numbers from the map data.'
	}: {
		mos: Mos;
		/** The level rows of this class's commands, by ability id (the page's own load). */
		stats?: ClassStats;
		/** Skill tree names by id, for the columns a tree's upgrades add to a command. */
		treeNames?: Record<string, string>;
		/** First thing in its column: the first heading leads in at 4px, not a section gap. */
		lead?: boolean;
		abilitiesLabel?: string;
		abilitiesNote?: string;
	} = $props();
</script>

{#if mos.common.length}
	<h2 class="section" class:lead>{abilitiesLabel} · {mos.common.length}</h2>
	<p class="note">{abilitiesNote}</p>
	<AbilityCards items={mos.common} {stats} anchor="cmd" {treeNames} />
{/if}

<style>
	/* each heading carries the between-sections gap; the one leading the
	   column gives it back — the same 4px the class frame's own first heading
	   leads with */
	h2.section {
		margin-top: var(--section-gap);
	}
	h2.section.lead {
		margin-top: 4px;
	}
</style>
