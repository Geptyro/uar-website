<script lang="ts">
	import { units, categories, categoryCount, weaponLabel } from '$lib/units';
	import StatIcon from '$lib/components/StatIcon.svelte';
	import ChangeChip from '$lib/components/ChangeChip.svelte';
	import { latestRelease } from '$lib/changelog-data';

	// minor entries stay off the widget; the changelog page lists them
	const wnEntries = latestRelease
		? latestRelease.entries.filter((e) => e.impact !== 'minor')
		: [];
	import DescCard from '$lib/components/DescCard.svelte';
	import ActivityChart from '$lib/components/ActivityChart.svelte';
	import anonPortrait from '$lib/assets/anon-portrait.svg';

	let { data } = $props();

	const unitById = new Map(units.map((u) => [u.id, u]));

	const mosUnits = units
		.filter(
			(u) =>
				u.category === 'MOS (player class)' &&
				u.id !== 'SiegeTankSieged' &&
				u.id !== 'TemplateMOS'
		)
		.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

	const bosses = units
		.filter((u) => u.category === 'undead / hostile' && (u.life ?? 0) >= 10000)
		.sort((a, b) => (b.life ?? 0) - (a.life ?? 0));
</script>

<svelte:head>
	<title>UAR Unit Database — Undead Assault Reborn</title>
	<meta
		name="description"
		content="Unit database for the StarCraft II arcade map Undead Assault Reborn: MOS player classes, undead roster, items and weapons."
	/>
</svelte:head>

