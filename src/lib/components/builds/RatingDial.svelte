<script lang="ts">
	/**
	 * A guide's mark out of ten as a dial: the ring fills with the share of
	 * votes that went up, the number sits in it. A dash and an empty ring for
	 * a guide nobody has voted on, rather than a zero it did not earn.
	 */
	import { formatRating, rating, ratingTone } from '$lib/builds';

	let { ups = 0, downs = 0, size = 56 }: { ups?: number; downs?: number; size?: number } = $props();

	const mark = $derived(rating(ups, downs));
	const R = 24;
	const C = 2 * Math.PI * R;
	const dash = $derived(mark === null ? 0 : (C * mark) / 10);
	const votes = $derived(ups + downs);
</script>

<span
	class="dial {mark === null ? 'none' : ratingTone(mark)}"
	style:--size="{size}px"
	role="img"
	aria-label={mark === null ? 'No votes yet' : `${formatRating(mark)} out of 10 from ${votes} ${votes === 1 ? 'vote' : 'votes'}`}
	title={mark === null ? 'No votes yet' : `${formatRating(mark)} out of 10 from ${votes} ${votes === 1 ? 'vote' : 'votes'}`}
>
	<svg viewBox="0 0 56 56" aria-hidden="true">
		<circle class="track" cx="28" cy="28" r={R} />
		{#if mark !== null}
			<circle class="arc" cx="28" cy="28" r={R} stroke-dasharray="{dash} {C}" transform="rotate(-90 28 28)" />
		{/if}
	</svg>
	<span class="n">{mark === null ? '–' : formatRating(mark)}</span>
</span>

<style>
	.dial {
		position: relative;
		display: inline-grid;
		place-items: center;
		width: var(--size);
		height: var(--size);
		flex: none;
		color: var(--text-dim);
	}
	svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.track {
		fill: none;
		stroke: var(--border-strong);
		stroke-width: 4;
	}
	.arc {
		fill: none;
		stroke: currentColor;
		stroke-width: 4;
		stroke-linecap: round;
	}
	.good {
		color: var(--accent);
	}
	.mid {
		color: var(--text-dim);
	}
	.low {
		color: var(--hostile);
	}
	.none {
		color: var(--text-faint);
	}
	.n {
		font: 700 calc(var(--size) * 0.3) / 1 var(--font-mono);
		color: var(--text);
		letter-spacing: -0.02em;
	}
	.none .n {
		color: var(--text-faint);
	}
</style>
