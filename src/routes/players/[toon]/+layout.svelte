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
	import { goto, preloadData } from '$app/navigation';
	import { page } from '$app/state';
	import { Page, TabBar, TabSwipe } from 'sveltekit-commons';

	import { PLAYER_TABS, playerHref, tabSegment } from '$lib/playerTabs';
	import { careerXp, totalWins, camoName, decalName, fmtPlaytime } from '$lib/players';
	import { decals } from '$lib/unlocks';
	import { BAN_EFFECT, banKind } from '$lib/banned';
	import anonPortrait from '$lib/assets/anon-portrait.svg';
	import { portraitFallback } from '$lib/portrait';

	let { data, children } = $props();

	const p = $derived(data.player);
	/* Every tab, not just the overview: the figures this qualifies are spread
	   across all four of them, and a visitor who arrives on the collection
	   should not have to find the overview to learn the boards left this
	   profile out. */
	const ban = $derived(banKind(data.toon));
	// num 0 (rank insignia) is everyone's default decal, never bank-stored
	const decalsUnlocked = $derived(new Set([0, ...p.unlocks.decals]));
	/* The games behind "time on record" — the ingested ones, which is why the
	   figure carries a count of its own beside the map's career total. */
	const recordedGames = $derived(
		`${data.historyCount.toLocaleString('en')} ${data.historyCount === 1 ? 'game' : 'games'}`
	);

	const active = $derived(tabSegment(page.route.id) ?? '');
	const onOverview = $derived(active === '');

	/* Who owns the scroller, and why it is decided here.
	   Every tab but the overview is the whole of its column, so the tab itself
	   is the page and brings its own — Replays wants a table that keeps its head
	   still and scrolls only its rows, which is a different shape entirely and
	   not one this frame should impose. The overview is the exception because
	   the frame is composing it: the infobox below is this file's markup sitting
	   in a grid beside the tab's, and the two have to scroll as one thing. */
	const framesOverview = $derived(onOverview);

	const barTabs = $derived(
		PLAYER_TABS.map((t) => ({
			href: playerHref(data.toon, t.segment),
			label: t.label,
			icon: t.icon,
			key: t.segment
		}))
	);

	function fmtDate(iso: string): string {
		return iso.slice(0, 10);
	}
</script>

<!--
	The same move by hand, for the screen the shortcuts cannot reach. It takes
	only the drags nothing else wants: the shell's rail keeps the drag that opens
	the drawer, and the replay table keeps every sideways drag it can still spend
	— run it to its last column and the next pull that way changes tab.

	`middle` is on, so the desktop has the move too: hold the middle button and
	push sideways. Horizontal scroll does it as well, on any wheel, and neither
	needs a narrow screen. The cost of `middle` is the browser's autoscroll, and
	it is worth paying here — this is a reference people read down a list on,
	not a page anyone drives by the scroll anchor.
-->
<TabSwipe
	tabs={barTabs}
	{active}
	onnavigate={(to) => void goto(to, { noScroll: true })}
	preload={preloadData}
	middle
/>

<!--
	`shortcuts` is on: this is a reference people browse with a mouse, and
	flipping between someone's ranks, their collection and their games is the
	repeated action here. TabBar's own guard stands down inside an input and
	while any dialog is open, so the command palette keeps its Tab key.

	`docked`, and a sibling of the page rather than the first thing inside it:
	AppShell's `main` is a flex column that scrolls nothing, so the bar takes its
	own height here and the page below takes the rest. That is what keeps the
	scrollbar underneath the bar instead of running up alongside it, and the bar
	reaching the same edge the top bar does.
-->
<TabBar
	docked
	tabs={barTabs}
	{active}
	label="{p.name} sections"
	shortcuts
	gestures="both"
	onnavigate={(to) => void goto(to, { noScroll: true })}
/>

<!--
	A sibling of the page rather than something inside it, for the same reason
	the tab bar is: it belongs to the profile, not to whichever tab is open, and
	from here it stays put while the tab under it scrolls. It carries the page's
	own gutters by hand, since it is outside the box that supplies them.