<div class="layout">
<div class="main">
{#if data.weekly.xp.length || data.weekly.classPicks.length}
	<h2 class="section">This week · last 7 days</h2>
	<div class="boards">
		{#if data.weekly.xp.length}
			<DescCard label="XP gained">
				<ol class="top-list">
					{#each data.weekly.xp as p, i (p.toon || p.name)}
						<li>
							<div class="prow">
								<span class="pos">{i + 1}</span>
								<img
									class="pportrait"
									src={(p.toon && data.avatars[p.toon]) || anonPortrait}
									alt=""
									loading="lazy"
								/>
								{#if p.clan}<span class="pclan">&lt;{p.clan}&gt;</span>{/if}
								{#if p.toon}
									<a class="pname" href="/players/{p.toon}">{p.name}</a>
								{:else}
									<span class="pname">{p.name}</span>
								{/if}
								<span class="pxp" title="{p.games} game{p.games === 1 ? '' : 's'} this week"
									>+{p.xpGained.toLocaleString('en')} XP</span
								>
							</div>
							<div class="pbar">
								<div
									class="pbar-fill"
									style="width: {(100 * p.xpGained) / data.weekly.xp[0].xpGained}%"
								></div>
							</div>
						</li>
					{/each}
				</ol>
			</DescCard>
		{/if}
		{#if data.weekly.classPicks.length}
			<DescCard label="Class picks">
				<ol class="top-list">
					{#each data.weekly.classPicks as c (c.mos)}
						{@const u = unitById.get(c.mos)}
						<li>
							<div class="prow">
								{#if u?.icon}
									<img class="pick-icon" src={u.icon} alt="" loading="lazy" />
								{:else}
									<span class="pick-icon placeholder"></span>
								{/if}
								<a class="pname" href="/mos/{c.mos}">{u?.name || c.mos}</a>
								<span class="pxp" title="times picked in ingested games this week">{c.picks}</span>
							</div>
							<div class="pbar pick-bar">
								<div
									class="pbar-fill"
									style="width: {(100 * c.picks) / data.weekly.classPicks[0].picks}%"
								></div>
							</div>
						</li>
					{/each}
				</ol>
			</DescCard>
		{/if}
	</div>
	<p class="top-note">Aggregated from ingested replays over the last 7 days.</p>
{/if}

{#if data.activity.values.some((v) => v > 0)}
	<h2 class="section">Activity · last 7 days</h2>
	<DescCard label="Players in game">
		<ActivityChart timeline={data.activity} />
	</DescCard>
	<p class="top-note">
		Average players in game per half hour, from ingested replays · times shown in your local
		timezone.
	</p>
{/if}

<h2 class="section">MOS · Player classes</h2>
<div class="cards">
	{#each mosUnits as u (u.id)}
		<a class="card mos-card" href="/mos/{u.id}">
			{#if u.icon}
				<img class="card-icon" src={u.icon} alt="" loading="lazy" />
			{:else}
				<span class="card-icon placeholder"></span>
			{/if}
			<div class="card-body">
				<h3>{u.name || u.id}</h3>
				<div class="code">{u.mos ? `MOS ${u.mos}` : u.id}{u.role ? ` · ${u.role}` : ''}</div>
				<div class="kv">
					<span><StatIcon name="life" size={12} /><b>{u.life ?? '–'}</b></span>
					<span><StatIcon name="armor" size={12} /><b>{u.armor ?? '–'}</b></span>
					<span><StatIcon name="speed" size={12} /><b>{u.speed ?? '–'}</b></span>
				</div>
			</div>
		</a>
	{/each}
</div>

<h2 class="section">Heavy hostiles · 10,000+ HP</h2>
<div class="tablewrap">
	<table class="data" style="min-width: 640px">
		<thead>
			<tr>
				<th>Name</th>
				<th class="num">Life</th>
				<th class="num">Armor</th>
				<th class="num">Speed</th>
				<th>Weapons</th>
			</tr>
		</thead>
		<tbody>
			{#each bosses as u (u.id)}
				<tr>
					<td><a href="/entities/{u.id}">{u.name || u.id}</a></td>
					<td class="num">{u.life?.toLocaleString('en')}</td>
					<td class="num">{u.armor ?? ''}</td>
					<td class="num">{u.speed ?? ''}</td>
					<td class="mono">{u.weapons.map(weaponLabel).join('; ')}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
</div>

<aside class="infobox">
	<!-- Prestige is the rarest thing a player does, so it heads the column;
	     what shipped comes under it. Same 7-day window as the weekly boards. -->
	{#if data.weekly.prestiged.length}
		<section class="prestige">
			<div class="pr-label">
				<span class="pr-star" aria-hidden="true">★</span> Prestiged
				<span class="pr-when">· last 7 days</span>
			</div>
			<ul class="pr-list">
				{#each data.weekly.prestiged as p (p.toon || p.name)}
					<li class="pr-item">
						<img
							class="pr-portrait"
							src={(p.toon && data.avatars[p.toon]) || anonPortrait}
							alt=""
							loading="lazy"
						/>
						<span class="pr-who">
							{#if p.clan}<span class="pclan">&lt;{p.clan}&gt;</span>{/if}
							{#if p.toon}
								<a class="pname" href="/players/{p.toon}">{p.name}</a>
							{:else}
								<span class="pname">{p.name}</span>
							{/if}
						</span>
						<span class="pr-jump">P{p.from} <span class="pr-arrow">→</span></span>
						<b class="pr-level">P{p.to}</b>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if latestRelease}
		<section class="whatsnew card">
			<div class="wn-head">
				<h2>What's new <span class="wn-ver">{latestRelease.version}</span></h2>
				{#if latestRelease.date}<time class="wn-date" datetime={latestRelease.date}
						>{latestRelease.date}</time
					>{/if}
			</div>
			{#if wnEntries.length}
				<!-- type and headline are a pair, and a two-column grid lines every
				     headline up on the same edge whatever the chip is called -->
				<dl class="wn-list">
					{#each wnEntries as e (e.title)}
						<dt><ChangeChip type={e.type} /></dt>
						<dd class:major={e.impact === 'major'}>{e.title}</dd>
					{/each}
				</dl>
			{:else}
				<p class="wn-empty">Small fixes and tweaks — see the full changelog.</p>
			{/if}
			<a class="wn-all" href="/changelog">Full changelog →</a>
		</section>
	{/if}

	<!-- the roster by category: a way in to /entities, not a headline -->
	<div class="tiles">
		{#each categories as cat (cat)}
			<a class="tile" href="/entities?cat={encodeURIComponent(cat)}">
				<b>{categoryCount(cat)}</b>
				<span>{cat}</span>
			</a>
		{/each}
	</div>
</aside>
</div>

<style>
	/* the right column, the shape /mos and a player profile already use: a
	   fixed rail beside the page, and on a phone it comes first — what
	   happened this week is why you opened the site, and it should not sit
	   under the whole roster */
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 290px;
		gap: 0 28px;
		align-items: start;
	}
	.main {
		min-width: 0;
	}
	/* the column now opens on a section heading, and its 34px of top margin
	   is spacing between sections, not a gap under the top bar */
	.main :global(h2.section:first-child) {
		margin-top: 4px;
	}
	.infobox {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	/* in the column the counts line up in a grid rather than running on as a
	   wrapped row, so the last one is not left hanging half a tile wide */
	.infobox .tiles {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(125px, 100%), 1fr));
		gap: 10px;
	}
	/* Below this the rail would starve the tables, so the page stacks — and
	   stacked, the column leads. Its two widgets sit side by side while there
	   is room for them, one under the other on a phone. */
	@media (max-width: 1080px) {
		/* one column, still a grid: a column flex box would take align-items
		   from the rule above and size each half to its widest child instead
		   of the page, which is how the tables dragged a scrollbar onto the
		   whole page */
		.layout {
			grid-template-columns: minmax(0, 1fr);
		}
		.infobox {
			order: -1;
			margin: 0 0 18px;
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
			gap: 12px;
			align-items: start;
		}
	}

	/* the one place the site goes gold, with a sheen across it. In the column
	   it reads as a roll of honour: no box around anyone, just a hairline
	   between them and the new level as the one filled thing. */
	.prestige {
		background:
			linear-gradient(150deg, color-mix(in srgb, var(--gold) 10%, transparent), transparent 60%),
			var(--gold-soft);
		border: 1px solid var(--gold-line);
		border-radius: var(--r);
		padding: 10px var(--card-pad-x) 11px;
	}
	.pr-label {
		display: inline-flex;
		align-items: baseline;
		gap: 5px;
		font-family: var(--mono);
		font-size: 10px;
		font-weight: 650;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--gold);
		white-space: nowrap;
		margin-bottom: 4px;
	}
	.pr-star {
		font-size: 15px;
		line-height: 1;
		color: var(--gold);
	}
	.pr-when {
		font-weight: 400;
		color: var(--ink-3);
	}
	.pr-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
	}
	.pr-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 7px 0;
		font-size: 12.5px;
		min-width: 0;
	}
	.pr-item + .pr-item {
		border-top: 1px solid var(--gold-line);
	}
	.pr-who {
		display: flex;
		align-items: baseline;
		gap: 5px;
		min-width: 0;
		overflow: hidden;
	}
	/* name left, the jump right, whatever the column width */
	.pr-jump {
		margin-left: auto;
	}
	.pr-portrait {
		width: 24px;
		height: 24px;
		border-radius: var(--r-sm);
		object-fit: cover;
		/* a ring rather than a border: it cannot eat into the portrait */
		box-shadow: 0 0 0 1px var(--gold-line);
		flex-shrink: 0;
	}
	/* the name carries no underline until you go for it — this is a list of
	   people, and only one of them is the loud part */
	.pr-item .pname {
		color: inherit;
		text-decoration: none;
		font-weight: 600;
	}
	.pr-item .pname:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.pr-jump {
		font-family: var(--mono);
		font-size: 10.5px;
		color: var(--ink-3);
		white-space: nowrap;
	}
	.pr-arrow {
		opacity: 0.6;
	}
	.pr-level {
		font-family: var(--mono);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.02em;
		background: var(--gold);
		color: var(--bg);
		border-radius: var(--r-sm);
		padding: 2px 7px;
		white-space: nowrap;
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(250px, 100%), 1fr));
		gap: 12px;
	}
	.mos-card {
		display: flex;
		align-items: stretch;
		padding: 0;
		overflow: hidden;
	}
	.card-icon {
		width: 84px;
		align-self: stretch;
		object-fit: cover;
		flex-shrink: 0;
	}
	.card-icon.placeholder {
		background: var(--surface-2);
	}
	.card-body {
		min-width: 0;
		padding: 12px 14px;
	}
	.mos-card h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		letter-spacing: -0.01em;
	}
	.code {
		font-family: var(--mono);
		font-size: 10px;
		color: var(--mos);
		letter-spacing: 0.04em;
		margin: 1px 0 7px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.kv {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
		font-family: var(--mono);
		font-size: 10.5px;
		color: var(--ink-3);
		font-variant-numeric: tabular-nums;
	}
	.kv span {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.kv b {
		font-weight: 600;
		color: var(--ink-2);
	}
	/* in a 290px column the head cannot hold one line: let the date and the
	   changelog link drop under the title rather than squeezing it */
	.wn-head {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 2px 10px;
	}
	.wn-head h2 {
		margin: 0;
		font-size: 13.5px;
		font-weight: 650;
		letter-spacing: -0.01em;
	}
	.wn-ver {
		font-family: var(--mono);
		font-size: 12px;
		font-weight: 700;
		color: var(--accent);
		margin-left: 3px;
	}
	.wn-date {
		margin-left: auto;
		font-size: 11px;
		color: var(--ink-3);
	}
	/* the way out of the card sits at its foot, on its own rule — in a 290px
	   column it cannot share the title's line without pushing it around */
	.wn-all {
		display: block;
		margin-top: 11px;
		padding-top: 9px;
		border-top: 1px solid var(--border);
		font-size: 12px;
		color: var(--accent);
		text-decoration: none;
		white-space: nowrap;
	}
	.wn-all:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.wn-list {
		display: grid;
		/* the chip column takes the widest chip; every headline starts after it */
		grid-template-columns: max-content minmax(0, 1fr);
		align-items: baseline;
		gap: 7px 9px;
		margin: 10px 0 0;
	}
	.wn-list dt {
		display: flex;
	}
	.wn-list dd {
		margin: 0;
		font-size: 13px;
		line-height: 1.45;
		color: var(--ink-2);
	}
	.wn-list dd.major {
		font-weight: 600;
		color: var(--ink);
	}
	.wn-empty {
		margin: 9px 0 0;
		font-size: 12.5px;
		color: var(--ink-3);
	}
	.boards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
		gap: 12px;
		align-items: start;
	}
	.pick-icon {
		width: 18px;
		height: 18px;
		object-fit: cover;
		border-radius: 4px;
		align-self: center;
		flex-shrink: 0;
	}
	.pick-icon.placeholder {
		background: var(--surface-2);
	}
	/* aligned under the name: icon 18 + gap (must out-rank .pbar's 48px) */
	.pbar.pick-bar {
		margin-left: 24px;
	}
	.top-list {
		list-style: none;
		margin: 2px 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 7px;
	}
	.top-list li {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}
	.prow {
		display: flex;
		align-items: baseline;
		gap: 6px;
		font-size: 12.5px;
		min-width: 0;
	}
	.pportrait {
		width: 22px;
		height: 22px;
		border-radius: var(--r-sm);
		object-fit: cover;
		border: 1px solid var(--border);
		align-self: center;
		flex-shrink: 0;
	}
	/* XP gained relative to the #1 player */
	.pbar {
		/* aligned under the name: pos 14 + portrait 22 + 2 gaps */
		margin-left: 48px;
		height: 3px;
		border-radius: 99px;
		background: var(--surface-2);
		overflow: hidden;
	}
	.pbar-fill {
		height: 100%;
		min-width: 2px;
		border-radius: inherit;
		background: var(--accent);
	}
	.pos {
		font-family: var(--mono);
		font-size: 10px;
		color: var(--ink-3);
		min-width: 14px;
		text-align: right;
		flex-shrink: 0;
	}
	.pclan {
		color: var(--ink-3);
		font-size: 11px;
		flex-shrink: 0;
	}
	.pname {
		font-weight: 550;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.pxp {
		margin-left: auto;
		font-family: var(--mono);
		font-size: 11px;
		color: var(--ink-2);
		white-space: nowrap;
		flex-shrink: 0;
	}
	.top-note {
		margin: 10px 0 0;
		font-size: 11px;
		color: var(--ink-3);
	}
</style>
