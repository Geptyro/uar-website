<script lang="ts">
	/** Writing a new build: the editor, behind a sign-in. */
	import { Page } from 'sveltekit-commons';
	import Seo from '$lib/components/Seo.svelte';
	import BuildEditor from '$lib/components/builds/BuildEditor.svelte';
	import type { BuildFormValues } from '$lib/builds';

	let { data, form } = $props();

	const mos = $derived(data.mos);
	// a refused save carries the fields back; a refused sign-in carries only its word
	const values = $derived(
		(form as { values?: BuildFormValues } | null)?.values ?? {
			title: '',
			modes: [],
			skills: [],
			ranks: [],
			sis: [],
			blocks: []
		}
	);
</script>

<Page>
	<Seo title="New {mos.name} build" description="Write a {mos.name} build." noindex />

	<h2 class="page-title">New guide</h2>

	{#if !data.viewer}
		<p class="note">Guides are written under a Battle.net sign-in, so a guide has an author.</p>
		<p><a class="chip" href="/account">Sign in with Battle.net</a></p>
	{:else}
		<BuildEditor
			{mos}
			initial={values}
			status="new"
			mayPublish={data.mayPublish}
			error={form?.error ?? null}
		/>
	{/if}
</Page>

<style>
	.chip {
		text-decoration: none;
	}
</style>
