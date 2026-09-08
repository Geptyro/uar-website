<script lang="ts">
	/**
	 * The roster's handling table. Its sibling at /mos/unlocks is the other
	 * half of the same comparison; see $lib/mosViews.ts.
	 */
	import { Page } from 'sveltekit-commons';

	import Seo from '$lib/components/Seo.svelte';
	import HandlingTable from '$lib/components/mos/HandlingTable.svelte';
	import RosterTabs from '$lib/components/mos/RosterTabs.svelte';
</script>

<RosterTabs />

<Page>
	<Seo
		title="Classes compared — MOS"
		description="Weapon handling across every player class in Undead Assault Reborn: magazine size, reload, worst-case jam risk per shot and panel count, from the map script."
	/>

	<!--
		No heading of its own: the crumb names the roster and the tab bar names
		the table, so an <h2> here would be the third time in forty pixels. The
		career section's ranks tab does the same.
	-->
	<HandlingTable />
</Page>
