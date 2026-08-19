<script lang="ts">
	/**
	 * The vehicle a class brings — the Predator, under the Assault Engineer.
	 * It used to have a class page of its own, listed beside the classes as if
	 * a lobby could field one; it is a tab of its pilot's page now, and this
	 * is that page in full: its weapons, its panel, everything it can carry,
	 * and its own rail with its facts, abilities, handling and the ladder of
	 * chassis upgrades its pilot earns for it.
	 */
	import { Page } from 'sveltekit-commons';
	import BehaviourDuo from '$lib/components/mos/BehaviourDuo.svelte';
	import ClassFrame from '$lib/components/mos/ClassFrame.svelte';
	import MosInfobox from '$lib/components/mos/MosInfobox.svelte';
	import WeaponTable from '$lib/components/mos/WeaponTable.svelte';
	import GearTables from '$lib/components/mos/GearTables.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { mosCardUrl, mosDescription } from '$lib/seo';

	let { data } = $props();

	const pilot = $derived(data.mos);
	const v = $derived(data.vehicle);
	const usable = $derived(data.vehicleItems.filter((i) => i.type !== 'supply'));
	const weaponItems = $derived(usable.filter((i) => i.type === 'weapon'));
</script>

<Page>
	<Seo
		title="{v.name} — {pilot.name}"
		description={mosDescription(v, pilot.name)}
		image={mosCardUrl(v.id)}
	/>

	<ClassFrame>
		<BehaviourDuo
			mos={v}
			lead
			abilitiesLabel="Abilities"
			abilitiesNote="What the {v.name} can do once you are in it. Hover — or focus — an icon for what it does."
			panelLabel="Panel"
			panelNote="Extra actions on the {v.name}'s mini-panel, with the hotkey for each one."
		/>

		{#if v.weapons.length || weaponItems.length}
			<h2 class="section">Armament</h2>
			<p class="note">
				Standard-issue weapons plus every weapon item the {v.name} can pick up and use. Buff-type
				weapons (no separate stats) modify the equipped weapon instead.
			</p>
			<WeaponTable mosId={v.id} weapons={v.weapons} items={weaponItems} />
		{/if}

		<GearTables mosId={v.id} items={usable} />

		{#snippet rail()}
			<MosInfobox mos={v} si={[]} usableCount={usable.length} abilities={false} handling={false} />
		{/snippet}
	</ClassFrame>
</Page>
