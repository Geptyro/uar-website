<script lang="ts">
	import type { Outcome } from '$lib/outcome';

	let {
		outcome,
		size = 'sm'
	}: {
		/** Nothing is rendered while the outcome is unknown — see lib/outcome.ts. */
		outcome?: Outcome | null;
		size?: 'sm' | 'lg';
	} = $props();

	const label = $derived(outcome === 'win' ? 'Won' : 'Lost');
	const tip = $derived(
		outcome === 'win'
			? 'Won — the squad made it to the end of the game'
			: 'Lost — the squad was wiped out'
	);
</script>

{#if outcome}
	<span class="mark {outcome} {size}" role="img" aria-label={label} title={tip}>
		{outcome === 'win' ? '✓' : '✕'}
	</span>
{/if}

<style>
	.mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		border-radius: 999px;
		font-weight: 700;
		line-height: 1;
	}
	.sm {
		width: 15px;
		height: 15px;
		font-size: 9.5px;
	}
	.lg {
		width: 26px;
		height: 26px;
		font-size: 15px;
	}
	.win {
		background: var(--accent-soft);
		color: var(--accent);
	}
	.loss {
		background: var(--hostile-soft);
		color: var(--hostile);
	}
</style>
