<script lang="ts">
	/** An entity's comments tab: the shared thread, with the entity as its subject. */
	import { Page } from 'sveltekit-commons';
	import Seo from '$lib/components/Seo.svelte';
	import CommentThread from '$lib/components/CommentThread.svelte';
	import { entityCardUrl } from '$lib/seo';
	import { displayName } from '$lib/ogcard';

	let { data, form } = $props();

	const unit = $derived(data.unit);
	const name = $derived(displayName(unit.name) || unit.id);
</script>

<Page>
	<Seo
		title="{name} comments — Entities"
		description="What players say about the {name} in Undead Assault Reborn: questions, tips and corrections."
		image={entityCardUrl(unit.id)}
	/>
	<CommentThread
		mos={null}
		threads={data.threads}
		canPost={data.canPost}
		admin={data.admin}
		open={true}
		replyTo={data.replyTo}
		{form}
		placeholder="A question about the {name}, a tip, what works against it. Markdown works; @ names a skill or an item."
	/>
</Page>
