<script lang="ts">
	import { unitById, tagClass } from '$lib/units';
	import { mosById } from '$lib/mos';

	let { data } = $props();

	const unit = $derived(data.unit);
	const children = $derived(data.children);

	const stats = $derived(
		(
			[
				['Life', unit.life],
				['Armor', unit.armor],
				['Speed', unit.speed],
				['Energy', unit.energy],
				['Regen', unit.regen],
				['Sight', unit.sight]
			] as const
		).filter(([, v]) => v !== null)
	);
</script>

<svelte:head>
	<title>{unit.name || unit.id} — UAR Unit Database</title>
</svelte:head>

<nav class="crumbs">
	<a href="/units">← All units</a>
	{#if mosById.has(unit.id)}
		<a href="/mos/{unit.id}">Class page →</a>
	{/if}
</nav>

<header class="unit-head">
	<h1>{unit.name || unit.id}</h1>
	<span class="tag {tagClass(unit.category)}">{unit.category}</span>
</header>
<div class="meta">
	<code>{unit.id}</code>
	{#if unit.mos}<span>MOS {unit.mos}</span>{/if}
	{#if unit.role}<span>{unit.role}</span>{/if}
	<span>defined in: {unit.src.replace('+', ' + ')}</span>
</div>

<div class="statrow">
	{#each stats as [label, value] (label)}
		<div class="stat">
			<b>{typeof value === 'number' ? value.toLocaleString('en') : value}</b>
			<span>{label}</span>
		</div>
	{/each}
</div>

{#if unit.weapons.length}
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
				{#each unit.weapons as w (w.id)}
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
	<p class="note">
		“?” means the weapon fires a multi-stage effect (pellets, splash chains) whose damage lives
		deeper in the effect tree.
	</p>
{/if}

{#if unit.tooltip}
	<h2>In-game description</h2>
	<pre class="tooltip">{unit.tooltip}</pre>
{/if}

<h2>Lineage</h2>
<div class="lineage">
	{#if unit.parent}
		<p>
			Inherits from
			{#if unitById.has(unit.parent)}
				<a href="/units/{unit.parent}"><code>{unit.parent}</code></a>
			{:else}
				<code>{unit.parent}</code> <span class="note-inline">(base game / dependency)</span>
			{/if}
		</p>
	{:else}
		<p>No parent — standalone definition.</p>
	{/if}
	{#if children.length}
		<p>
			Extended by:
			{#each children as c, i (c.id)}{#if i > 0},
				{/if}<a href="/units/{c.id}"><code>{c.id}</code></a>{/each}
		</p>
	{/if}
</div>

<style>
	.crumbs {
		margin-bottom: 16px;
	}
	.crumbs {
		display: flex;
		gap: 16px;
	}
	.crumbs a {
		font-family: var(--mono);
		font-size: 12px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		text-decoration: none;
		color: var(--ink-soft);
	}
	.crumbs a:hover {
		color: var(--ink);
	}

	.unit-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 12px;
	}
	h1 {
		margin: 0;
		font-size: clamp(22px, 4vw, 30px);
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 16px;
		margin: 6px 0 18px;
		color: var(--ink-soft);
		font-size: 13px;
	}

	.statrow {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-bottom: 8px;
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

	h2 {
		font-size: 14px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		border-bottom: 2px solid var(--ink);
		padding-bottom: 5px;
		margin: 28px 0 12px;
	}

	.tablewrap {
		overflow-x: auto;
		border: 1px solid var(--line);
	}
	table {
		border-collapse: collapse;
		width: 100%;
		min-width: 480px;
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
	}
	th.num,
	td.num {
		text-align: right;
	}
	td.num {
		font-family: var(--mono);
		font-variant-numeric: tabular-nums;
	}
	.mono {
		font-family: var(--mono);
		font-size: 11.5px;
	}

	.note {
		color: var(--ink-soft);
		font-size: 12.5px;
		max-width: 70ch;
	}
	.note-inline {
		color: var(--ink-soft);
		font-size: 12.5px;
	}

	.tooltip {
		background: var(--panel);
		border: 1px solid var(--line);
		border-left: 3px solid var(--accent);
		padding: 14px 16px;
		white-space: pre-wrap;
		font: 13px/1.55 system-ui, sans-serif;
		max-width: 75ch;
		overflow-x: auto;
	}

	.lineage p {
		margin: 4px 0;
	}

	.tag {
		display: inline-block;
		font-family: var(--mono);
		font-size: 10.5px;
		letter-spacing: 0.05em;
		padding: 3px 8px;
		border: 1px solid;
		white-space: nowrap;
	}
	.tag.t-mos {
		color: var(--mos);
		border-color: var(--mos);
	}
	.tag.t-hostile {
		color: var(--hostile);
		border-color: var(--hostile);
	}
	.tag.t-item {
		color: var(--item);
		border-color: var(--item);
	}
	.tag.t-other {
		color: var(--ink-soft);
		border-color: var(--line);
	}
</style>
