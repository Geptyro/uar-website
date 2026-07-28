<script lang="ts">
	/**
	 * One modifier, as a coloured glyph with the game's own blurb on hover.
	 *
	 * These sit next to a ModeMark, so they are deliberately quieter: a chip
	 * with a tinted background rather than coloured text, because the mode is
	 * the headline and the modifiers qualify it. Colour groups them by what
	 * they do — the ones that make the fight harder run warm, the ones that
	 * restrict what you may bring run cool, and the training-mode options are
	 * grey, since a training game earns nothing and counts for nothing.
	 *
	 * The card is the map's own checkbox text (see extract_progression.py). It
	 * goes through Tooltip rather than a `title`: the chips live inside a
	 * scrolling list and a .tablewrap, and Tooltip's card is fixed-position and
	 * clamped to the viewport, so it escapes both instead of being clipped by
	 * them — and it reaches touch, which a `title` never does.
	 */
	import { modifier } from '$lib/modifiers';
	import Tooltip from './Tooltip.svelte';

	let {
		id,
		/** Drop the label and keep the glyph, for rows with no room for words. */
		iconOnly = false,
		/**
		 * False where the chip sits inside a link — the list rows are one big
		 * anchor, and Tooltip's default wrapper is a <button>, which may not be
		 * nested inside one. Hover still reads; the row's own link stays the
		 * thing keyboard and touch reach.
		 */
		focusable = true
	}: { id: number; iconOnly?: boolean; focusable?: boolean } = $props();

	const info = $derived(modifier(id));
</script>

{#if info}
	<Tooltip label={info.name} text={info.desc} {focusable} maxWidth={260}>
		<span class="mod" style="--mod: var(--mod-{id})">
			<svg viewBox="0 0 16 16" aria-hidden="true">
				{#if id === 1}
					<!-- Outbreak: a swarm -->
					<circle cx="4.5" cy="5" r="2.1" /><circle cx="11.5" cy="5" r="2.1" />
					<circle cx="8" cy="11" r="2.1" />
				{:else if id === 2}
					<!-- Rifle: only riflemen and medics -->
					<path d="M2 5.5h11l-1.5 3H6.5L5 12M2 5.5V8M9 8.5l1.5 3.5" />
				{:else if id === 3}
					<!-- Tier 1: the low tiers instead -->
					<path d="M8 2.2 13.2 13H2.8Z" /><path d="M8 7.5v2.2" />
				{:else if id === 4}
					<!-- 1 life: a single heart, no revives -->
					<path
						d="M8 13.4C4.6 11 2.4 8.9 2.4 6.5A2.9 2.9 0 0 1 8 5a2.9 2.9 0 0 1 5.6 1.5c0 2.4-2.2 4.5-5.6 6.9Z"
					/>
				{:else if id === 5}
					<!-- Training: a target, nothing at stake -->
					<circle cx="8" cy="8" r="5.6" /><circle cx="8" cy="8" r="2.1" />
				{:else if id === 6}
					<!-- Blizzard: cold and slow -->
					<path d="M8 1.6v12.8M2.5 4.8l11 6.4M13.5 4.8l-11 6.4" />
				{:else if id === 7}
					<!-- Level 12: start topped out -->
					<path d="M3 12.5h10M5.5 12.5V8M8 12.5V5M10.5 12.5V2.8" />
				{:else if id === 8}
					<!-- Auto-revive: no defeat -->
					<path d="M13.2 8a5.2 5.2 0 1 1-1.7-3.9" /><path d="M13.4 2.2v3.2h-3.2" />
				{:else if id === 9}
					<!-- Cheats: console commands -->
					<path d="M3.5 4.5 7 8l-3.5 3.5M8.5 12h4" />
				{:else if id === 10}
					<!-- Sushis: infection spreading between players -->
					<circle cx="4" cy="4.5" r="2" /><circle cx="12" cy="11.5" r="2" />
					<path d="M5.6 6 10.4 10" stroke-dasharray="1.6 1.5" />
				{:else if id === 11}
					<!-- Classical: the new classes barred -->
					<circle cx="8" cy="8" r="5.6" /><path d="M4 12 12 4" />
				{:else if id === 12}
					<!-- Infested: creep tumors -->
					<path d="M2.4 12.5c1.6-.1 2.3-1.4 2.6-2.7.4 1 1 1.5 1.8 1.7.3-1.9 1.3-3.1 2.9-3.7" />
					<circle cx="11.6" cy="6" r="2.3" /><path d="M2.4 12.5h11.2" />
				{:else if id === 13}
					<!-- Rainy Day: rain, and the Mayor's turret -->
					<path d="M3.4 7.6a2.7 2.7 0 0 1 .4-5.3 3.6 3.6 0 0 1 6.8 1 2.4 2.4 0 0 1-.4 4.3" />
					<path d="M4.5 10.5 3.6 13M8 10.5 7.1 13M11.5 10.5l-.9 2.5" />
				{/if}
			</svg>
			{#if !iconOnly}<span class="mod-name">{info.name}</span>{/if}
		</span>
	</Tooltip>
{/if}

<style>
	/* A chip, not coloured text: modifiers sit beside the mode and must not
	   compete with it. The tint is the modifier's own colour at low alpha with
	   a matching hairline, so a row of them reads as a group. */
	.mod {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 0 4px;
		border: 1px solid color-mix(in srgb, var(--mod) 35%, transparent);
		border-radius: var(--r-sm);
		background: color-mix(in srgb, var(--mod) 13%, transparent);
		color: var(--mod);
		white-space: nowrap;
		/* the chip is as tall as what it holds, so a row of them does not sit
		   taller than the text they line up with */
		line-height: 1;
		cursor: help;
	}
	svg {
		width: 1.05em;
		height: 1.05em;
		flex: none;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.mod-name {
		font-size: 0.92em;
		font-weight: 600;
	}
</style>
