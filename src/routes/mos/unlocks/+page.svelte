<script lang="ts">
	/**
	 * What every class costs to unlock. The roster's second table; /mos itself
	 * is the first. See $lib/mosViews.ts for why this is a route and not a
	 * query parameter.
	 */
	import { Page } from 'sveltekit-commons';

	import Seo from '$lib/components/Seo.svelte';
	import UnlockTable from '$lib/components/mos/UnlockTable.svelte';
	import RosterTabs from '$lib/components/mos/RosterTabs.svelte';
</script>

<RosterTabs active="unlocks" />

<Page>
	<Seo
		title="How to unlock every class — MOS"
		description="What each player class in Undead Assault Reborn costs to unlock: the rank or XP it wants on the Enlisted, Warrant Officer and Commissioned tracks, the medals some ask for on top, and how many players can field it per game."
	/>

	<UnlockTable />
</Page>
