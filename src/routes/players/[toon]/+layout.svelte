<script lang="ts">
	/**
	 * A profile's frame: its bar of tabs, and — on the overview alone — the
	 * identity box.
	 *
	 * The name and the portrait are not repeated here: the shell's own crumb
	 * reads them off `page.data.player`, so they sit in the top bar on every
	 * tab (see the root +layout.svelte). What this holds is the career figures.
	 *
	 * They stand beside the overview and nowhere else, and a narrow screen is
	 * what makes the reason plain. Below 900px the grid folds to one column and
	 * the box leads it — right on the overview, where it is what you came for,
	 * and wrong on every other tab, where it buries the thing you actually
	 * chose under a screenful of totals you did not. Wide, the same column is
	 * merely unearned: a feed, a wall of unlock tiles and an eleven-column
	 * history each want the width more than a restatement of the totals wants
	 * to follow the reader around.
	 */
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { TabBar } from 'sveltekit-commons';

	import { PLAYER_TABS, playerHref, tabSegment } from '$lib/playerTabs';
	import { careerXp, totalWins, camoName, decalName } from '$lib/players';
	import { decals } from '$lib/unlocks';
	import anonPortrait from '$lib/assets/anon-portrait.svg';

	let { data, children } = $props();

	const p = $derived(data.player);
	// num 0 (rank insignia) is everyone's default decal, never bank-stored
	const decalsUnlocked = $derived(new Set([0, ...p.unlocks.decals]));

	const active = $derived(tabSegment(page.route.id) ?? '');
	const onOverview = $derived(active === '');

	const barTabs = $derived(
		PLAYER_TABS.map((t) => ({
			href: playerHref(data.toon, t.segment),
			label: t.label,
			icon: t.icon,
			key: t.segment
		}))
	);

	/* Published so a tab can size itself against what is left of the window —
	   the replay table is the one that does, and the bar's height changes
	   between the wide and the icons-only layout, so it is measured. */
	let tabsH = $state(0);

	function fmtDate(iso: string): string {
		return iso.slice(0, 10);
	}
</script>

<!--
	`shortcuts` is on: this is a reference people browse with a mouse, and
	flipping between someone's ranks, their collection and their games is the
	repeated action here. TabBar's own guard stands down inside an input and
	while any dialog is open, so the command palette keeps its Tab key.
-->
<TabBar
	tabs={barTabs}
	{active}
	bind:height={tabsH}
	label="{p.name} sections"
	shortcuts
	onnavigate={(to) => void goto(to, { noScroll: true })}
/>

