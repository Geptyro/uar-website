<script lang="ts">
	import { units, categories, categoryCount, weaponLabel } from '$lib/units';

	const mosUnits = units
		.filter((u) => u.category === 'MOS (player class)' && u.id !== 'SiegeTankSieged')
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

<section class="intro">
	<h1>Unit database</h1>
	<p>
		Every unit defined in the map and its <em>UAR data</em> dependency mod — {units.length} entries
		parsed from the game data files, with weapon stats resolved and names joined from the English
		localization.
	</p>
</section>

<div class="statrow">
	{#each categories as cat (cat)}
		<a class="stat" href="/units?cat={encodeURIComponent(cat)}">
			<b>{categoryCount(cat)}</b>
			<span>{cat}</span>
		</a>
	{/each}
</div>

<h2>MOS — player classes</h2>
<p class="note">
	All soldier classes inherit the Template baseline (420 HP · 1 armor · 2.91 speed · 190 energy)
	unless overridden. “?” damage means the weapon deals damage through a multi-stage effect rather
	than a single damage entry.
</p>
<div class="cards">
	{#each mosUnits as u (u.id)}
		<a class="card" href="/mos/{u.id}">
			<h3>{u.name || u.id}</h3>
			<div class="code">{u.mos ? `MOS ${u.mos}` : u.id}</div>
			{#if u.role}<div class="role">{u.role}</div>{/if}
			<div class="kv">
				<span>HP <b>{u.life ?? '–'}</b></span>
				<span>ARM <b>{u.armor ?? '–'}</b></span>
				<span>SPD <b>{u.speed ?? '–'}</b></span>
				<span>NRJ <b>{u.energy ?? '–'}</b></span>
			</div>
			{#if u.weapons.length}
				<div class="wpn">{u.weapons.map(weaponLabel).join('; ')}</div>
			{/if}
		</a>
	{/each}
</div>

<h2>Heavy hostiles</h2>
<p class="note">Undead with 10,000+ HP — the bosses and elite threats of the AO.</p>
<div class="tablewrap">
	<table>
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
					<td><a href="/units/{u.id}">{u.name || u.id}</a></td>
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
	.intro h1 {
		margin: 0 0 6px;
		font-size: clamp(24px, 4vw, 32px);
		text-transform: uppercase;
		letter-spacing: 0.02em;
		text-wrap: balance;
	}
	.intro p {
		margin: 0;
		max-width: 65ch;
		color: var(--ink-soft);
	}

	.statrow {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin: 22px 0 8px;
	}
	.stat {
		background: var(--panel);
		border: 1px solid var(--line);
		padding: 8px 14px;
		min-width: 110px;
		text-decoration: none;
	}
	.stat b {
		display: block;
		font-size: 20px;
		font-variant-numeric: tabular-nums;
	}
	.stat span {
		font-family: var(--mono);
		font-size: 10.5px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-soft);
	}
	.stat:hover {
		border-color: var(--accent);
	}

	h2 {
		font-size: 15px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		border-bottom: 2px solid var(--ink);
		padding-bottom: 6px;
		margin: 36px 0 10px;
	}
	.note {
		color: var(--ink-soft);
		font-size: 13.5px;
		max-width: 70ch;
		margin: 0 0 14px;
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 12px;
	}
	.card {
		background: var(--panel);
		border: 1px solid var(--line);
		border-top: 3px solid var(--mos);
		padding: 12px 14px;
		text-decoration: none;
		display: block;
	}
	.card:hover {
		border-color: var(--mos);
	}
	.card h3 {
		margin: 0 0 2px;
		font-size: 15px;
	}
	.code {
		font-family: var(--mono);
		font-size: 11px;
		color: var(--mos);
		letter-spacing: 0.06em;
	}
	.role {
		font-size: 12.5px;
		color: var(--ink-soft);
		margin-bottom: 6px;
	}
	.kv {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
		font-family: var(--mono);
		font-size: 11.5px;
		font-variant-numeric: tabular-nums;
	}
	.wpn {
		margin-top: 6px;
		font-family: var(--mono);
		font-size: 11px;
		color: var(--ink-soft);
		overflow-wrap: anywhere;
	}

	.tablewrap {
		overflow-x: auto;
		border: 1px solid var(--line);
	}
	table {
		border-collapse: collapse;
		width: 100%;
		min-width: 640px;
		font-size: 13px;
	}
	th {
		font-family: var(--mono);
		font-size: 10.5px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		text-align: left;
		background: var(--panel);
		border-bottom: 2px solid var(--ink);
		padding: 8px 10px;
		white-space: nowrap;
	}
	td {
		border-bottom: 1px solid var(--line);
		padding: 6px 10px;
		vertical-align: top;
	}
	th.num,
	td.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	td.num {
		font-family: var(--mono);
		white-space: nowrap;
	}
	td.mono {
		font-family: var(--mono);
		font-size: 11.5px;
		color: var(--ink-soft);
		overflow-wrap: anywhere;
	}
</style>
