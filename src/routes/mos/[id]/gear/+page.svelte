<script lang="ts">
	/**
	 * What a class carries: its issued weapons and every weapon it can pick
	 * up in one table, then its armor, equipment and consumables — the four
	 * tables that made the old single page a page you scrolled rather than
	 * read. Full width, because a seven-column table with an item picture in
	 * every row wants it. The issued weapons lead the table, beside the
	 * alternatives — the comparison a reader choosing a pickup actually makes.
	 */
	import { Page } from 'sveltekit-commons';
	import WeaponTable from '$lib/components/mos/WeaponTable.svelte';
	import GearTables from '$lib/components/mos/GearTables.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { mosCardUrl } from '$lib/seo';

	let { data } = $props();

	const mos = $derived(data.mos);
	// mission items (supply) are objective props, not class gear — keep them off class pages
	const usable = $derived(data.items.filter((i) => i.type !== 'supply'));
	const weaponItems = $derived(usable.filter((i) => i.type === 'weapon'));
</script>

<Page>
	<Seo
		title="{mos.name} gear — MOS"
		description="Every weapon, armor piece, equipment and consumable the {mos.name} can pick up and use in Undead Assault Reborn, with the effect each has on this class — from the map's item data."
		image={mosCardUrl(mos.id)}
	/>

	<div class="tab">
	{#if mos.weapons.length || weaponItems.length}
		<h2 class="section">Armament</h2>
		<p class="note">
			Standard-issue weapons plus every weapon item this class can pick up and use. Buff-type
			weapons (no separate stats) modify the equipped weapon instead.
		</p>
		<WeaponTable mosId={mos.id} weapons={mos.weapons} items={weaponItems} />
	{/if}

	<GearTables mosId={mos.id} items={usable} />

	{#if !usable.length}
		<p class="note">Nothing in the item data is usable by this class.</p>
	{/if}
	</div>
</Page>

<style>
	/* The first heading on the tab is not between two sections, so it gives
	   the between-sections gap back — the same 4px the overview's frame leads
	   with, so the tabs open level with each other. */
	.tab > :global(h2.section:first-child) {
		margin-top: 4px;
	}
</style>