<div class="layout" class:full={!onOverview} style="--player-chrome-h: {tabsH}px">
	<div class="main">{@render children()}</div>

	{#if onOverview}
		<aside class="infobox">
			<div class="card box">
				<div class="idhead">
					<img class="portrait-lg" src={data.avatarUrl ?? anonPortrait} alt="" />
					<div class="idtext">
						<div class="idname">
							{#if p.clan}<span class="idclan">&lt;{p.clan}&gt;</span>{/if}{p.name}
						</div>
						{#if data.verified}
							<div>
								<span class="tag t-mos" title="Linked via Battle.net login">
									✓ {data.verified.battletag}
								</span>
								{#if data.verified.isOwner}
									<a class="you" href="/account">you</a>
								{/if}
							</div>
						{/if}
					</div>
				</div>
				<dl class="facts">
					<dt>Battle.net ID</dt>
					<dd class="mono">{p.toon}</dd>
					{#if p.clan}
						<dt>Clan</dt>
						<dd><a href="/clans/{encodeURIComponent(p.clan)}">&lt;{p.clan}&gt;</a></dd>
					{/if}
					<dt>Prestige</dt>
					<dd>{p.prestige}</dd>
					<dt>Career XP</dt>
					<dd>{careerXp(p).toLocaleString('en')}</dd>
					<dt>Games played</dt>
					<dd>{p.gamesPlayed.toLocaleString('en')}</dd>
					<dt>Wins</dt>
					<dd>{totalWins(p).toLocaleString('en')}</dd>
					<dt>Revives</dt>
					<dd>{p.revives.toLocaleString('en')}</dd>
					<dt>Avg game</dt>
					<dd>{p.avgGameTime ? `${Math.round(p.avgGameTime / 60)} min` : '—'}</dd>
					<dt>Camo</dt>
					<dd>{camoName(p.camo)}</dd>
					<dt>Decal</dt>
					<dd>{decalName(p.decal)}</dd>
					<dt>Camos</dt>
					<dd><a href={playerHref(data.toon, 'collection')}>{p.unlocks.camos.length} / 25</a></dd>
					<dt>Decals</dt>
					<dd>
						<a href={playerHref(data.toon, 'collection')}
							>{decalsUnlocked.size} / {decals.length}</a
						>
					</dd>
					<dt>Last seen</dt>
					<dd class="mono">{fmtDate(p.lastSeen)}</dd>
				</dl>

				{#if data.latestFile}
					<a class="dl-latest" href="/replays/{data.latestFile}" download rel="external">
						Download latest replay ⬇
					</a>
				{/if}
			</div>
			<a class="backlink" href="/players">← All players</a>
		</aside>
	{/if}
</div>

<style>
	/* Main column beside its aside. Unlike the page this replaced, there is no
	   third row spanning both: the replay table that used to need one has a tab
	   of its own now, and that tab drops the aside entirely. */
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 290px;
		gap: 0 28px;
		align-items: start;
	}
	/* no aside, no second column — and no gutter left where it was */
	.layout.full {
		grid-template-columns: minmax(0, 1fr);
	}
	.main {
		min-width: 0;
	}

	/* The tabs render into .main, so the frame owns the rhythm above their
	   first heading rather than each tab repeating it: 34px of top margin is
	   spacing between sections, not a gap under the bar. */
	.main :global(h2.section:first-child) {
		margin-top: 4px;
	}

	/* ---------- infobox ---------- */
	.infobox {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.box {
		padding: 8px 0;
	}
	.dl-latest {
		display: block;
		margin: 10px 14px 0;
		padding: 7px 12px;
		border-radius: var(--radius-2);
		background: var(--accent);
		color: var(--accent-contrast);
		font-weight: 650;
		font-size: 12px;
		text-align: center;
		text-decoration: none;
	}
	.dl-latest:hover {
		background: var(--accent-dim);
	}
	.idhead {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 6px var(--card-pad-x) 4px;
	}
	.portrait-lg {
		width: 56px;
		height: 56px;
		border-radius: var(--radius-2);
		object-fit: cover;
		border: 1px solid var(--border-strong);
		flex-shrink: 0;
	}
	.idtext {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}
	.idname {
		font-size: 15px;
		font-weight: 650;
		letter-spacing: -0.01em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.idclan {
		color: var(--text-faint);
		font-size: 13px;
		font-weight: 500;
		margin-right: 5px;
	}
	.facts {
		margin: 8px 0 0;
		padding: 0 var(--card-pad-x);
	}
	.facts dt {
		float: left;
		clear: left;
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text-faint);
		line-height: 2.1;
	}
	.facts dd {
		margin: 0;
		text-align: right;
		font-variant-numeric: tabular-nums;
		font-size: 13px;
		font-weight: 550;
		line-height: 2.1;
		border-bottom: 1px solid var(--border);
	}
	.facts dd:last-of-type {
		border-bottom: none;
	}
	.idhead .you {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--accent);
		text-decoration: none;
		margin-left: 4px;
	}
	.idhead .you:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.backlink {
		font-size: 12.5px;
	}

	@media (max-width: 900px) {
		.layout {
			grid-template-columns: 1fr;
		}
		/* stacked, the profile card leads: it is what you came to see, and it
		   should not sit under a screenful of rank cards */
		.infobox {
			order: -1;
			margin: 0 0 18px;
		}
	}
</style>
