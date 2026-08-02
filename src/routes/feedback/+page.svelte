<script lang="ts">
	import { FeedbackForm } from 'sveltekit-commons/app';
	import Seo from '$lib/components/Seo.svelte';
	import { Page } from 'sveltekit-commons';

	let { form } = $props();
</script>

<Page>
	<Seo
		title="Feedback"
		description="Spotted a wrong stat, a missing unit, or have an idea for the UAR Unit Database? Send it straight to the maintainer."
	/>

	<p class="note">
		Spotted a wrong stat, a missing unit, or have an idea for the site? Leave a note below — it goes
		straight to the maintainer. For in-game balance or map bugs, reach out to Znimu#743 instead.
	</p>

	<h2 class="section">Leave feedback</h2>

	<FeedbackForm {form} namePlaceholder="In-game name, clan…" />
</Page>
