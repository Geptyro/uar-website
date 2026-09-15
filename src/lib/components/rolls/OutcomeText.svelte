<script lang="ts">
	/**
	 * What one outcome does, in words and chips: kills the carrier, spawns a
	 * unit (where it died, when it also kills), puts a behaviour on, takes some
	 * off, cures every ailment.
	 */
	import RollGlyph from './RollGlyph.svelte';
	import RefChip from './RefChip.svelte';
	import StatIcon from '$lib/components/StatIcon.svelte';
	import type { EffectOutcome } from '$lib/rolls';

	let { outcome: o, who = 'the hero' }: { outcome: EffectOutcome; who?: string } = $props();
</script>

<span class="does">
	{#if o.kills}
		<span class="part"><RollGlyph name="skull" size={16} /><span>Kills {who}</span></span>
	{/if}
	{#each o.spawns ?? [] as s (s.id)}
		<span class="part">
			<RollGlyph name="spawn" size={16} />
			<span>{s.side === 'undead' || s.side === 'hostile' ? 'A hostile' : 'A'}</span>
			<RefChip ref={s} to="unit" />
			<span>spawns{o.kills ? ' where they fell' : ''}</span>
		</span>
	{/each}
	{#if o.applies?.length}
		<span class="part">
			<StatIcon name="sparkle" size={15} /><span>Puts</span>
			{#each o.applies as r (r.id)}<RefChip ref={r} to="effect" />{/each}
			<span>on it</span>
		</span>
	{/if}
	{#if o.removes?.length}
		<span class="part">
			<StatIcon name="remove" size={15} /><span>Removes</span>
			{#each o.removes as r (r.id)}<RefChip ref={r} to="effect" iconOnly />{/each}
		</span>
	{/if}
	{#if o.curesAilments}
		<span class="part"><StatIcon name="remove" size={15} /><span>Cures every ailment</span></span>
	{/if}
</span>

<style>
	.does {
		display: inline-flex;
		flex-direction: column;
		gap: 5px;
	}
	.part {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 6px;
		font-size: 13px;
	}
</style>
