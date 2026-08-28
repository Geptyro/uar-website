<script lang="ts">
	/**
	 * The way to the months a changelog page is not showing: one link per
	 * month with its release count, and, from a month page, one back to the
	 * front. A strip rather than a pager because a month is a stable address
	 * (/changelog/2026-07 says the same thing next year) where "page 3" is
	 * whatever it happens to hold this week.
	 */
	import { monthLabel, type Month } from '$lib/changelog';

	let {
		months,
		label = 'Earlier',
		latest = false
	}: {
		months: Month[];
		/** what the strip is called: the front page says Earlier, a month page Other months */
		label?: string;
		/** whether to lead with a link back to /changelog */
		latest?: boolean;
	} = $props();
</script>

{#if latest || months.length}
	<nav class="months" aria-label={label}>
		<span class="label">{label}</span>
		{#if latest}<a href="/changelog">Latest</a>{/if}
		{#each months as m (m.month)}
			<a href="/changelog/{m.month}">
				{monthLabel(m.month)}
				<span class="n">{m.releases.length}</span>
			</a>
		{/each}
	</nav>
{/if}

<style>
	.months {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 6px 10px;
		margin: 6px 0 22px;
		font-size: 13px;
	}
	.label {
		color: var(--text-faint);
		font-size: 12px;
	}
	a {
		color: var(--accent);
		text-decoration: none;
		white-space: nowrap;
	}
	a:hover {
		text-decoration: underline;
	}
	.n {
		margin-left: 2px;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--text-faint);
	}
</style>
