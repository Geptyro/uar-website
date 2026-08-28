<script lang="ts">
	/**
	 * The class's comments tab: what players say about the class, as a
	 * thread. The same thread a guide has, with the class as its subject.
	 */
	import { Page } from 'sveltekit-commons';
	import Seo from '$lib/components/Seo.svelte';
	import CommentThread from '$lib/components/CommentThread.svelte';
	import { mosCardUrl } from '$lib/seo';

	let { data, form } = $props();

	const mos = $derived(data.mos);
</script>

<Page>
	<Seo
		title="{mos.name} comments — MOS"
		description="What players say about the {mos.name} in Undead Assault Reborn: questions, tips and corrections."
		image={mosCardUrl(mos.id)}
	/>
	<CommentThread
		{mos}
		threads={data.threads}
		canPost={data.canPost}
		admin={data.admin}
		open={true}
		replyTo={data.replyTo}
		{form}
		placeholder="A question about the {mos.name}, a tip, what works for you. Markdown works; @ names a skill or an item."
	/>
</Page>
