<script lang="ts">
	/**
	 * Every game this player appears in, newest first.
	 *
	 * The table takes the window, the way /players and /replays do: the header
	 * and the pager stay put and only the rows move. It could not do that at the
	 * foot of the old single-page profile — it was capped at 62vh there so a
	 * full page of rows would not push the rest of the profile out of reach —
	 * and having a tab of its own is what lifts that cap.
	 */
	import { mosById } from '$lib/mos';
	import type { Sighting } from '$lib/players';
	import Pager from '$lib/components/Pager.svelte';
	import OutcomeMark from '$lib/components/OutcomeMark.svelte';
	import ModeMark from '$lib/components/ModeMark.svelte';
	import ModifierMark from '$lib/components/ModifierMark.svelte';
	import { orderModifiers } from '$lib/modifiers';
	import Seo from '$lib/components/Seo.svelte';
	import { fmtDuration } from '$lib/outcome';
	import { Page } from 'sveltekit-commons';

	let { data } = $props();

	const p = $derived(data.player);

	// A long-standing player has hundreds of games, so the server sends one
	// page of history rather than all of it. What arrives is still oldest
	// first (that ordering is what makes the per-row deltas work) and is read
	// newest first: rows descend from the end of the slice. `historyRows`
	// excludes the extra newer sighting the slice carries so that the top row
	// still has a next game to diff against.
	const shownHistory = $derived.by(() =>
		Array.from({ length: data.historyRows }, (_, i) => data.historyRows - 1 - i)
	);

	// Sighting values are the save-file state at game start, so the progress
	// earned in game i only shows up in sighting i+1 — attribute it back to row i.
	function delta(h: Sighting[], i: number, key: keyof Sighting): number | null {
		if (i >= h.length - 1) return null;
		const d = (h[i + 1][key] as number) - (h[i][key] as number);
		return d > 0 ? d : null;
	}

	/** Games played between sighting i and the next one; >1 means the delta spans non-ingested games. */
	function gamesSpanned(h: Sighting[], i: number): number {
		if (i >= h.length - 1) return 0;
		return h[i + 1].gamesPlayed - h[i].gamesPlayed;
	}

	function fmtDate(iso: string): string {
		return iso.slice(0, 10);
	}
</script>

