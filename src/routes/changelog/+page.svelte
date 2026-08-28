<script lang="ts">
	import { Page } from 'sveltekit-commons';
	import Seo from '$lib/components/Seo.svelte';
	import ReleaseList from '$lib/components/ReleaseList.svelte';
	import MonthStrip from '$lib/components/MonthStrip.svelte';
	import { monthLabel } from '$lib/changelog';

	let { data } = $props();
</script>

<Page>
	<Seo
		title="Changelog"
		description="What changed on the UAR Unit Database, release by release: new pages, freshly extracted map data, and fixes."
	/>

	<p class="note">What changed on this site, release by release.</p>

	{#each data.shown as m (m.month)}
		{#if m.month}<h2 class="month">{monthLabel(m.month)}</h2>{/if}
		<ReleaseList releases={m.releases} />
	{/each}

	<MonthStrip months={data.earlier} />
</Page>

<style>
	.month {
		margin: 0 0 14px;
		font-size: 13px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-faint);
	}
	.month:not(:first-of-type) {
		margin-top: 8px;
	}
</style>
