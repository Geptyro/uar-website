<script lang="ts">
	import { units, categories, categoryCount, weaponLabel } from '$lib/units';
	import StatIcon from '$lib/components/StatIcon.svelte';
	import ChangeChip from '$lib/components/ChangeChip.svelte';
	import { latestRelease } from '$lib/changelog-data';

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
	<ul class="wn-list">
		{#each latestRelease.entries as e (e.title)}
			<li><ChangeChip type={e.type} /> {e.title}</li>
		{/each}
	</ul>
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
		gap: 12px;
		align-items: flex-start;
	}
	.card-icon {
		width: 44px;
		height: 44px;
		object-fit: cover;
		border-radius: var(--r-sm);
		flex-shrink: 0;
	}
	.card-icon.placeholder {
		background: var(--surface-2);
	}
	.card-body {
		min-width: 0;
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
</style>
