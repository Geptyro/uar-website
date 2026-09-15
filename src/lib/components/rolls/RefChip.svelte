<script lang="ts">
	/**
	 * A unit or an effect named inside a roll: its art and name, linking to its
	 * page when the site has one. An effect the catalog carries takes the
	 * catalog's name and art (the ailment panel's "Broken Arm" over the data's
	 * "Fractured Arm"), so a chip reads the same as the page it opens.
	 *
	 * Its hover card is the site's Tooltip with the text a guide's chip shows:
	 * the game's own description, or a unit's stat line when it has none (the
	 * page resolves them, see ./context). Tooltip is the link, so the chip
	 * inside is a plain span.
	 */
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { effectById } from '$lib/effectsIndex';
	import type { Ref } from '$lib/rolls';
	import { getRolls } from './context';

	let {
		ref,
		to,
		size = 18,
		/** Art only, the name in the card. */
		iconOnly = false,
		/** The name only, as words in a sentence: for a long list of names. */
		plain = false,
		/** Plain: what follows the name in the sentence ("," or " or"), kept inside the
		    anchor, since Tooltip leaves a space after it that would land before a comma. */
		after = ''
	}: { ref: Ref; to: 'unit' | 'effect'; size?: number; iconOnly?: boolean; plain?: boolean; after?: string } = $props();

	const rolls = getRolls();
	const known = $derived(to === 'effect' ? effectById.get(ref.id) : undefined);
	const name = $derived(known?.name ?? ref.name);
	const icon = $derived(known?.icon ?? ref.icon ?? null);
	const text = $derived(rolls?.tips[`${to}:${ref.id}`] ?? '');
	const href = $derived(
		to === 'effect'
			? known
				? `/effects/${encodeURIComponent(ref.id)}`
				: ''
			: ref.page
				? `/entities/${encodeURIComponent(ref.id)}`
				: ''
	);
	const initials = $derived(
		(name.match(/[A-Za-z0-9]+/g) ?? [])
			.slice(0, 2)
			.map((w) => w[0].toUpperCase())
			.join('')
	);
</script>

<Tooltip label={name} {text} {icon} {href} linkText={to === 'unit' ? 'Unit page' : 'Effect page'}>
	{#if plain}
		<span class="name" class:linked={!!href}>{name}</span>{#if after}<span class="after">{after}</span>{/if}
	{:else}
		<span class="chip" class:bare={iconOnly} class:linked={!!href}>
			{#if icon}
				<img src={icon} alt="" width={size} height={size} loading="lazy" />
			{:else}
				<span class="ph" style="width: {size}px; height: {size}px">{initials}</span>
			{/if}
			{#if !iconOnly}<span class="nm">{name}</span>{/if}
		</span>
	{/if}
</Tooltip>

<style>
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		vertical-align: middle;
		padding: 1px 7px 1px 1px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface-raised);
		color: var(--text);
		font-family: var(--font-sans);
		font-size: 12.5px;
		font-weight: 550;
		line-height: 1.3;
		white-space: nowrap;
		cursor: default;
	}
	.chip.bare {
		padding: 1px;
	}
	.chip.linked {
		cursor: pointer;
	}
	.chip.linked:hover {
		border-color: var(--accent);
		color: var(--accent);
	}
	.name {
		font-family: var(--font-sans);
		font-weight: 550;
		color: var(--text);
		text-decoration: underline dotted var(--border-strong);
		text-underline-offset: 3px;
		cursor: default;
	}
	.name.linked {
		cursor: pointer;
	}
	.name.linked:hover {
		color: var(--accent);
	}
	.after {
		color: var(--text-dim);
		white-space: pre;
	}
	img,
	.ph {
		border-radius: 999px;
		object-fit: cover;
		flex-shrink: 0;
	}
	.ph {
		display: inline-grid;
		place-items: center;
		font-family: var(--font-mono);
		font-size: 8px;
		color: var(--text-faint);
		background: var(--surface-sunken);
	}
</style>
