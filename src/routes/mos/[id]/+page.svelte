<script lang="ts">
	/**
	 * A class's overview: what it does. The skill trees, the commands it has
	 * by default, how its weapon handles, and the extra keys on its panel.
	 * What it carries — issued and picked up alike — is the Gear tab, who
	 * plays it is the Players tab; the rail beside this is the layout's.
	 *
	 * The abilities and the handling cards used to sit in the rail, which made
	 * it three screens long beside a main column that ran out after the skill
	 * trees. They are the class's own behaviour, not facts about it, and the
	 * main column is where behaviour goes.
	 */
	import AbilityCards from '$lib/components/mos/AbilityCards.svelte';
	import BehaviourDuo from '$lib/components/mos/BehaviourDuo.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { mosCardUrl, mosDescription } from '$lib/seo';

	let { data } = $props();

	const mos = $derived(data.mos);
	const treeNames = $derived(Object.fromEntries(mos.skills.map((s) => [s.id, s.name])));
</script>

<Seo title="{mos.name} — MOS" description={mosDescription(mos)} image={mosCardUrl(mos.id)} />

{#if mos.skills.length}
	<h2 class="section">Skills · {mos.skills.length} trees</h2>
	<AbilityCards items={mos.skills} stats={data.stats} anchor="skill" {treeNames} />
{/if}

<BehaviourDuo {mos} stats={data.stats} {treeNames} />
