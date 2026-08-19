<script lang="ts">
	/**
	 * What a class can do beside how its weapon handles, half the column each.
	 *
	 * Left: the command card, and under it the extra keys on the class panel
	 * where there are any. Right: the handling cards. Neither wants the full
	 * width — a row of 52px tiles across the whole column read as wallpaper,
	 * and the mechanic cards ran three abreast with air between them. Half
	 * each, and they stack below ~900px. The class overview and the vehicle
	 * tab both draw this, so it lives once.
	 */
	import type { Mos } from '$lib/mos';
	import { mechanicsFor } from '$lib/mechanics';
	import ClassPanel from '$lib/components/ClassPanel.svelte';
	import MechanicsGrid from '$lib/components/MechanicsGrid.svelte';
	import AbilityTiles from '$lib/components/mos/AbilityTiles.svelte';

	let {
		mos,
		lead = false,
		abilitiesLabel = 'Standard abilities',
		abilitiesNote = 'Commands this class has by default. Hover — or focus — an icon for what it does.',
		panelLabel = 'Class panel',
		panelNote = "Extra actions on this class's mini-panel, with the hotkey that triggers each one."
	}: {
		mos: Mos;
		/** First thing in its column: the halves lead in at 4px, not a section gap. */
		lead?: boolean;
		abilitiesLabel?: string;
		abilitiesNote?: string;
		panelLabel?: string;
		panelNote?: string;
	} = $props();

	const mechanics = $derived(mechanicsFor(mos.id));
</script>

{#if mos.common.length || mechanics}
	<div class="duo" class:lead>
		{#if mos.common.length || mechanics?.panel.length}
			<section class="half">
				{#if mos.common.length}
					<h2 class="section">{abilitiesLabel} · {mos.common.length}</h2>
					<p class="note">{abilitiesNote}</p>
					<AbilityTiles abilities={mos.common} size="large" />
				{/if}
				{#if mechanics?.panel.length}
					<h2 class="section">{panelLabel} · {mechanics.panel.length} buttons</h2>
					<p class="note">{panelNote}</p>
					<ClassPanel keys={mechanics.panel} />
				{/if}
			</section>
		{/if}
		{#if mechanics}
			<section class="half">
				<h2 class="section">Handling</h2>
				<p class="note">
					Ammunition, jamming and shared-class behaviour, read from the map's trigger script rather
					than the unit data.
				</p>
				<MechanicsGrid mosId={mos.id} />
			</section>
		{/if}
	</div>
{/if}

<style>
	.duo {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(360px, 100%), 1fr));
		gap: 0 28px;
		align-items: start;
	}
	.half {
		min-width: 0;
		container-type: inline-size;
	}
	/* Both halves lead with a section heading, and both carry the
	   between-sections gap above it — level with each other, and the right
	   distance from whatever is above. A second heading in a half (the panel
	   under the abilities) keeps the same gap. */
	.half :global(h2.section) {
		margin-top: var(--section-gap);
	}
	/* leading the column, both halves give the gap back — the same 4px the
	   class frame's own first heading leads with */
	.duo.lead .half > :global(h2.section:first-child) {
		margin-top: 4px;
	}
	/* the panel's cards fill a half column two abreast, not three: a third
	   card at that width wraps its own title */
	.duo .half :global(.panel-grid) {
		grid-template-columns: repeat(auto-fill, minmax(min(260px, 100%), 1fr));
	}

	/* The handling cards are four of very different heights — a jam curve
	   beside a two-line magazine card. In a grid the row takes the tallest
	   and the short card sits over a hole; so in this half they flow as
	   columns instead, each card whole, filled top to bottom: one column
	   until the half is wide enough for two. */
	.duo .half :global(.mech-grid) {
		display: block;
	}
	.duo .half :global(.mech-card) {
		break-inside: avoid;
		margin-bottom: 12px;
	}
	@container (min-width: 520px) {
		.duo .half :global(.mech-grid) {
			columns: 2;
			column-gap: 12px;
		}
	}
</style>
