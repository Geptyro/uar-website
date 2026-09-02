<script lang="ts">
	/**
	 * The last-year activity block on the overview, under the seven-day chart:
	 * the chart plus the switch that picks what it counts.
	 *
	 * The switch lives here rather than in the chart so the chart stays a pure
	 * view of one series — the same split ActivityChart is on.
	 */
	import YearChart from '$lib/components/YearChart.svelte';
	import { METRIC_LABEL, type YearMetric, type YearTimeline } from '$lib/yearActivity';

	let {
		year,
		metric = $bindable<YearMetric>('players')
	}: { year: YearTimeline; metric?: YearMetric } = $props();

	const METRICS: YearMetric[] = ['players', 'games'];
</script>

<div class="switch" role="group" aria-label="Chart metric">
	{#each METRICS as m (m)}
		<button type="button" class:on={metric === m} onclick={() => (metric = m)}>
			{METRIC_LABEL[m]}
		</button>
	{/each}
</div>

<YearChart {year} {metric} />

<style>
	.switch {
		display: flex;
		margin: 2px 0 4px;
	}
	.switch button {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 4px 9px;
		background: var(--surface);
		color: var(--text-faint);
		border: 1px solid var(--border-strong);
		cursor: pointer;
	}
	.switch button + button {
		border-left: 0;
	}
	.switch button:first-child {
		border-radius: var(--radius-2) 0 0 var(--radius-2);
	}
	.switch button:last-child {
		border-radius: 0 var(--radius-2) var(--radius-2) 0;
	}
	.switch button:hover {
		color: var(--text);
	}
	.switch button.on {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-contrast);
	}
</style>
