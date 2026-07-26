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

<p class="note">
	Every unit defined in the map and its <em>UAR data</em> dependency mod, with weapon stats
	resolved and names joined from the English localization.
</p>

<div class="tiles">
	{#each categories as cat (cat)}
		<a class="tile" href="/entities?cat={encodeURIComponent(cat)}">
			<b>{categoryCount(cat)}</b>
			<span>{cat}</span>
		</a>
	{/each}
</div>

{#if latestRelease}
<section class="whatsnew card">
	<div class="wn-head">
		<h2>What's new <span class="wn-ver">{latestRelease.version}</span></h2>
		{#if latestRelease.date}<time class="wn-date" datetime={latestRelease.date}>{latestRelease.date}</time>{/if}
		<a class="wn-all" href="/changelog">Full changelog →</a>
	</div>
	{#if wnEntries.length}
		<ul class="wn-list">
			{#each wnEntries as e (e.title)}
				<li class:major={e.impact === 'major'}><ChangeChip type={e.type} /> {e.title}</li>
			{/each}
		</ul>
	{:else}
		<p class="wn-empty">Small fixes and tweaks — see the full changelog.</p>
	{/if}
</section>
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
		{#if data.weekly.prestiged.length}
			<DescCard label="Prestiged">
				<ul class="top-list">
					{#each data.weekly.prestiged as p (p.toon || p.name)}
						<li>
							<div class="prow">
								{#if p.clan}<span class="pclan">&lt;{p.clan}&gt;</span>{/if}
								{#if p.toon}
									<a class="pname" href="/players/{p.toon}">{p.name}</a>
								{:else}
									<span class="pname">{p.name}</span>
								{/if}
								<span class="pxp">P{p.from} → P{p.to}</span>
							</div>
						</li>
					{/each}
				</ul>
			</DescCard>
		{/if}
	</div>
	<p class="top-note">Aggregated from ingested replays over the last 7 days.</p>
{/if}

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

<style>
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
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
	.whatsnew {
		margin-top: 14px;
	}
	.wn-head {
		display: flex;
		align-items: baseline;
		gap: 10px;
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
		font-size: 11px;
		color: var(--ink-3);
	}
	.wn-all {
		margin-left: auto;
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
		list-style: none;
		margin: 9px 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.wn-list li {
		display: flex;
		align-items: baseline;
		gap: 8px;
		font-size: 13px;
		color: var(--ink-2);
	}
	.wn-list li.major {
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
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
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
	.pick-bar {
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
