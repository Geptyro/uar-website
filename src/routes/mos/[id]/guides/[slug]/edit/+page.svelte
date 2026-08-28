<script lang="ts">
	/** Editing a guide of your own: the same editor, filled in. */
	import Seo from '$lib/components/Seo.svelte';
	import BuildEditor from '$lib/components/builds/BuildEditor.svelte';
	import type { BuildFormValues } from '$lib/builds';

	let { data, form } = $props();

	const mos = $derived(data.mos);
	const build = $derived(data.build);
	const values = $derived((form as { values?: BuildFormValues } | null)?.values ?? data.values);
</script>

<Seo title="Edit: {build.title}" description="Edit a {mos.name} build." noindex />

<BuildEditor
	{mos}
	initial={values}
	status={build.status}
	mayPublish={data.mayPublish}
	error={form?.error ?? null}
/>
