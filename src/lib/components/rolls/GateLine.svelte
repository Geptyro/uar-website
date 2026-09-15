<script lang="ts">
	/**
	 * One condition a roll needs. As a line: a tick for what must hold, a cross
	 * for what must not, then the words, with a chip for every unit or effect it
	 * names. The words leave the subject out, because GateList heads the lines
	 * with it ("The hit", "The hero", "The attacker"). A long list of names reads
	 * as plain names rather than chips: eight identical marine icons are noise.
	 */
	import Tooltip from '$lib/components/Tooltip.svelte';
	import RollGlyph from './RollGlyph.svelte';
	import RefChip from './RefChip.svelte';
	import { effectById } from '$lib/effectsIndex';
	import { list, uniqueByName, type Gate, type Ref } from '$lib/rolls';

	let { gate }: { gate: Gate } = $props();

	/** More names than this read as plain names. */
	const LONG = 3;

	const inCatalog = (r: Ref) => effectById.has(r.id);
	/** Must hold (a tick) or must not (a cross). */
	const holds = $derived('is' in gate ? gate.is : true);
	const lacking = $derived(gate.kind === 'targetAttr' ? gate.classes.lacking.map((c) => c.name) : []);
</script>

{#snippet names(refs: Ref[], to: 'unit' | 'effect')}
	{#if refs.length > LONG}
		<span class="plain">
			{#each refs as r, i (r.id)}<RefChip ref={r} {to} plain after={i < refs.length - 2 ? ',' : i === refs.length - 2 ? ' or' : ''} />{/each}
		</span>
	{:else}
		{#each refs as r, i (r.id)}
			{#if i}<span class="or">{i === refs.length - 1 ? 'or' : ','}</span>{/if}<RefChip ref={r} {to} />
		{/each}
	{/if}
{/snippet}

<span class="line">
	<span class="mark"><RollGlyph name={holds ? 'check' : 'cross'} size={14} /></span>
	<span class="txt">
		{#if gate.kind === 'minDamage'}
			<b>{gate.value}+</b> damage
		{:else if gate.kind === 'effect'}
			{gate.is ? 'From' : 'Not a'}
			{@render names(uniqueByName(gate.effects.map((e) => e.behavior ?? e), inCatalog), 'effect')}
			{gate.is ? '' : 'tick'}
		{:else if gate.kind === 'playerUnit'}
			A player's hero
		{:else if gate.kind === 'targetAttr'}
			{gate.is ? gate.attr : `Not ${gate.attr.toLowerCase()}`}
			{#if lacking.length && lacking.length <= 2}
				<span class="note">(not the {list(lacking, 'or')})</span>
			{:else if lacking.length}
				<Tooltip label="Not {gate.attr.toLowerCase()}" text={lacking.join('\n')}>
					<span class="note more">({lacking.length} classes aren't)</span>
				</Tooltip>
			{/if}
		{:else if gate.kind === 'targetHas'}
			{gate.is ? 'Under' : 'No'}
			{@render names(uniqueByName(gate.behaviors, inCatalog), 'effect')}
			{gate.is ? '' : 'active'}
		{:else if gate.kind === 'sourceType'}
			{gate.is ? 'A' : 'Not a'}
			{@render names(uniqueByName(gate.units), 'unit')}
		{:else if gate.kind === 'sourceSide'}
			{gate.is ? 'One of' : 'Not one of'}
			{gate.side ? `the ${gate.side}` : `player ${gate.player}'s units`}
		{:else}
			<code>{gate.text}</code>
		{/if}
	</span>
</span>

<style>
	/* a line: the mark in its own column, so wrapped words stay under the words */
	.line {
		display: grid;
		grid-template-columns: 14px minmax(0, 1fr);
		gap: 8px;
		align-items: start;
		font-family: var(--font-sans);
		font-size: 13px;
		line-height: 1.6;
		color: var(--text);
	}
	.mark {
		display: grid;
		place-items: center;
		height: 21px;
	}
	.txt {
		min-width: 0;
	}
	.txt :global(.tt) {
		vertical-align: middle;
		margin: 1px 0;
	}
	.or {
		margin: 0 5px 0 3px;
		color: var(--text-dim);
	}
	.plain {
		color: var(--text-dim);
	}
	.note {
		font-size: 12px;
		color: var(--text-faint);
		margin-left: 3px;
	}
	.note.more {
		cursor: help;
		text-decoration: underline dotted;
		text-underline-offset: 3px;
	}
	code {
		font-size: 11.5px;
		color: var(--text-dim);
	}
</style>
