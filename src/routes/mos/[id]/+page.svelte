<script lang="ts">
	import { restrictionLabel } from '$lib/mos';
	import { weaponLabel } from '$lib/units';

	let { data } = $props();

	const mos = $derived(data.mos);
	const usable = $derived(data.items);

	const stats = $derived(
		(
			[
				['Life', mos.life],
				['Armor', mos.armor],
				['Speed', mos.speed],
				['Energy', mos.energy]
			] as const
		).filter(([, v]) => v !== null)
	);
</script>

<svelte:head>
	<title>{mos.name} — MOS — UAR Unit Database</title>
</svelte:head>

<header class="head">
	<div>
		<div class="eyebrow">{mos.mos ? `MOS ${mos.mos}` : 'MOS'}{mos.role ? ` · ${mos.role}` : ''}</div>
		<h1>{mos.name}</h1>
	</div>
	<a class="unit-link" href="/units/{mos.id}">Unit data →</a>
</header>

<div class="statrow">
	{#each stats as [label, value] (label)}
		<div class="stat"><b>{value}</b><span>{label}</span></div>
	{/each}
	{#if mos.inventory.slots}
		<div class="stat"><b>{mos.inventory.slots}</b><span>Bag slots</span></div>
	{/if}
</div>

{#if mos.tooltip}
	<pre class="tooltip">{mos.tooltip}</pre>
{/if}

{#if mos.weapons.length}
	<h2>Weapons</h2>
	<div class="tablewrap">
		<table>
			<thead>
				<tr>
					<th>Weapon</th>
					<th class="num">Damage</th>
					<th class="num">Range</th>
					<th class="num">Period (s)</th>
					<th class="num">DPS</th>
				</tr>
			</thead>
			<tbody>
				{#each mos.weapons as w (w.id)}
					<tr>
						<td class="mono">{w.id}</td>
						<td class="num">{w.dmg ?? '?'}</td>
						<td class="num">{w.range ?? '?'}</td>
						<td class="num">{w.period ?? '?'}</td>
						<td class="num">{w.dmg && w.period ? Math.round(w.dmg / w.period) : '?'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

{#if mos.skills.length}
	<h2>Skills</h2>
	<p class="note">
		Learnable skill trees ({mos.skills.length}) — one point per level-up, from the class's learn
		ability.
	</p>
	<div class="cards">
		{#each mos.skills as s (s.id)}
			<article class="card">
				<h3>
					{s.name}
					{#if s.levels}<span class="lv">{s.levels} lv</span>{/if}
				</h3>
				{#if s.tooltip}<p class="card-tip">{s.tooltip}</p>{/if}
			</article>
		{/each}
	</div>
{/if}

{#if mos.common.length}
	<h2>Standard abilities</h2>
	<div class="abil-list">
		{#each mos.common as a (a.id)}
			{#if a.tooltip}
				<details>
					<summary>{a.name}</summary>
					<p>{a.tooltip}</p>
				</details>
			{:else}
				<span class="abil-plain">{a.name}</span>
			{/if}
		{/each}
	</div>
{/if}

<h2>Usable items</h2>
<p class="note">
	Derived from item carry-restrictions in the game data: {usable.sure.length} usable{usable
		.conditional.length
		? `, ${usable.conditional.length} conditional (restriction shown could not be fully resolved)`
		: ''}. In-game availability also depends on mission drops and rank.
</p>
<div class="tablewrap">
	<table>
		<thead>
			<tr>
				<th>Item</th>
				<th>Class</th>
				<th class="num">Charges</th>
				<th>Effect</th>
				<th>Restriction</th>
			</tr>
		</thead>
		<tbody>
			{#each [...usable.sure, ...usable.conditional] as item (item.id)}
				<tr class:cond={item.restrictions.some((r) => r.kind === 'raw')}>
					<td><a href="/items#{item.id}">{item.name}</a></td>
					<td class="mono">{item.class}</td>
					<td class="num">{item.charges ? `${item.charges.start ?? '?'}/${item.charges.max}` : ''}</td>
					<td class="mono effect">{item.mods.join(', ')}</td>
					<td class="mono restr">{item.restrictions.map(restrictionLabel).join(' · ')}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 16px;
	}
	.eyebrow {
		font-family: var(--mono);
		font-size: 11px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--mos);
	}
	h1 {
		margin: 2px 0 0;
		font-size: clamp(24px, 4vw, 32px);
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}
	.unit-link {
		font-family: var(--mono);
		font-size: 12px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		text-decoration: none;
		color: var(--ink-soft);
		border: 1px solid var(--line);
		padding: 6px 10px;
	}
	.unit-link:hover {
		color: var(--ink);
		border-color: var(--ink);
	}

	.statrow {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-bottom: 16px;
	}
	.stat {
		background: var(--panel);
		border: 1px solid var(--line);
		padding: 8px 14px;
		min-width: 90px;
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

	.tooltip {
		background: var(--panel);
		border: 1px solid var(--line);
		border-left: 3px solid var(--mos);
		padding: 14px 16px;
		white-space: pre-wrap;
		font: 13px/1.55 system-ui, sans-serif;
		max-width: 78ch;
		overflow-x: auto;
		margin: 0 0 8px;
	}

	h2 {
		font-size: 14px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		border-bottom: 2px solid var(--ink);
		padding-bottom: 5px;
		margin: 30px 0 10px;
	}
	.note {
		color: var(--ink-soft);
		font-size: 13px;
		max-width: 75ch;
		margin: 0 0 12px;
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 12px;
	}
	.card {
		background: var(--panel);
		border: 1px solid var(--line);
		border-top: 3px solid var(--accent);
		padding: 12px 14px;
	}
	.card h3 {
		margin: 0 0 6px;
		font-size: 14.5px;
		display: flex;
		justify-content: space-between;
		gap: 8px;
	}
	.lv {
		font-family: var(--mono);
		font-size: 10.5px;
		color: var(--accent);
		white-space: nowrap;
	}
	.card-tip {
		margin: 0;
		font-size: 12.5px;
		color: var(--ink-soft);
		white-space: pre-line;
	}

	.abil-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		max-width: 78ch;
	}
	details {
		background: var(--panel);
		border: 1px solid var(--line);
	}
	summary {
		cursor: pointer;
		padding: 7px 12px;
		font-size: 13.5px;
	}
	details p {
		margin: 0;
		padding: 0 12px 10px;
		font-size: 12.5px;
		color: var(--ink-soft);
		white-space: pre-line;
	}
	.abil-plain {
		padding: 7px 12px;
		background: var(--panel);
		border: 1px solid var(--line);
		font-size: 13.5px;
	}

	.tablewrap {
		overflow-x: auto;
		border: 1px solid var(--line);
	}
	table {
		border-collapse: collapse;
		width: 100%;
		min-width: 620px;
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
	}
	td.num {
		font-family: var(--mono);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.mono {
		font-family: var(--mono);
		font-size: 11.5px;
		color: var(--ink-soft);
	}
	td.effect,
	td.restr {
		overflow-wrap: anywhere;
	}
	tr.cond td {
		opacity: 0.75;
	}
</style>
