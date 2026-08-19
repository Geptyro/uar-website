<script lang="ts">
	/**
	 * A class's guide — the one tab that is written rather than extracted.
	 * The text is the guide component's; this page is its frame and its head.
	 */
	import { Page } from 'sveltekit-commons';
	import Seo from '$lib/components/Seo.svelte';
	import { mosCardUrl } from '$lib/seo';

	let { data } = $props();

	const mos = $derived(data.mos);
	const Guide = $derived(data.Guide);
</script>

<Page>
	<Seo title="{mos.name} guide — MOS" description={data.summary} image={mosCardUrl(mos.id)} />
	<Guide />
	<p class="checked">
		Guide checked against the map on {data.checked}. Spotted something the map does differently?
		<a href="/feedback">Say so</a>.
	</p>
</Page>

<style>
	.checked {
		margin: 26px 0 0;
		font-size: 11px;
		line-height: 1.5;
		color: var(--text-faint);
	}
</style>