-->
{#if ban}
	<aside class="banned">
		<strong>Banned by the map.</strong>
		This account is on Undead Assault Reborn's own ban list, which {BAN_EFFECT[ban]} every
		time it plays. Its figures are shown here, but left off every board.
	</aside>
{/if}

{#if framesOverview}
	<Page>
		<div class="layout">
			<div class="main">{@render children()}</div>
			{@render infobox()}
		</div>
	</Page>
{:else}
	{@render children()}
{/if}

{#snippet infobox()}
	{#if onOverview}
		<aside class="infobox">
			<div class="card box">
				<div class="idhead">
					<img
						class="portrait-lg"
						src={data.avatarUrl ?? anonPortrait}
						alt=""
						use:portraitFallback={anonPortrait}
					/>
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
					{#if p.playSeconds !== undefined}
						<!--
							Recorded time, and it says so: `gamesPlayed` above is the map's own
							career count, while this is summed over the games somebody uploaded
							— each for as long as this player was in it — so it is small beside
							a long career and grows only as the archive does. The count is what
							keeps the two figures from being read as one.
						-->
						<dt>Time on record</dt>
						<dd
							title="{fmtPlaytime(p.playSeconds)} across the {recordedGames} on record — this player's own time in each, not the game's length."
						>
							{fmtPlaytime(p.playSeconds)}
							<span class="qual">in {recordedGames}</span>
						</dd>
					{/if}
					<dt>Wins</dt>
					<dd>{totalWins(p).toLocaleString('en')}</dd>
					<dt>Revives</dt>
					<dd>{p.revives.toLocaleString('en')}</dd>
					<!-- the map's figure, shown as the map shows it — see PlayerProfile.avgGameTime -->
					<dt>Avg game</dt>
					<dd
						title="The map's own figure: a running average of game length that the map updates only when a game is lost — wins do not move it."
					>
						{p.avgGameTime ? `${Math.round(p.avgGameTime / 60)} min` : '—'}
					</dd>
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
{/snippet}

<style>
	/* Outside Page, so the gutters are declared rather than inherited — the same
	   --content-pad-x it uses, which keeps the banner's edges flush with the
	   text under it at every width. --danger is the site's red, and the same one
	   --hostile paints the undead in: a ban is the strongest thing a profile can
	   say about itself, and it should not read as a caution. */
	.banned {
		margin: 12px var(--content-pad-x, 36px) 0;
		padding: 9px 13px;
		border: 1px solid var(--danger);
		border-radius: var(--radius-2);
		background: color-mix(in srgb, var(--danger) 9%, transparent);
		color: var(--text);
		font-size: 12.5px;
		line-height: 1.5;
	}
	.banned strong {
		color: var(--danger);
	}

	/* Main column beside its aside. Unlike the page this replaced, there is no
	   third row spanning both: the replay table that used to need one has a tab
	   of its own now, and that tab drops the aside entirely.

	   Only the overview reaches here — every other tab is the whole column and
	   renders itself, so there is no one-column variant of this grid any more. */
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 290px;
		gap: 0 28px;
		align-items: start;
	}
	.main {
		min-width: 0;
	}

	/* The tabs render into .main, so the frame owns the rhythm above their
	   first heading rather than each tab repeating it: --section-gap of top
	   margin is spacing between sections, not a gap under the bar.

	   A direct child, and that matters. As a descendant selector this read
	   "any heading that leads its container" rather than "the first heading on
	   the page", so every section on the overview that wraps its own heading —
	   Wins by mode, Played with, Classes played — was quietly led in at 4px too
	   and butted straight up against the block above it. Only the page's own
	   first heading is not between two sections; the rest have earned the gap. */
	.main > :global(h2.section:first-child) {
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
	/* the qualifier on a figure that needs one — set like the labels, so it
	   reads as a caption on the number and not as a second number */
	.facts .qual {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.06em;
		color: var(--text-faint);
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
