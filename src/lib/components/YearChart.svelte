<script lang="ts">
	/**
	 * The year as one continuous series: a faint bar per day under a 7-day
	 * trailing mean, in the same visual language as the week chart above it.
	 *
	 * The mean is what the eye follows — a year in this archive is not flat —
	 * but the raw days stay in behind it, because the line alone hides how
	 * spiky they actually are, and a fortnight of nothing looks the same as a
	 * fortnight of two games a day once it is smoothed.
	 */
	import {
		DAY_MS,
		METRIC_LABEL,
		monthsOf,
		rollingMean,
		seriesOf,
		type YearMetric,
		type YearTimeline
	} from '$lib/yearActivity';

	let {
		year,
		metric = 'players'
	}: { year: YearTimeline; metric?: YearMetric } = $props();

	/** Window of the trend line. A week, so the weekday rhythm averages out. */
	const MEAN_DAYS = 7;

	const values = $derived(seriesOf(year, metric));
	const n = $derived(values.length);
	const mean = $derived(rollingMean(values, MEAN_DAYS));

	let hovered: number | null = $state(null);

	const max = $derived(Math.max(...values, 0.1));
	// same clean 1/2/5 × 10ⁿ tick step the week chart uses, so the two read alike
	const step = $derived.by(() => {
		for (let mag = 0.01; ; mag *= 10)
			for (const s of [1, 2, 5]) if (max <= 3 * s * mag) return s * mag;
	});
	const top = $derived(Math.ceil(max / step - 1e-9) * step);
	const ticks = $derived(Array.from({ length: Math.round(top / step) }, (_, i) => (i + 1) * step));

	const x = (i: number) => (100 * i) / (n - 1);
	const y = (v: number) => 100 - (100 * v) / top;
	const trend = $derived(mean.map((v, i) => `${x(i).toFixed(3)},${y(v).toFixed(2)}`).join(' '));

	/**
	 * Month ticks. The window's leading stub gets no label — it would sit on
	 * top of the next month's — and past a dozen they are thinned from the
	 * newest end, so the label that survives is always the current month.
	 */
	const months = $derived.by(() => {
		const fmt = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' });
		const all = monthsOf(year, 12);
		const stride = all.length > 12 ? 2 : 1;
		return all
			.filter((_, i) => (all.length - 1 - i) % stride === 0)
			.map((m) => ({ frac: m.from / n, label: fmt.format(new Date(year.start + m.from * DAY_MS)) }));
	});

	const fmtDay = new Intl.DateTimeFormat('en', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		timeZone: 'UTC'
	});
	const num = (v: number) => (v >= 10 ? String(Math.round(v)) : String(Math.round(v * 10) / 10));

	/** Both numbers whichever is selected: one is the bar, the other is context. */
	const games = (i: number) => `${year.games[i]} ${year.games[i] === 1 ? 'game' : 'games'}`;

	// must match the CSS gutter (tick-label column) below
	const GUTTER = 30;

	function pick(e: PointerEvent) {
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const w = r.width - GUTTER;
		if (w <= 0) return;
		const i = Math.round(((n - 1) * (e.clientX - r.left - GUTTER)) / w);
		hovered = Math.max(0, Math.min(n - 1, i));
	}
</script>

<div
	class="plot"
	role="img"
	aria-label="Chart of {METRIC_LABEL[metric].toLowerCase()} per day over the last year"
	onpointermove={pick}
	onpointerdown={pick}
	onpointerleave={() => (hovered = null)}
>
	{#each ticks as t (t)}
		<div class="grid" style="bottom: {(100 * t) / top}%">
			<span class="tick">{num(t)}</span>
		</div>
	{/each}
	<div class="area">
		<svg viewBox="0 0 100 100" preserveAspectRatio="none">
			<!-- one thin bar a day: at ~2px each a polygon would just be fill -->
			{#each values as v, i (i)}
				{#if v > 0}
					<rect
						class="bar"
						x={x(i)}
						y={y(v)}
						width={100 / n}
						height={100 - y(v)}
						vector-effect="non-scaling-stroke"
					/>
				{/if}
			{/each}
			<polyline class="line" points={trend} />
		</svg>
		{#each months as m (m.label + m.frac)}
			<span class="xlabel" style="left: {100 * m.frac}%">{m.label}</span>
		{/each}
		{#if hovered !== null}
			<div class="cross" style="left: {x(hovered)}%"></div>
			<div class="tip" style="left: clamp(110px, {x(hovered)}%, calc(100% - 110px))">
				<b>
					{#if metric === 'games'}
						{games(hovered)}
					{:else}
						≈{num(values[hovered])} in game
					{/if}
				</b>
				<span class="tip-when">
					{fmtDay.format(new Date(year.start + hovered * DAY_MS))} ·
					{#if metric === 'games'}
						≈{num(year.players[hovered])} in game
					{:else}
						{games(hovered)}
					{/if}
					· 7-day avg {num(mean[hovered])}
				</span>
			</div>
		{/if}
	</div>
</div>

<style>
	.plot {
		position: relative;
		height: 130px;
		margin: 14px 0 20px;
	}
	.plot::after {
		content: '';
		position: absolute;
		left: 30px;
		right: 0;
		bottom: 0;
		border-top: 1px solid var(--border-strong);
	}
	.grid {
		position: absolute;
		left: 30px;
		right: 0;
		height: 0;
		border-top: 1px solid var(--border);
	}
	.tick {
		position: absolute;
		right: calc(100% + 6px);
		top: -0.7em;
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--text-faint);
		font-variant-numeric: tabular-nums;
	}
	.area {
		position: absolute;
		inset: 0 0 0 30px;
	}
	svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
	}
	.bar {
		fill: var(--accent);
		fill-opacity: 0.28;
	}
	.line {
		fill: none;
		stroke: var(--accent);
		stroke-width: 1.75;
		stroke-linejoin: round;
		stroke-linecap: round;
		vector-effect: non-scaling-stroke;
	}
	.xlabel {
		position: absolute;
		top: calc(100% + 5px);
		transform: translateX(-50%);
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--text-faint);
		white-space: nowrap;
	}
	.cross {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 1px;
		background: var(--border-strong);
	}
	.tip {
		position: absolute;
		top: -6px;
		transform: translateX(-50%);
		background: var(--surface);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-2);
		padding: 3px 8px;
		font-size: 11px;
		color: var(--text-faint);
		white-space: nowrap;
		pointer-events: none;
	}
	.tip b {
		font-size: 12px;
		color: var(--text);
		font-weight: 650;
	}
	.tip-when {
		margin-left: 5px;
	}
</style>
