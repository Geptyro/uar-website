<script lang="ts">
	import { Page } from 'sveltekit-commons';
	import Seo from '$lib/components/Seo.svelte';
	import ReleaseList from '$lib/components/ReleaseList.svelte';
	import MonthStrip from '$lib/components/MonthStrip.svelte';
	import { monthLabel } from '$lib/changelog';

	let { data } = $props();
	const label = $derived(monthLabel(data.month.month));
	const n = $derived(data.month.releases.length);
</script>

<Page>
	<Seo
		title="Changelog, {label}"
		description="What changed on the UAR Unit Database in {label}: {n} {n === 1
			? 'release'
			: 'releases'}, with the new pages, freshly extracted map data and fixes in each."
	/>

	<p class="note">
		{n}
		{n === 1 ? 'release' : 'releases'} in {label}.
	</p>

	<ReleaseList releases={data.month.releases} />

	<MonthStrip months={data.others} label="Other months" latest />
</Page>
