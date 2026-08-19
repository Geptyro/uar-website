<script lang="ts">
	/**
	 * Who plays a class: how many, how much, how it goes, and who most of all.
	 *
	 * Everything here is read off the class's stored board — the totals, the
	 * modes, the top twenty-five by time and the last games it was seen in —
	 * so the page costs one small read. What the figures mean, and what they
	 * do not, is written under them: recorded time is time in uploaded games,
	 * and a class's win rate is how often a game with one of these in it was
	 * won, not who carried it.
	 */
	import { Page } from 'sveltekit-commons';
	import { timeAgo } from 'sveltekit-commons/time';
	import { fmtPlaytime } from '$lib/players';
	import { mosById, mosHref } from '$lib/mos';
	import { weekOf } from '$lib/weeks';
	import anonPortrait from '$lib/assets/anon-portrait.svg';
	import { portraitFallback } from '$lib/portrait';
	import ModeMark from '$lib/components/ModeMark.svelte';
	import OutcomeMark from '$lib/components/OutcomeMark.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { mosCardUrl } from '$lib/seo';

	let { data } = $props();

	const mos = $derived(data.mos);
	const board = $derived(data.board);
	const rows = $derived(board?.rows ?? []);
	const stats = $derived(board?.stats ?? null);
	const recent = $derived(board?.recent ?? []);
	const week = $derived(data.week);
	const avatar = (toon: string) => data.avatars[toon] ?? null;

	// SSR renders the server's clock, hydration re-renders in the viewer's — the
	// same trade the front page's game list makes
	const now = Date.now();

	/* The last 26 weeks, every one of them — a week the class was not seen in
	   is a zero bar, not a missing one, or a quiet month would read as busy. */
	const WEEKS = 26;
	const weekly = $derived.by(() => {
		const have = new Map((board?.weekly ?? []).map((w) => [w.week, w]));
		const out: { week: string; games: number; wins: number; losses: number }[] = [];
		const cursor = new Date(weekOf(new Date(now).toISOString()));
		for (let i = 0; i < WEEKS; i++) {
			const week = cursor.toISOString().slice(0, 10);
			out.unshift(have.get(week) ?? { week, games: 0, wins: 0, losses: 0 });
			cursor.setUTCDate(cursor.getUTCDate() - 7);
		}
		return out;
	});
	const weeklyMax = $derived(Math.max(1, ...weekly.map((w) => w.games)));
	const weeklyTotal = $derived(weekly.reduce((n, w) => n + w.games, 0));
	const fmtWeek = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });

	const alongside = $derived(
		(board?.alongside ?? [])
			.map((a) => ({ ...a, info: mosById.get(a.mos) ?? null }))
			.filter((a) => a.info)
	);

	/* A board stored before the totals existed has rows without outcomes or
	   dates — the columns for them come off rather than standing empty. The
	   week's rows always have them, and both tables share one layout, so the
	   columns show as soon as either side can fill them. */
	const rowsDetailed = $derived(
		rows.some((r) => r.lastAt !== undefined) || (week?.rows ?? []).some((r) => r.lastAt !== undefined)
	);

	const settled = $derived(stats ? stats.wins + stats.losses : 0);
	const winRate = $derived(settled ? Math.round((100 * (stats?.wins ?? 0)) / settled) : null);
	// the same figure per player, where they have any settled game on the class
	const rateOf = (r: { wins?: number; losses?: number }) => {
		const n = (r.wins ?? 0) + (r.losses ?? 0);
		return n ? Math.round((100 * (r.wins ?? 0)) / n) : null;
	};

	const fmtWhen = new Intl.DateTimeFormat('en', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	});
	const fmtDay = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });
	const fmtMonth = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' });
	const ago = (iso: string) => timeAgo(iso, now) ?? fmtWhen.format(new Date(iso));
	/** the board's column is narrow: recent as "3d ago", this year as "Jun 21",
	 *  older as "Oct 2025" — the exact moment is the cell's tooltip */
	const agoOrDay = (iso: string) => {
		const rel = timeAgo(iso, now);
		if (rel) return rel;
		const d = new Date(iso);
		return d.getFullYear() === new Date(now).getFullYear() ? fmtDay.format(d) : fmtMonth.format(d);
	};

	/* Which column each block goes in: the all-time board with the trend, the
	   co-picked classes and the last games under it; the week and the modes
	   beside them. Blocks with nothing to show are skipped by the snippet. */
	const layout = {
		left: ['alltime', 'weekly', 'alongside', 'recent'],
		right: ['week', 'mode']
	};

	const description = $derived(
		stats
			? `${stats.players.toLocaleString('en')} players recorded on the ${mos.name} across ${stats.games.toLocaleString('en')} games in Undead Assault Reborn — who plays it most, how it goes by mode, and its last games.`
			: `Who plays the ${mos.name} in Undead Assault Reborn: the players with the most recorded time on it, from uploaded replays.`
	);
