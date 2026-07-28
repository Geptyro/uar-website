<script lang="ts">
	import type { ReplayMeta } from '$lib/players';
	import { fmtDuration } from '$lib/outcome';
	import ModeMark from './ModeMark.svelte';
	import ModifierMark from './ModifierMark.svelte';
	import { orderModifiers } from '$lib/modifiers';
	import { timeAgo } from '$lib/timeago';

	let { games }: { games: ReplayMeta[] } = $props();

	// SSR renders the server's timezone (UTC on Fly) and the server's clock,
	// hydration re-renders in the viewer's — the same trade the activity chart
	// makes, and the reason the rows are derived rather than computed once.
	const fmtWhen = new Intl.DateTimeFormat('en', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	});
	// how long ago is what the widget is for — this is the games you might
	// still be in the middle of an evening of. The date is not lost: it is the
	// row's title, and every game's own page leads with it.
	const now = Date.now();

	const rows = $derived(
		games.map((g) => ({
			id: g.file.replace(/\.SC2Replay$/, ''),
			when: timeAgo(g.playedAt, now) ?? fmtWhen.format(new Date(g.playedAt)),
			exact: fmtWhen.format(new Date(g.playedAt)),
			players: g.players,
			duration: g.durationLoops ? fmtDuration(g.durationLoops) : '',
			outcome: g.outcome,
			mode: g.mode,
			mods: orderModifiers(g.modifiers ?? [])
		}))
	);
</script>

<section class="card games">
	<div class="g-label">Last games</div>
	<ol>
		{#each rows as g (g.id)}
			<li>
				<a href="/replays/{g.id}" class={g.outcome ?? 'unsettled'}>
					<span class="g-line">
						<span class="g-when" title={g.exact}>{g.when}</span>
						{#if g.duration}<span class="g-dur">{g.duration}</span>{/if}
					</span>
					<span class="g-line">
						<span class="g-meta">
							{#if g.mode}<ModeMark mode={g.mode} />{/if}{#each g.mods as id (id)}<ModifierMark
									{id}
									iconOnly
									focusable={false}
								/>{/each}
						</span>
						<span
							class="g-players"
							title="{g.players} player profile{g.players === 1 ? '' : 's'} in this game"
						>
							<svg viewBox="0 0 16 16" aria-hidden="true">
								<circle cx="8" cy="5.2" r="2.8" />
								<path d="M2.9 13.6a5.1 5.1 0 0 1 10.2 0" />
							</svg>
							{g.players}
						</span>
					</span>
				</a>
			</li>
		{/each}
	</ol>
	<a class="g-all" href="/replays">All replays →</a>
</section>

<style>
	.g-label {
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--ink-3);
		margin-bottom: 3px;
	}
	ol {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	/* the whole row is the link, so the click target is the row and not just
	   the timestamp — and the row is the result: won green, lost red, and a
	   plain band while the game is unsettled, so a row never looks broken.
	   The tint bleeds into the card's padding to read as a band rather than a
	   floating chip, and stays well under the ✓/✕ mark's own soft fill so the
	   mark still reads on top of it. On top of the tint the row carries a bar
	   down its leading edge in its own colour, which is what makes the run of
	   results readable at a glance; the bar eats 4px of the left padding so an
	   unsettled row — transparent bar — keeps the exact same box. */
	ol a {
		display: flex;
		flex-direction: column;
		/* the two lines each hug their content now (line-height: 1), so the gap
		   is the only thing holding them apart — 1px was the leading doing it */
		gap: 8px;
		padding: 8px 9px 8px 10px;
		margin: 0 -9px;
		border-left: 4px solid transparent;
		border-radius: var(--r-sm);
		text-decoration: none;
		background: var(--surface-2);
		transition:
			background 120ms ease,
			border-color 120ms ease;
	}
	ol a.win {
		background: color-mix(in srgb, var(--accent) 9%, transparent);
		border-color: var(--accent);
	}
	ol a.loss {
		background: color-mix(in srgb, var(--hostile) 9%, transparent);
		border-color: var(--hostile);
	}
	/* hover deepens the row's own colour — the timestamp must not go accent
	   green on a game that was lost */
	ol a.win:hover {
		background: color-mix(in srgb, var(--accent) 18%, transparent);
	}
	ol a.loss:hover {
		background: color-mix(in srgb, var(--hostile) 18%, transparent);
	}
	ol a.unsettled:hover {
		background: var(--border);
	}
	/* Two lines, each a subject on the left and a figure on the right: the date
	   and how long it ran, then what was played and how many played it. The
	   figures sit on the card's right edge, so they read down the widget as
	   their own column instead of landing wherever the sentence before them
	   happened to end. */
	.g-line {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		min-width: 0;
	}
	.g-when {
		line-height: 1;
		font-family: var(--mono);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		font-weight: 550;
		color: var(--ink);
	}
	/* a flex row, so the mode mark and the modifier chips sit on one centre
	   line — as inline boxes they aligned on their own baselines, and a chip
	   with a border does not share a baseline with plain coloured text */
	.g-meta {
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
		font-size: 11px;
		/* both sides of the line hug their content rather than an inherited
		   1.5 line box: a glyph is shorter than the text box around it, so with
		   leading left in, each side centres on a different point and the two
		   read as off by a pixel or two even though the boxes are centred */
		line-height: 1;
		color: var(--ink-3);
	}
	.g-dur {
		flex: none;
		font-family: var(--mono);
		font-size: 11.5px;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		color: var(--ink-3);
	}
	/* the glyph carries the word, so the count reads as a figure rather than
	   "11 profiles" spelled out down every row */
	.g-players {
		display: flex;
		align-items: center;
		gap: 3px;
		flex: none;
		font-size: 11px;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		color: var(--ink-3);
	}
	.g-players svg {
		width: 11px;
		height: 11px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
	}
	/* the way out sits at the foot on its own rule, as it does on What's new */
	.g-all {
		display: block;
		margin-top: 9px;
		padding-top: 9px;
		border-top: 1px solid var(--border);
		font-size: 12px;
		color: var(--accent);
		text-decoration: none;
		white-space: nowrap;
	}
	.g-all:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
</style>
