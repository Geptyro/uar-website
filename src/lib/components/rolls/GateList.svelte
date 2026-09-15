<script lang="ts">
	/**
	 * A roll's conditions as lines under who they are about: the hit itself, the
	 * hero it lands on, the unit that dealt it. The lines drop the subject ("15+
	 * damage", "Biological", "Not a Spitter"), so each reads in a glance and the
	 * ticks and crosses line up in one column. `grouped` false keeps the lines in
	 * order with no heads, for a set of alternatives that mixes subjects (the
	 * venom attackers and the Swollen's burst).
	 */
	import GateLine from './GateLine.svelte';
	import type { Gate } from '$lib/rolls';

	let { gates, grouped = true }: { gates: Gate[]; grouped?: boolean } = $props();

	const SUBJECTS = [
		{ key: 'hit', label: 'The hit', kinds: ['minDamage', 'effect'] },
		{ key: 'hero', label: 'The hero', kinds: ['playerUnit', 'targetAttr', 'targetHas'] },
		{ key: 'attacker', label: 'The attacker', kinds: ['sourceType', 'sourceSide'] },
		{ key: 'other', label: 'And', kinds: ['raw'] }
	] as const;

	const groups = $derived(
		grouped
			? SUBJECTS.map((s) => ({ ...s, gates: gates.filter((g) => (s.kinds as readonly string[]).includes(g.kind)) })).filter(
					(s) => s.gates.length
				)
			: [{ key: 'all', label: '', gates }]
	);
</script>

<div class="groups">
	{#each groups as grp (grp.key)}
		<div class="group">
			{#if grp.label}<div class="head">{grp.label}</div>{/if}
			<ul>
				{#each grp.gates as g, i (i)}<li><GateLine gate={g} /></li>{/each}
			</ul>
		</div>
	{/each}
</div>

<style>
	.groups {
		display: grid;
		gap: 10px;
	}
	.head {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text-faint);
		margin: 0 0 3px;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 3px;
	}
</style>
