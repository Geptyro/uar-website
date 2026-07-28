<script lang="ts">
	/**
	 * One game's mode, as a coloured glyph and its name.
	 *
	 * Twelve icons and twelve colours, because the mode is the first thing
	 * anyone scanning a list of games wants to know and a word alone does not
	 * survive being skimmed. The six ordered difficulties run warm — green up
	 * through red and past it for Apocalypse — so the colour alone ranks them;
	 * the six side modes are cool, so they read as off that ladder. Colour is
	 * never the only signal: every mode also has its own shape, and the name is
	 * always spelled out next to it.
	 *
	 * `mode` is 1..12 (see lib/mode.ts). Anything else renders nothing, which is
	 * what a game whose mode neither the vote nor the win counters could settle
	 * should look like — the caller decides what stands in its place.
	 */
	import { modeName } from '$lib/players';

	let {
		mode,
		/** Icon only, for a place with no room for the word (list meta lines). */
		iconOnly = false
	}: { mode: number | null | undefined; iconOnly?: boolean } = $props();

	const name = $derived(modeName(mode));
</script>

{#if mode && name}
	<span class="mode" style="--mode: var(--mode-{mode})" title={iconOnly ? `${name} mode` : null}>
		<svg viewBox="0 0 16 16" aria-hidden="true">
			{#if mode === 1}
				<!-- Recruit: one rank chevron -->
				<path d="M3.5 10.5 8 6l4.5 4.5" />
			{:else if mode === 2}
				<!-- Normal: two -->
				<path d="M3.5 12.5 8 8l4.5 4.5M3.5 8 8 3.5 12.5 8" />
			{:else if mode === 3}
				<!-- Hard: three -->
				<path d="M3.5 13.5 8 9.5l4.5 4M3.5 9.5 8 5.5l4.5 4M3.5 5.5 8 1.5l4.5 4" />
			{:else if mode === 4}
				<!-- Insane: flame -->
				<path
					d="M8 1.6c2.6 3 3.4 4.6 3.4 6.6a3.4 3.4 0 0 1-6.8 0c0-1.5.7-2.6 1.8-3.7.3 1 .8 1.5 1.3 1.9.6-1.4.6-3 .3-4.8Z"
				/>
			{:else if mode === 5}
				<!-- Nightmare: skull -->
				<path d="M8 1.8a5 5 0 0 1 5 5v2.6a1.8 1.8 0 0 1-1.8 1.8H4.8A1.8 1.8 0 0 1 3 9.4V6.8a5 5 0 0 1 5-5Z" />
				<path d="M6 11.2v3M10 11.2v3" />
				<circle class="fill" cx="6" cy="7" r="1.35" />
				<circle class="fill" cx="10" cy="7" r="1.35" />
			{:else if mode === 6}
				<!-- Competitive: crossed blades -->
				<path d="M3 2.5 10 11M13 2.5 6 11M4 14l2.6-2.6M12 14l-2.6-2.6" />
			{:else if mode === 7}
				<!-- Survival: hourglass -->
				<path d="M4 2h8L8 8l4 6H4l4-6Z" />
				<path d="M3 2h10M3 14h10" />
			{:else if mode === 8}
				<!-- PMC: shield -->
				<path d="M8 1.7 13 3.6v4.1c0 3.3-2 5.6-5 6.6-3-1-5-3.3-5-6.6V3.6Z" />
			{:else if mode === 9}
				<!-- Invasion: craft over a beam -->
				<path d="M5 7.4a3 3 0 0 1 6 0" />
				<ellipse cx="8" cy="8.4" rx="6" ry="1.9" />
				<path d="M5.6 11.6 3.6 14.5M10.4 11.6l2 2.9" />
			{:else if mode === 10}
				<!-- Infested: trefoil -->
				<circle cx="8" cy="4.2" r="2.6" />
				<circle cx="4.4" cy="10.4" r="2.6" />
				<circle cx="11.6" cy="10.4" r="2.6" />
			{:else if mode === 11}
				<!-- PMC+: shield, reinforced -->
				<path d="M8 1.7 13 3.6v4.1c0 3.3-2 5.6-5 6.6-3-1-5-3.3-5-6.6V3.6Z" />
				<path d="M8 5v5M5.5 7.5h5" />
			{:else if mode === 12}
				<!-- Apocalypse: burst -->
				<circle class="fill" cx="8" cy="8" r="2" />
				<path
					d="M8 .8v3M8 12.2v3M.8 8h3M12.2 8h3M3 3l2.1 2.1M10.9 10.9 13 13M13 3l-2.1 2.1M5.1 10.9 3 13"
				/>
			{/if}
		</svg>
		{#if !iconOnly}<span class="mode-name">{name}</span>{/if}
	</span>
{/if}

<style>
	.mode {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--mode);
		white-space: nowrap;
	}
	svg {
		/* sized off the surrounding text so one component serves an 11px list
		   meta line and a 13px table cell without either being told a pixel size */
		width: 1.15em;
		height: 1.15em;
		flex: none;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	/* the few shapes that read as solid at 12px: skull eyes, the burst's core */
	svg .fill {
		fill: currentColor;
		stroke: none;
	}
	.mode-name {
		font-weight: 600;
	}
</style>
