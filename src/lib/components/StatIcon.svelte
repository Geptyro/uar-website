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
		| 'sight'
		| 'damage'
		| 'clock'
		| 'cast'
		| 'range'
		| 'charges'
		| 'splash'
		| 'bonus'
		| 'burn'
		| 'sparkle'
		| 'remove'
		| 'biological'
		| 'mechanical'
		| 'fitness'
		| 'firerate';

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
		],
		// a round, lit down the middle like life/armor — reads as damage dealt
		damage: [
			{ p: '12,2 7.5,9 7.5,21 12,21', o: 1 },
			{ p: '12,2 16.5,9 16.5,21 12,21', o: 0.55 }
		],
		// The skill-sheet rows. A dial with a wedge gone: time spent, time to wait
		clock: [
			{ p: '12,12 12,2 5,5 2,12 5,19 12,22 19,19 22,12', o: 1 },
			{ p: '12,12 12,2 19,5 22,12', o: 0.35 }
		],
		// an hourglass, the top bulb full: the cast still running
		cast: [
			{ p: '6,3 18,3 12,12', o: 1 },
			{ p: '12,12 6,21 18,21', o: 0.5 }
		],
		// a reticle: the faint outer diamond is the reach, the solid one the mark
		range: [
			{ p: '12,3 21,12 12,21 3,12', o: 0.35 },
			{ p: '12,8 16,12 12,16 8,12', o: 1 }
		],
		// three slabs stacked, the full one at the bottom: a charge count
		charges: [
			{ p: '4,15 20,15 20,20 4,20', o: 1 },
			{ p: '4,9.5 20,9.5 20,13.5 4,13.5', o: 0.7 },
			{ p: '4,4 20,4 20,8 4,8', o: 0.4 }
		],
		// rings around the hit, fading outward like the damage does
		splash: [
			{ p: '12,2 22,12 12,22 2,12', o: 0.3 },
			{ p: '12,6 18,12 12,18 6,12', o: 0.55 },
			{ p: '12,9.5 14.5,12 12,14.5 9.5,12', o: 1 }
		],
		// an arrow up: more against something
		bonus: [
			{ p: '12,3 20,11 4,11', o: 1 },
			{ p: '9,11 15,11 15,21 9,21', o: 0.55 }
		],
		// a flame with a lighter core: damage that keeps coming
		burn: [
			{ p: '12,2 17,9 19,15 12,22 5,15 7,9', o: 1 },
			{ p: '12,10 15,15 12,20 9,15', o: 0.45 }
		],
		// a spark and a smaller one beside it: a buff or debuff landing
		sparkle: [
			{ p: '11,4 12.5,10.5 19,12 12.5,13.5 11,20 9.5,13.5 3,12 9.5,10.5', o: 1 },
			{ p: '18.5,2 19.5,5 22.5,6 19.5,7 18.5,10 17.5,7 14.5,6 17.5,5', o: 0.55 }
		],
		// a cross struck through: an effect taken off
		remove: [
			{ p: '5,7 7,5 19,17 17,19', o: 1 },
			{ p: '19,7 17,5 5,17 7,19', o: 0.55 }
		],
		// The two target types a hit can be limited to. Biological: a cell, its
		// nucleus off-centre; mechanical: a cog, four teeth on a faceted hub.
		biological: [
			{ p: '12,2 19,5.5 21.5,12 18,19 11,22 4.5,18 2.5,11 5.5,5', o: 0.55 },
			{ p: '10,8 14,9 15,13 11,15 8,12', o: 1 }
		],
		// a dumbbell: fitness points
		fitness: [
			{ p: '3,8 7,8 7,16 3,16', o: 1 },
			{ p: '17,8 21,8 21,16 17,16', o: 1 },
			{ p: '7,10.5 17,10.5 17,13.5 7,13.5', o: 0.55 }
		],
		// three bars rising: shots coming faster
		firerate: [
			{ p: '3,14 6.5,14 6.5,21 3,21', o: 0.45 },
			{ p: '10,9 13.5,9 13.5,21 10,21', o: 0.7 },
			{ p: '17,3 20.5,3 20.5,21 17,21', o: 1 }
		],
		mechanical: [
			{ p: '10,2 14,2 14,5 10,5', o: 1 },
			{ p: '10,19 14,19 14,22 10,22', o: 1 },
			{ p: '2,10 5,10 5,14 2,14', o: 1 },
			{ p: '19,10 22,10 22,14 19,14', o: 1 },
			{ p: '12,5 17,8 17,16 12,19 7,16 7,8', o: 0.75 },
			{ p: '12,9.5 14.5,12 12,14.5 9.5,12', o: 0.3 }
		]
	};

	const COLORS: Record<StatIconName, string> = {
		role: 'var(--mos)',
		type: 'var(--text-dim)',
		life: 'var(--hostile)',
		armor: 'var(--mos)',
		speed: 'var(--accent)',
		energy: 'var(--item)',
		bag: 'var(--item)',
		trees: 'var(--accent)',
		items: 'var(--text-dim)',
		regen: 'var(--accent)',
		sight: 'var(--text-dim)',
		damage: 'var(--item)',
		// time waits are blue like armor, what the hit does is gold like damage,
		// what burns is red like life, what lands on a unit is green like regen
		clock: 'var(--mos)',
		cast: 'var(--mos)',
		range: 'var(--mos)',
		charges: 'var(--item)',
		splash: 'var(--item)',
		bonus: 'var(--item)',
		burn: 'var(--hostile)',
		sparkle: 'var(--accent)',
		remove: 'var(--text-dim)',
		biological: 'var(--accent)',
		mechanical: 'var(--mos)',
		fitness: 'var(--hostile)',
		firerate: 'var(--item)'
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