</script>

{#snippet tiles_(t: NonNullable<typeof stats>, small: boolean)}
	{@const settledN = t.wins + t.losses}
	<div class="tiles" class:small>
		<div class="tile">
			<b>{t.players.toLocaleString('en')}</b>
			<span>{t.players === 1 ? 'player' : 'players'}</span>
		</div>
		<div class="tile">
			<b>{t.games.toLocaleString('en')}</b>
			<span>{t.games === 1 ? 'game' : 'games'}</span>
		</div>
		<div class="tile" title="Game time with at least one {mos.name} in play, across recorded games">
			<b>{fmtPlaytime(t.seconds)}</b>
			<span>in play</span>
		</div>
		<div
			class="tile"
			title={settledN
				? `${t.wins.toLocaleString('en')} won, ${t.losses.toLocaleString('en')} lost, of the ${settledN.toLocaleString('en')} games with a settled result`
				: 'No game with this class has a settled result yet'}
		>
			<b>{settledN ? `${Math.round((100 * t.wins) / settledN)}%` : '—'}</b>
			<span>games won</span>
		</div>
		{#if t.games}
			<div class="tile" title="Average length of a recorded game with this class in it">
				<b>{fmtPlaytime(t.seconds / t.games)}</b>
				<span>avg game</span>
			</div>
		{/if}
	</div>
{/snippet}

{#snippet board_(list: typeof rows)}
	<!-- One layout for both boards — the all-time one and the week's — so a
	     reader's eye lands on the same column either side. -->
	<div class="tablewrap">
		<table class="data board toplist">
			<thead>
				<tr>
					<th class="pos">#</th>
					<th>Player</th>
					<th class="num">Time</th>
					<th class="num">Games</th>
					{#if rowsDetailed}
						<th class="num" title="Won – lost, of their games on this class with a settled result"
							>W – L</th
						>
						<th class="num when">Last</th>
					{/if}
					<th class="barcell"></th>
				</tr>
			</thead>
			<tbody>
				{#each list as p, i (p.toon || p.name)}
					<tr>
						<td class="pos">{i + 1}</td>
						<td class="figcell">
							<img
								class="figimg"
								src={(p.toon && avatar(p.toon)) || anonPortrait}
								alt=""
								loading="lazy"
								use:portraitFallback={anonPortrait}
							/>
							{#if p.clan}<span class="pclan">&lt;{p.clan}&gt;</span>{/if}
							{#if p.toon}
								<a class="pname" href="/players/{p.toon}">{p.name}</a>
							{:else}
								<span class="pname">{p.name}</span>
							{/if}
						</td>
						<td class="num">{fmtPlaytime(p.seconds)}</td>
						<td class="num">{p.games.toLocaleString('en')}</td>
						{#if rowsDetailed}
							<td class="num wl">
								{#if p.wins !== undefined && p.losses !== undefined && p.wins + p.losses > 0}
									<span class="w">{p.wins}</span> – <span class="l">{p.losses}</span>
									{#if rateOf(p) !== null}<span class="rate">{rateOf(p)}%</span>{/if}
								{:else}
									<span class="none">—</span>
								{/if}
							</td>
							<td class="num when" title={p.lastAt ? fmtWhen.format(new Date(p.lastAt)) : ''}>
								{p.lastAt ? agoOrDay(p.lastAt) : ''}
							</td>
						{/if}
						<td class="barcell">
							{#if p.seconds > 0 && list[0].seconds > 0}
								<div class="boardbar" style="width: {(100 * p.seconds) / list[0].seconds}%"></div>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/snippet}

{#snippet widget(key: string)}
	{#if key === 'alltime'}
		<!-- The two columns open the same way — heading, the totals, the board
		     — so all-time and the week read as one figure beside another. -->
		<section>
			<h2 class="section">All time</h2>
			{#if stats}{@render tiles_(stats, true)}{/if}
			{@render board_(rows)}
		</section>
	{:else if key === 'week'}
		<!-- The window slides, so this is read live over the last seven days
		     rather than off the stored board — see getMosWeek. -->
		<section>
			<h2 class="section">Last 7 days</h2>
			{#if week && week.stats.games}
				{@render tiles_(week.stats, true)}
				{@render board_(week.rows)}
			{:else}
				<p class="note fine">No recorded game with a {mos.name} in it in the last seven days.</p>
			{/if}
		</section>
	{:else if key === 'mode'}
		{#if stats?.byMode.length}
			<section>
				<h2 class="section">By mode</h2>
				<div class="tablewrap">
					<table class="data board modes">
						<thead>
							<tr>
								<th>Mode</th>
								<th class="num">Games</th>
								<th class="num" title="Of those with a settled result">Won</th>
								<th class="barcell"></th>
							</tr>
						</thead>
						<tbody>
							{#each stats.byMode as m (m.mode)}
								<tr>
									<td><ModeMark mode={m.mode} /></td>
									<td class="num">{m.games.toLocaleString('en')}</td>
									<td class="num">
										{#if m.wins + m.losses}
											{Math.round((100 * m.wins) / (m.wins + m.losses))}%
											<span class="of">/ {m.wins + m.losses}</span>
										{:else}
											<span class="none">—</span>
										{/if}
									</td>
									<td class="barcell">
										<div
											class="boardbar"
											style="width: {(100 * m.games) / stats.byMode[0].games}%; --bar: var(--mode-{m.mode})"
										></div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</section>
		{/if}
	{:else if key === 'weekly'}
		{#if board?.weekly?.length}
			<section>
				<h2 class="section">Games per week</h2>
				<div class="weeks card" role="img" aria-label="Games with this class in them per week, last {WEEKS} weeks">
					<div class="bars">
						{#each weekly as w (w.week)}
							<div
								class="bar"
								style="height: {(100 * w.games) / weeklyMax}%"
								title="Week of {fmtWeek.format(new Date(w.week))}: {w.games} {w.games === 1 ? 'game' : 'games'}{w.wins + w.losses ? `, ${w.wins} won` : ''}"
							></div>
						{/each}
					</div>
					<div class="axis">
						<span>{fmtWeek.format(new Date(weekly[0].week))}</span>
						<span>{weeklyTotal.toLocaleString('en')} in {WEEKS} weeks</span>
						<span>this week</span>
					</div>
				</div>
			</section>
		{/if}
	{:else if key === 'alongside'}
		{#if alongside.length}
			<section>
				<h2 class="section">Seen alongside</h2>
				<div class="tablewrap">
					<table class="data board along">
						<thead>
							<tr>
								<th>Class</th>
								<th class="num" title="Recorded games with both classes in them">Games</th>
								<th class="num" title="Share of this class's games">Share</th>
								<th class="barcell"></th>
							</tr>
						</thead>
						<tbody>
							{#each alongside as a (a.mos)}
								<tr>
									<td class="figcell">
										{#if a.info?.icon}<img class="figimg" src={a.info.icon} alt="" loading="lazy" />{/if}
										<a class="pname" href={mosHref(a.mos)}>{a.info?.name}</a>
									</td>
									<td class="num">{a.games.toLocaleString('en')}</td>
									<td class="num">{stats?.games ? Math.round((100 * a.games) / stats.games) : '—'}%</td>
									<td class="barcell">
										<div class="boardbar" style="width: {(100 * a.games) / alongside[0].games}%"></div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</section>
		{/if}
	{:else if key === 'recent'}
		{#if recent.length}
			<section>
				<h2 class="section">Last seen in</h2>
				<ol class="recent">
					{#each recent as g (g.file)}
						<li>
							<a href="/replays/{g.file.replace(/\.SC2Replay$/, '')}" class={g.outcome ?? 'unsettled'}>
								<span class="g-line">
									<span class="g-when" title={fmtWhen.format(new Date(g.playedAt))}>{ago(g.playedAt)}</span>
									{#if g.seconds}<span class="g-dur">{fmtPlaytime(g.seconds)}</span>{/if}
								</span>
								<span class="g-line">
									<span class="g-meta">
										{#if g.mode}<ModeMark mode={g.mode} />{:else}<span class="g-mode-none">mode unknown</span>{/if}
									</span>
									<span class="g-who">
										{#each g.players as p, i (p.toon || p.name)}{i ? ', ' : ''}{p.name}{/each}
									</span>
									<OutcomeMark outcome={g.outcome} />
								</span>
							</a>
						</li>
					{/each}
				</ol>
				<p class="note fine">The players named are the ones on this class in that game.</p>
			</section>
		{/if}
	{/if}
{/snippet}

<Page>
	<Seo title="{mos.name} players — MOS" description={description} image={mosCardUrl(mos.id)} />

	{#if !rows.length}
		<h2 class="section lead">Players</h2>
		<p class="note">
			No recorded game has had a {mos.name} in it yet. The boards are built from uploaded
			replays — <a href="/replays">upload one</a>, or let the <a href="/companion">Companion</a>
			do it — and this page fills in as they arrive.
		</p>
	{:else}
		<div class="cols">
			<div class="col">
				{#each layout.left as key (key)}{@render widget(key)}{/each}
			</div>
			<div class="col">
				{#each layout.right as key (key)}{@render widget(key)}{/each}
			</div>
		</div>
	{/if}
</Page>

<style>
	/* whichever leads the tab gives the between-sections gap back — see the
	   gear tab: the two columns' first headings, or the empty state's. */
	h2.lead,
	.cols:first-child .col > section:first-child > h2.section {
		margin-top: 4px;
	}
	/* The totals sit inside their column, over the board they summarise:
	   smaller than a page-wide strip and spaced tighter, and they wrap to a
	   second row where the column is narrow. */
	.tiles.small {
		gap: 8px;
		margin: 0 0 12px;
	}
	.tiles.small :global(.tile) {
		flex: 1 1 96px;
		min-width: 0;
		padding: 8px 12px 7px;
	}
	.tiles.small :global(.tile b) {
		font-size: 16px;
	}
	.note.fine {
		font-size: 11.5px;
		color: var(--text-faint);
		margin-top: 8px;
	}

	/* Two even columns — see `layout` for what goes where. They fold to one
	   below 1080px, where neither has the room. */
	.cols {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0 28px;
		align-items: start;
	}
	.col {
		min-width: 0;
	}
	@media (max-width: 1080px) {
		.cols {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	/* Seven columns is more than half a page holds at most widths — the board
	   would scroll before its bar. So the columns give way by the room the
	   board actually has, not the screen: the "Last" column first, then the
	   percentage. Container queries, so the two boards — one per column, the
	   columns equal — always agree with each other. */
	.col {
		container-type: inline-size;
	}
	@container (max-width: 660px) {
		.toplist .when {
			display: none;
		}
	}
	@container (max-width: 520px) {
		.toplist .rate {
			display: none;
		}
	}
	/* a long clan tag and name yield before the numbers do */
	.toplist td.figcell {
		max-width: 190px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.toplist .pclan {
		color: var(--text-faint);
		font-size: 11px;
		margin-right: 3px;
	}
	.toplist .pname {
		font-weight: 550;
	}
	.wl .w {
		color: var(--ok);
		font-weight: 600;
	}
	.wl .l {
		color: var(--hostile);
		font-weight: 600;
	}
	.wl .rate,
	.of {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--text-faint);
		margin-left: 4px;
	}
	.none {
		color: var(--text-faint);
	}
	.when {
		white-space: nowrap;
		color: var(--text-dim);
	}
	.modes :global(.mark) {
		vertical-align: middle;
	}

	/* Twenty-six bars, one per week, newest on the right — a shape, not a
	   chart: the numbers are in the tooltips and the axis says the total. */
	.weeks {
		padding: 12px 14px 10px;
	}
	.bars {
		display: flex;
		align-items: flex-end;
		gap: 3px;
		height: 64px;
	}
	.bar {
		flex: 1;
		min-height: 2px;
		background: var(--accent);
		border-radius: 2px 2px 0 0;
		opacity: 0.85;
	}
	.bar:hover {
		opacity: 1;
	}
	.axis {
		display: flex;
		justify-content: space-between;
		margin-top: 6px;
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-faint);
	}
	.along .pname {
		font-weight: 550;
	}

	/* the front page's game list, in miniature */
	.recent {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.recent a {
		display: block;
		padding: 8px 11px;
		border: 1px solid var(--border);
		border-left: 3px solid var(--border);
		border-radius: var(--radius-2);
		background: var(--surface);
		text-decoration: none;
		color: inherit;
		transition: border-color 120ms ease;
	}
	.recent a:hover {
		border-color: var(--border-strong);
	}
	.recent a.win {
		border-left-color: var(--ok);
	}
	.recent a.loss {
		border-left-color: var(--hostile);
	}
	.g-line {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.g-line + .g-line {
		margin-top: 4px;
	}
	.g-when {
		font-size: 12.5px;
		font-weight: 550;
	}
	.g-dur {
		font-family: var(--font-mono);
		font-size: 10.5px;
		color: var(--text-faint);
		margin-left: auto;
	}
	.g-meta {
		flex: none;
	}
	.g-mode-none {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--text-faint);
	}
	.g-who {
		flex: 1;
		min-width: 0;
		font-size: 11.5px;
		color: var(--text-dim);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
