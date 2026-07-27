<script lang="ts">
	import type { ReplayMeta } from '$lib/players';
	import { fmtDuration } from '$lib/outcome';
	import OutcomeMark from './OutcomeMark.svelte';

	let { games }: { games: ReplayMeta[] } = $props();

	// SSR renders the server's timezone (UTC on Fly), hydration re-renders in
	// the viewer's — the same trade the activity chart makes, and the reason
	// the rows are derived rather than computed once
	const fmtWhen = new Intl.DateTimeFormat('en', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	});

	const rows = $derived(
		games.map((g) => ({
			id: g.file.replace(/\.SC2Replay$/, ''),
			when: fmtWhen.format(new Date(g.playedAt)),
			players: g.players,
			duration: g.durationLoops ? fmtDuration(g.durationLoops) : '',
			outcome: g.outcome
		}))
	);
</script>

<section class="card games">
	<div class="g-label">Last games</div>
	<ol>
		{#each rows as g (g.id)}
			<li>
				<a href="/replays/{g.id}" class={g.outcome ?? 'unsettled'}>
					<span class="g-when">
						{g.when}
						<OutcomeMark outcome={g.outcome} />
					</span>
					<span class="g-meta">
						<!-- the separator is an expression: markup whitespace at the
						     edge of a block is trimmed away, and the dot would end up
						     glued to the word before it -->
						{g.players} profile{g.players === 1 ? '' : 's'}{#if g.duration}{' · '}<span
								class="g-dur">{g.duration}</span
							>{/if}
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
	   mark still reads on top of it. */
	ol a {
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding: 6px 9px;
		margin: 0 -9px;
		border-radius: var(--r-sm);
		text-decoration: none;
		background: var(--surface-2);
		transition: background 120ms ease;
	}
	ol a.win {
		background: color-mix(in srgb, var(--accent) 9%, transparent);
	}
	ol a.loss {
		background: color-mix(in srgb, var(--hostile) 9%, transparent);
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
	.g-when {
		display: flex;
		align-items: center;
		gap: 6px;
		font-family: var(--mono);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		font-weight: 550;
		color: var(--ink);
	}
	.g-meta {
		font-size: 11px;
		color: var(--ink-3);
	}
	.g-dur {
		font-family: var(--mono);
		font-variant-numeric: tabular-nums;
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
