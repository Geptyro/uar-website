<script module lang="ts">
	/**
	 * Low-poly stat icon: faceted polygons on a 24px grid, shaded via per-facet
	 * opacity. Colors come from the theme tokens so both themes stay legible.
	 */
	export type StatIconName =
		| 'role'
		| 'type'
		| 'life'
		| 'armor'
		| 'speed'
		| 'energy'
		| 'bag'
		| 'trees'
		| 'items'
		| 'regen'
		| 'sight';

	const ICONS: Record<StatIconName, { p: string; o: number }[]> = {
		role: [
			{ p: '12,2 12,22 9.5,14.5 2,12 9.5,9.5', o: 1 },
			{ p: '12,2 14.5,9.5 22,12 14.5,14.5 12,22', o: 0.55 }
		],
		type: [
			{ p: '12,3 15.5,6.5 12,10 8.5,6.5', o: 1 },
			{ p: '5,21 12,11.5 19,21', o: 0.6 }
		],
		life: [
			{ p: '12,21 3.5,11.5 3.5,7 7.5,4 12,7.5', o: 1 },
			{ p: '12,21 12,7.5 16.5,4 20.5,7 20.5,11.5', o: 0.55 }
		],
		armor: [
			{ p: '12,3 4,6 4,12 12,21', o: 1 },
			{ p: '12,3 20,6 20,12 12,21', o: 0.55 }
		],
		speed: [
			{ p: '4,5 14,12 4,19', o: 1 },
			{ p: '12,5 22,12 12,19', o: 0.55 }
		],
		energy: [
			{ p: '14,2 4,14 11,14', o: 1 },
			{ p: '10,22 20,10 13,10', o: 0.6 }
		],
		bag: [
			{ p: '5,9 12,4.5 19,9', o: 1 },
			{ p: '4,21 5,9 12,9 12,21', o: 0.75 },
			{ p: '12,21 12,9 19,9 20,21', o: 0.45 }
		],
		trees: [
			{ p: '6,4 8.5,6.5 6,9 3.5,6.5', o: 1 },
			{ p: '18,4 20.5,6.5 18,9 15.5,6.5', o: 0.6 },
			{ p: '6,15.5 8.5,18 6,20.5 3.5,18', o: 0.6 },
			{ p: '5.4,9 6.6,9 6.6,15.5 5.4,15.5', o: 0.35 },
			{ p: '8.5,6 15.5,6 15.5,7 8.5,7', o: 0.35 }
		],
		items: [
			{ p: '12,3 20,7 12,11 4,7', o: 1 },
			{ p: '4,7 12,11 12,21 4,17', o: 0.65 },
			{ p: '20,7 20,17 12,21 12,11', o: 0.4 }
		],
		regen: [
			{ p: '10,3 14,3 14,21 10,21', o: 1 },
			{ p: '3,10 21,10 21,14 3,14', o: 0.55 }
		],
		sight: [
			{ p: '2,12 12,5.5 22,12', o: 0.45 },
			{ p: '2,12 12,18.5 22,12', o: 0.7 },
			{ p: '12,8 16,12 12,16 8,12', o: 1 }
		]
	};

	const COLORS: Record<StatIconName, string> = {
		role: 'var(--mos)',
		type: 'var(--ink-2)',
		life: 'var(--hostile)',
		armor: 'var(--mos)',
		speed: 'var(--accent)',
		energy: 'var(--item)',
		bag: 'var(--item)',
		trees: 'var(--accent)',
		items: 'var(--ink-2)',
		regen: 'var(--accent)',
		sight: 'var(--ink-2)'
	};
</script>

<script lang="ts">
	let {
		name,
		size = 17,
		colored = true
	}: { name: StatIconName; size?: number; colored?: boolean } = $props();
</script>

<svg
	viewBox="0 0 24 24"
	width={size}
	height={size}
	aria-hidden="true"
	style="color: {colored ? COLORS[name] : 'currentColor'}; flex-shrink: 0"
>
	{#each ICONS[name] as facet, i (i)}
		<polygon points={facet.p} fill="currentColor" opacity={facet.o} />
	{/each}
</svg>
