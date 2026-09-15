<script module lang="ts">
	/**
	 * The glyphs a roll is drawn with, cut like StatIcon: a flat facet on a 24px
	 * grid over a copy dropped two pixels at half tone. Holes (a die's pips, a
	 * skull's eyes) are even-odd cut-outs, so they read on both themes.
	 */
	export type RollGlyphName = 'dice' | 'skull' | 'spawn' | 'check' | 'cross' | 'gate' | 'loop' | 'hit';

	const D: Record<RollGlyphName, string> = {
		dice: 'M6 1L16 1L19 4L19 14L16 17L6 17L3 14L3 4ZM6.5 4.5L6.5 7.5L9.5 7.5L9.5 4.5ZM12.5 10.5L12.5 13.5L15.5 13.5L15.5 10.5ZM9.5 7.5L9.5 10.5L12.5 10.5L12.5 7.5Z',
		skull: 'M11 0C6 0 3 3.5 3 8C3 11 4.5 13 6 14L6 18L9 18L9 16L13 16L13 18L16 18L16 14C17.5 13 19 11 19 8C19 3.5 16 0 11 0ZM6.5 7L9.5 7L9.5 10.5L6.5 10.5ZM12.5 7L15.5 7L15.5 10.5L12.5 10.5Z',
		spawn: 'M11 0L18 7L13.5 7L13.5 13L8.5 13L8.5 7L4 7ZM2 15L20 15L20 19L2 19Z',
		check: 'M2 10L5 7L9 11L17 3L20 6L9 17Z',
		cross: 'M4 1L11 8L18 1L21 4L14 11L21 18L18 21L11 14L4 21L1 18L8 11L1 4Z',
		gate: 'M1 1L21 1L13.5 10L13.5 18L8.5 20L8.5 10Z',
		loop: 'M2 1L6 1L6 5L2 5ZM8 2L20 2L20 4L8 4ZM2 8L6 8L6 12L2 12ZM8 9L20 9L20 11L8 11ZM2 15L6 15L6 19L2 19ZM8 16L20 16L20 18L8 18Z',
		hit: 'M11 0L13.5 6.5L20 4L16 10L22 13L15 14L16 20L11 16L6 20L7 14L0 13L6 10L2 4L8.5 6.5Z'
	};

	const COLORS: Record<RollGlyphName, string> = {
		dice: 'var(--gold)',
		skull: 'var(--danger)',
		spawn: 'var(--hostile)',
		check: 'var(--ok)',
		cross: 'var(--text-faint)',
		gate: 'var(--text-dim)',
		loop: 'var(--mos)',
		hit: 'var(--item)'
	};
</script>

<script lang="ts">
	let {
		name,
		size = 17,
		colored = true
	}: { name: RollGlyphName; size?: number; colored?: boolean } = $props();
</script>

<svg
	viewBox="0 0 24 24"
	width={size}
	height={size}
	aria-hidden="true"
	style="color: {colored ? COLORS[name] : 'currentColor'}; flex-shrink: 0"
>
	<path d={D[name]} transform="translate(1 3)" fill="currentColor" fill-rule="evenodd" opacity="0.5" />
	<path d={D[name]} transform="translate(1 1)" fill="currentColor" fill-rule="evenodd" />
</svg>
