<script lang="ts">
	import { jamChance, oddsAtSeconds, rules, shotsPerJam } from '$lib/mechanics';

	let { mag }: { mag: number } = $props();

	// the curve is a step function of "seconds since this player's last jam"; plot a
	// little past the final step so the flat tail is visible
	const LAST = Math.max(...rules.jam.pity.map((s) => s.after));
	const XMAX = LAST + 25;

	const W = 280;
	const H = 104;
	const PAD = { t: 12, r: 8, b: 20, l: 8 };

	type Step = { from: number; to: number; odds: number };
	const steps: Step[] = $derived.by(() => {
		const edges = [0, ...[...rules.jam.pity].map((s) => s.after).sort((a, b) => a - b), XMAX];
		const out: Step[] = [];
		for (let i = 0; i < edges.length - 1; i++) {
			// sample just inside the segment: the trigger uses `>`, so the step at
			// exactly 50s still carries the previous odds
			out.push({ from: edges[i], to: edges[i + 1], odds: oddsAtSeconds(edges[i] + 0.001) });
		}
		return out;
	});

	const chances = $derived(steps.map((s) => jamChance(mag, s.odds)));
	const lo = $derived(Math.min(...chances));
	const hi = $derived(Math.max(...chances));

	const x = (s: number) => PAD.l + (s / XMAX) * (W - PAD.l - PAD.r);
	// a little headroom so the top step is not flush with the frame
	const y = $derived((c: number) => {
		const span = hi - lo || 1;
		return PAD.t + (1 - (c - lo) / span) * (H - PAD.t - PAD.b) * 0.88;
	});

	const path = $derived.by(() => {
		const d: string[] = [];
		steps.forEach((s, i) => {
			const yy = y(chances[i]);
			d.push(`${i === 0 ? 'M' : 'L'}${x(s.from)},${yy}`, `L${x(s.to)},${yy}`);
		});
		return d.join(' ');
	});

	const ticks = [0, 50, 100];
	const n = (v: number) => Math.round(v).toLocaleString('en-US');

	// hover: snap to the step under the pointer
	let hoverAt = $state<number | null>(null);
	const hovered = $derived(
		hoverAt === null ? null : (steps.find((s) => hoverAt! >= s.from && hoverAt! < s.to) ?? steps[steps.length - 1])
	);

	function track(e: PointerEvent) {
		const r = (e.currentTarget as SVGElement).getBoundingClientRect();
		const s = ((e.clientX - r.left) / r.width) * W;
		hoverAt = Math.max(0, Math.min(XMAX, ((s - PAD.l) / (W - PAD.l - PAD.r)) * XMAX));
	}
</script>

<figure class="jc">
	<svg
		{...{ viewBox: `0 0 ${W} ${H}` }}
		role="img"
		aria-label="Jam chance per shot against time since the last jam"
		onpointermove={track}
		onpointerleave={() => (hoverAt = null)}
	>
		<!-- baseline + step ticks, hairline and recessive -->
		<line class="axis" x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} />
		{#each ticks as t (t)}
			<line class="grid" x1={x(t)} y1={PAD.t - 4} x2={x(t)} y2={H - PAD.b} />
			<text class="tick" x={x(t)} y={H - PAD.b + 12} text-anchor="middle">{t}s</text>
		{/each}

		<path class="curve" d={path} />

		{#if hovered}
			{@const c = jamChance(mag, hovered.odds)}
			<line class="cross" x1={x(hoverAt ?? 0)} y1={PAD.t - 4} x2={x(hoverAt ?? 0)} y2={H - PAD.b} />
			<circle class="dot" cx={x(hoverAt ?? 0)} cy={y(c)} r="4" />
		{/if}
	</svg>

	<!-- the plotted values, reachable without hover. The hiding box has to be a
	     plain block: a table cannot be squeezed under its min-content width, so
	     `.sr-only` on the <table> itself left a ~338px box hanging off the page
	     and every phone got a sideways scroll -->
	<div class="sr-only">
		<table>
			<caption>Jam chance per shot by seconds since the last jam</caption>
			<thead>
				<tr><th>Seconds since last jam</th><th>Chance per shot</th></tr>
			</thead>
			<tbody>
				{#each steps as s, i (s.from)}
					<tr>
						<td>{s.from}–{s.to === XMAX ? `${LAST}+` : s.to}</td>
						<td>1 in {n(shotsPerJam(chances[i]))}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<figcaption>
		{#if hovered}
			{@const c = jamChance(mag, hovered.odds)}
			<b>1 in {n(shotsPerJam(c))}</b> shots · {hovered.from === 0 ? 'under' : 'from'}
			{hovered.from === 0 ? steps[0].to : hovered.from}s since your last jam
		{:else}
			Risk per shot, by time since your last jam — hover for a value.
		{/if}
	</figcaption>
</figure>

<style>
	.jc {
		margin: 10px 0 0;
	}
	svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
		touch-action: none;
	}
	.axis,
	.grid {
		stroke: var(--border);
		stroke-width: 1;
	}
	.grid {
		stroke-dasharray: none;
	}
	.curve {
		fill: none;
		stroke: var(--hostile);
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.cross {
		stroke: var(--text-faint);
		stroke-width: 1;
	}
	.dot {
		fill: var(--hostile);
		stroke: var(--surface);
		stroke-width: 2;
	}
	.tick {
		font-family: var(--font-mono);
		font-size: 8px;
		fill: var(--text-faint);
	}
	figcaption {
		margin-top: 4px;
		font-size: 11.5px;
		line-height: 1.45;
		color: var(--text-faint);
		min-height: 2.9em;
	}
	figcaption b {
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}
	/* Hidden in flow, not out of it. `position: absolute` had no positioned
	   ancestor here, so the box anchored to the document instead of the
	   scrolling column and grew the page's scroll area past the shell in both
	   axes — a phantom margin below and to the right of every phone. A 1px box
	   pulled back by its own margin costs no layout and cannot escape. */
	.sr-only {
		position: relative;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
		border: 0;
	}
</style>