<Page fill>
	<Seo
		title="{p.name} — Replays"
		description="Every ingested Undead Assault Reborn game {p.name} appears in, with the XP, wins and revives each one earned."
	/>

	<div class="datapage">
		<div class="dtools">
			<Pager
				page={data.historyPage}
				pages={data.historyPages}
				total={data.historyTotal}
				label="replays"
				param="h"
				shortcuts
			/>
		</div>

		<div class="tablewrap rows">
			<table class="data">
				<thead>
					<tr>
						<th>Game date</th>
						<th title="Won, lost, or not known yet">Result</th>
						<th title="The mode the lobby voted at the start of the game">Mode</th>
						<th title="Modifiers the lobby voted on top of the mode">Modifiers</th>
						<th class="num">Length</th>
						<th>Class</th>
						<th class="num">Enlisted</th>
						<th class="num">Warrant</th>
						<th class="num">Commissioned</th>
						<th class="num">Games</th>
						<th class="num">Wins</th>
						<th class="num">Revives</th>
					</tr>
				</thead>
				<tbody>
					{#each shownHistory as i (data.history[i].file)}
						{@const h = data.history[i]}
						{@const span = gamesSpanned(data.history, i)}
						{#if span > 1}
							<tr class="gap">
								<td
									class="gapinfo"
									colspan="6"
									title="only the game below is a recorded replay; the rest weren't"
								>
									⋯ over {span} games
								</td>
								{#each ['xpEn', 'xpWo', 'xpCo', 'gamesPlayed', 'wins', 'revives'] as const as key (key)}
									{@const d = delta(data.history, i, key)}
									<td class="num">
										{#if d}<span class="delta">+{d.toLocaleString('en')}</span>{/if}
									</td>
								{/each}
							</tr>
						{/if}
						{@const facts = data.replayFacts[h.file]}
						<tr>
							<td class="mono">
								<a href="/replays/{h.file.replace(/\.SC2Replay$/, '')}" title="View replay"
									>{fmtDate(facts?.startedAt ?? h.playedAt)}</a
								>
							</td>
							<td class="histresult">
								{#if facts?.outcome}<OutcomeMark outcome={facts.outcome} />{:else}<span
										class="unknown"
										title="Not known yet — this game's recording stopped early and no later game has been uploaded"
										>·</span
									>{/if}
							</td>
							<td class="histmode">
								{#if facts?.mode}<ModeMark mode={facts.mode} />{:else}<span
										class="unknown"
										title="Not known yet — this game was lost, or its recording stopped before the vote closed"
										>·</span
									>{/if}
							</td>
							<td class="histmods">
								{#each orderModifiers(facts?.modifiers ?? []) as id (id)}<ModifierMark
										{id}
										iconOnly
									/>{:else}<span class="none">·</span>{/each}
							</td>
							<td class="num mono">{facts ? fmtDuration(facts.gameLoops) : ''}</td>
							<td class="histclass" style="--figs: {h.mos.length}">
								<span class="histfigs">
									{#each h.mos as id (id)}
										{@const chip = mosById.get(id)}
										{#if chip?.icon}
											<img
												class="histfig"
												src={chip.icon}
												alt={chip.name}
												title={chip.name}
												loading="lazy"
											/>
										{:else}
											<span class="histfig placeholder" title={chip?.name ?? id}></span>
										{/if}
									{/each}
								</span>
							</td>
							{#each ['xpEn', 'xpWo', 'xpCo', 'gamesPlayed', 'wins', 'revives'] as const as key (key)}
								{@const d = span === 1 ? delta(data.history, i, key) : null}
								<td class="num">
									{(h[key] as number).toLocaleString('en')}
									{#if d}<span class="delta" title="earned in this game"
											>+{d.toLocaleString('en')}</span
										>{/if}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</Page>

<style>
	/* No height override here any more. `<Page fill>` is the box the shell left
	   after the tab bar took its height, and `.datapage` claims what is in it —
	   so there is nothing to work out. What stood here was that sum written by
	   hand: the viewport, less the top bar, less the tabs, less the column's
	   padding, plus a --border-width term for the one pixel `clientHeight` does
	   not count. */

	/* ---------- class pictures in the rows ----------
	   The picture is drawn to the row, so it is taken out of flow — a
	   percentage height then resolves against the cell, which is the row, and
	   the row keeps the height its text gives it. A game with a re-pick carries
	   more than one picture, so the strip is a flex line and the cell hands
	   back exactly the width its own pictures need. */
	.rows table {
		--fig: 34px;
		--fig-x: 12px;
	}
	.histclass {
		position: relative;
		padding-left: calc(var(--fig-x) + var(--figs, 1) * var(--fig) + (var(--figs, 1) - 1) * 3px);
	}
	.histfigs {
		position: absolute;
		left: var(--fig-x);
		top: 0;
		height: 100%;
		display: flex;
		gap: 3px;
	}
	.histfig {
		height: 100%;
		width: var(--fig);
		object-fit: cover;
		border-radius: 3px;
	}
	.histfig.placeholder {
		background: var(--surface-raised);
	}
	.histresult {
		width: 1%;
		white-space: nowrap;
	}
	.histresult .unknown {
		color: var(--text-faint);
		cursor: help;
	}
	/* Two columns rather than one cell holding both: the modifiers vary in
	   number row to row, and behind them the mode would start at a different x
	   on every line. Split, each reads down its own edge. */
	.histmode,
	.histmods {
		width: 1%;
		white-space: nowrap;
	}
	.histmods {
		display: table-cell;
		line-height: 1;
	}
	.histmods :global(.tt) + :global(.tt) {
		margin-left: 3px;
	}
	.histmode .unknown,
	.histmods .none {
		color: var(--text-faint);
	}
	.histmode .unknown {
		cursor: help;
	}

	.delta {
		color: var(--accent);
		font-size: 10.5px;
		margin-left: 4px;
	}
	tr.gap td {
		padding-top: 3px;
		padding-bottom: 3px;
		background: var(--surface);
	}
	.gapinfo {
		font: 500 10.5px/1.6 var(--font-mono);
		color: var(--text-faint);
		white-space: nowrap;
	}

	@media (max-width: 899.98px) {
		/* follows the cell's own inset in, as the boards' pictures do */
		.rows table {
			--fig: 30px;
			--fig-x: 9px;
		}
	}
</style>
