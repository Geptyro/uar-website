<script lang="ts">
	/**
	 * A hit's damage kind as a small word, with a card saying which buffs reach it:
	 * the kind decides it (Whiz Kid raises spell damage, X-rays ranged), and a hit
	 * the map deals from a dummy keeps only the buffs it copies onto the dummy.
	 * See $lib/damageKinds.
	 */
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { kindHint } from '$lib/damageKinds';
	import { skillIdentifiers } from '$lib/mos';

	let {
		kind,
		on = '',
		dummy = false,
		carries = []
	}: {
		kind: string;
		/** Which part of the hit, when not the direct one: "area" (the units around the target). */
		on?: string;
		/** Dealt by a unit the map drops on the target, not by the hero. */
		dummy?: boolean;
		/** The hero's buffs the map copies onto that unit. */
		carries?: string[];
	} = $props();

	const text = $derived(
		(on === 'area' ? 'The units around the target take this kind; the one it hits takes the other. ' : '') +
			kindHint(kind, skillIdentifiers, dummy, carries)
	);
</script>

<Tooltip label="{kind} damage{on ? ` (${on})` : ''}" {text}>
	<span class="ktag k-{kind.toLowerCase()}"
		>{#if on}<span class="dum">{on}</span>{/if}{kind.toLowerCase()}{#if dummy}<span class="dum">dummy</span>{/if}</span
	>
</Tooltip>

<style>
	.ktag {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-family: var(--font-sans);
		font-size: 10.5px;
		line-height: 1.5;
		padding: 0 5px;
		border-radius: var(--radius-1);
		border: 1px solid var(--border);
		color: var(--text-dim);
		white-space: nowrap;
		cursor: help;
	}
	/* spell and splash are the kinds most buffs miss: they stand out from the ranged bulk */
	.k-spell {
		color: var(--mos);
		border-color: color-mix(in srgb, var(--mos) 40%, transparent);
		background: var(--mos-soft);
	}
	.k-splash {
		color: var(--item);
		border-color: color-mix(in srgb, var(--item) 40%, transparent);
		background: var(--item-soft);
	}
	.dum {
		color: var(--text-faint);
		font-size: 9.5px;
	}
</style>
