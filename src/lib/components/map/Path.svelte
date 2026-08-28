<svelte:options namespace="svg" />

<script lang="ts">
	/**
	 * A line through places, in order: a route a unit is driven along, or a
	 * stretch something may appear on. Geography, so it grows with the
	 * ground; its stroke, its vertex dots and its labels keep their size.
	 * Vertices are numbered once the map is looked at closely.
	 */
	import { getContext } from 'svelte';
	import { MAP_CTX, type HoverInfo, type MapCtx, type MapTone } from './context';

	let {
		points,
		tone,
		dashed = false,
		label = null,
		numbered = true,
		numbersFrom = 2,
		info = null
	}: {
		/** Game coordinates, in order. */
		points: { x: number; y: number }[];
		tone: MapTone;
		/** A stretch rather than a route. */
		dashed?: boolean;
		/** Written at the first point. */
		label?: string | null;
		/** Number the vertices. */
		numbered?: boolean;
		/** Show the numbers only from this zoom on. */
		numbersFrom?: number;
		/** What the tooltip says when the pointer is on it. */
		info?: HoverInfo | null;
	} = $props();

	const m = getContext<MapCtx>(MAP_CTX);
	const d = $derived(points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${m.flip(p.y)}`).join(' '));
	/* the route's name and its numbers are written by the map's label layer:
	   small, low priority, so a point's own name wins the place */
	const id = $props.id();
	$effect(() => {
		const showNumbers = numbered && 1 / m.k >= numbersFrom;
		points.forEach((p, i) => {
			m.label(
				`${id}:${i}`,
				showNumbers && points.length >= 2
					? { id: `${id}:${i}`, x: p.x, y: m.flip(p.y), text: String(i + 1), tone, r: 1.8 * m.k, priority: 0, scale: 0.85 }
					: null
			);
		});
		m.label(
			`${id}:name`,
			label && points.length >= 2
				? { id: `${id}:name`, x: points[0].x, y: m.flip(points[0].y), text: label, tone, r: 1.8 * m.k, priority: 1 }
				: null
		);
		return () => {
			points.forEach((_, i) => m.label(`${id}:${i}`, null));
			m.label(`${id}:name`, null);
		};
	});
</script>

{#if points.length >= 2}
	<!-- the tooltip is a hover aid; what it says is also in the page's text, so this stays pointer-only -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<path
		class="m-path t-{tone}"
		class:dashed
		class:told={!!info}
		{d}
		onpointerenter={(e) => info && m.hover(info, e)}
		onpointermove={(e) => info && m.hover(info, e)}
		onpointerleave={() => info && m.hover(null)}
	/>
	{#each points as p, i (`${p.x},${p.y},${i}`)}
		<circle class="m-vertex t-{tone}" cx={p.x} cy={m.flip(p.y)} r={1.8 * m.k} />
	{/each}
{/if}
