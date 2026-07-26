<script lang="ts">
	import { SLOT_MINUTES, type ActivityTimeline } from '$lib/activity';

	let { timeline }: { timeline: ActivityTimeline } = $props();

	let hovered: number | null = $state(null);

	const SLOT_MS = SLOT_MINUTES * 60 * 1000;
	const values = $derived(timeline.values);
	const n = $derived(values.length);

	const max = $derived(Math.max(...values, 0.1));
	// clean tick step (1/2/5 × 10^n) so the 2–3 gridlines land on round numbers
	const step = $derived.by(() => {
		for (let mag = 0.1; ; mag *= 10)
			for (const s of [1, 2, 5]) if (max <= 3 * s * mag) return s * mag;
	});
	const top = $derived(Math.ceil(max / step - 1e-9) * step);
	const ticks = $derived(Array.from({ length: Math.round(top / step) }, (_, i) => (i + 1) * step));

	const x = (i: number) => (100 * i) / (n - 1);
	const y = (v: number) => 100 - (100 * v) / top;
	const points = $derived(values.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' '));

	// axis labels at the viewer's local midnights, anchored on the newest and
	// strided to at most ~5 labels so they stay apart at mobile widths; SSR
	// renders the server's timezone (UTC on Fly), hydration re-renders
	const mids = $derived.by(() => {
		const end = timeline.start + n * SLOT_MS;
		const stride = Math.max(1, Math.ceil(n / 48 / 5));
		const out: { frac: number; label: string }[] = [];
		const fmtDay = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });
		const d = new Date(end);
		d.setHours(0, 0, 0, 0);
		for (let day = 0; d.getTime() >= timeline.start; day++, d.setDate(d.getDate() - 1)) {
			if (day % stride === 0)
				out.push({ frac: (d.getTime() - timeline.start) / (n * SLOT_MS), label: fmtDay.format(d) });
		}
		return out;
	});

	const fmtWhen = new Intl.DateTimeFormat('en', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	});
	const when = (i: number) => fmtWhen.format(new Date(timeline.start + i * SLOT_MS));
	const fmt = (v: number) => (v >= 10 ? String(Math.round(v)) : (Math.round(v * 10) / 10).toString());

	// daily digest for the screen-reader table (a 672-row table helps no one)
	const dayRows = $derived.by(() => {
		const fmtDay = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' });
		const rows = new Map<string, { sum: number; count: number; peak: number; peakAt: string }>();
		for (let i = 0; i < n; i++) {
			const at = new Date(timeline.start + i * SLOT_MS);
			const key = fmtDay.format(at);
			const row = rows.get(key) ?? { sum: 0, count: 0, peak: 0, peakAt: '' };
			row.sum += values[i];
			row.count++;
			if (values[i] > row.peak) {
				row.peak = values[i];
				row.peakAt = at.toTimeString().slice(0, 5);
			}
			rows.set(key, row);
		}
		return [...rows].map(([day, r]) => ({ day, avg: r.sum / r.count, peak: r.peak, peakAt: r.peakAt }));
	});

	// must match the CSS gutter (tick-label column) below
	const GUTTER = 30;

	/** Snap the pointer to the nearest half-hour sample. */
	function pick(e: PointerEvent) {
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const w = r.width - GUTTER;
		if (w <= 0) return;
		const i = Math.round(((n - 1) * (e.clientX - r.left - GUTTER)) / w);
		hovered = Math.max(0, Math.min(n - 1, i));
	}
</script>

<!-- the visual chart is hover-only; the table below carries the values for AT -->
<div
	class="plot"
	role="img"
	aria-label="Chart of players in game over the last {Math.round((n * SLOT_MINUTES) / (24 * 60))} days"
	onpointermove={pick}
	onpointerdown={pick}
	onpointerleave={() => (hovered = null)}
>
	{#each ticks as t (t)}
		<div class="grid" style="bottom: {(100 * t) / top}%">
			<span class="tick">{fmt(t)}</span>
		</div>
	{/each}
	<div class="area">
		<svg viewBox="0 0 100 100" preserveAspectRatio="none">
			<polygon class="wash" points="{points} 100,100 0,100" />
			<polyline class="line" points={points} />
		</svg>
		{#each mids as m (m.label)}
			<span class="xlabel" style="left: {100 * m.frac}%">{m.label}</span>
		{/each}
		{#if hovered !== null}
			<div class="cross" style="left: {x(hovered)}%"></div>
			<div class="dot" style="left: {x(hovered)}%; bottom: {(100 * values[hovered]) / top}%"></div>
			<div class="tip" style="left: clamp(60px, {x(hovered)}%, calc(100% - 60px))">
				<b>≈{fmt(values[hovered])}</b> in game
				<span class="tip-when">{when(hovered)}</span>
			</div>
		{/if}
	</div>
</div>

<table class="sr-only">
	<caption>Players in game per day (average and peak half-hour)</caption>
	<thead>
		<tr><th>Day</th><th>Average</th><th>Peak</th><th>Peak at</th></tr>
	</thead>
	<tbody>
		{#each dayRows as r (r.day)}
			<tr>
				<th scope="row">{r.day}</th>
				<td>{fmt(r.avg)}</td>
				<td>{fmt(r.peak)}</td>
				<td>{r.peakAt}</td>
			</tr>
		{/each}
	</tbody>
</table>

<style>
	.plot {
		position: relative;
		height: 108px;
		/* room for the x-label band below the baseline */
		margin: 14px 0 18px;
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
		font-family: var(--mono);
		font-size: 10px;
		color: var(--ink-3);
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
	.wash {
		fill: var(--accent);
		fill-opacity: 0.1;
	}
	.line {
		fill: none;
		stroke: var(--accent);
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
		vector-effect: non-scaling-stroke;
	}
	.xlabel {
		position: absolute;
		top: calc(100% + 5px);
		transform: translateX(-50%);
		font-family: var(--mono);
		font-size: 10px;
		color: var(--ink-3);
		white-space: nowrap;
	}
	.cross {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 1px;
		background: var(--border-strong);
	}
	.dot {
		position: absolute;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent);
		/* 2px surface ring so it stays legible on the line */
		box-shadow: 0 0 0 2px var(--surface);
		transform: translate(-50%, 50%);
	}
	.tip {
		position: absolute;
		top: -6px;
		transform: translateX(-50%);
		background: var(--surface);
		border: 1px solid var(--border-strong);
		border-radius: var(--r-sm);
		padding: 3px 8px;
		font-size: 11px;
		color: var(--ink-3);
		white-space: nowrap;
		pointer-events: none;
	}
	.tip b {
		font-size: 12px;
		color: var(--ink);
		font-weight: 650;
	}
	.tip-when {
		margin-left: 5px;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
