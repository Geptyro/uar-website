<script lang="ts">
	import { units, categories, categoryCount, weaponLabel } from '$lib/units';

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
		<a class="tile" href="/units?cat={encodeURIComponent(cat)}">
			<b>{categoryCount(cat)}</b>
			<span>{cat}</span>
		</a>
	{/each}
</div>

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
					<span>HP <b>{u.life ?? '–'}</b></span>
					<span>ARM <b>{u.armor ?? '–'}</b></span>
					<span>SPD <b>{u.speed ?? '–'}</b></span>
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
	.kv b {
		font-weight: 600;
		color: var(--ink-2);
	}
</style>
