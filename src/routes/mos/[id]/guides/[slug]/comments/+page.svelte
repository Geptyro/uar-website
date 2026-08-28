<script lang="ts">
	/** What players say under a guide: the shared thread, with the guide as its subject. */
	import Seo from '$lib/components/Seo.svelte';
	import CommentThread from '$lib/components/CommentThread.svelte';

	let { data, form } = $props();

	const mos = $derived(data.mos);
	const build = $derived(data.build);
</script>

<Seo
	title="Comments · {build.title} — {mos.name} guide"
	description="What players say about {build.title}, a {mos.name} guide."
	noindex={build.status !== 'published'}
/>

<CommentThread
	{mos}
	threads={data.threads}
	canPost={data.canPost}
	admin={data.viewer.admin}
	open={build.status === 'published'}
	replyTo={data.replyTo}
	{form}
/>
