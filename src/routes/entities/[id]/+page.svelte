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
	<a href="/entities">← All entities</a>
	{#if mosById.has(unit.id)}
		<a href="/mos/{unit.id}">Class page →</a>
	{/if}
</nav>

<header class="head">
	{#if unit.icon}<img class="unit-icon" src={unit.icon} alt="{unit.name || unit.id} icon" />{/if}
	<div>
		<div class="eyebrow">{unit.id}</div>
		<h1 class="page-title">{unit.name || unit.id}</h1>
	</div>
	<span class="tag {tagClass(unit.category)}">{unit.category}</span>
</header>
<div class="meta">
	{#if unit.mos}<span>MOS {unit.mos}</span>{/if}
	{#if unit.role}<span>{unit.role}</span>{/if}
	<span>defined in: {unit.src.replace('+', ' + ')}</span>
</div>

<div class="tiles">
	{#each stats as [label, value] (label)}
		<div class="tile">
			<b>{typeof value === 'number' ? value.toLocaleString('en') : value}</b>
			<span>{label}</span>
		</div>
	{/each}
</div>

{#if unit.weapons.length}
	<h2 class="section">Weapons</h2>
	<div class="tablewrap">
		<table class="data" style="min-width: 500px">
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
	<p class="note footnote">
		“?” means the weapon fires a multi-stage effect (pellets, splash chains) whose damage lives
		deeper in the effect tree.
	</p>
{/if}

{#if unit.tooltip}
	<h2 class="section">In-game description</h2>
	<pre class="quote">{unit.tooltip}</pre>
{/if}

<h2 class="section">Lineage</h2>
<div class="lineage">
	{#if unit.parent}
		<p>
			Inherits from
			{#if unitById.has(unit.parent)}
				<a href="/entities/{unit.parent}"><code>{unit.parent}</code></a>
			{:else}
				<code>{unit.parent}</code> <span class="dim">(base game / dependency)</span>
			{/if}
		</p>
	{:else}
		<p>No parent — standalone definition.</p>
	{/if}
	{#if children.length}
		<p>
			Extended by:
			{#each children as c, i (c.id)}{#if i > 0},
				{/if}<a href="/entities/{c.id}"><code>{c.id}</code></a>{/each}
		</p>
	{/if}
</div>

<style>
	.crumbs {
		display: flex;
		gap: 18px;
		margin-bottom: 18px;
	}
	.crumbs a {
		font-family: var(--mono);
		font-size: 11px;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		text-decoration: none;
		color: var(--ink-3);
		transition: color 120ms ease;
	}
	.crumbs a:hover {
		color: var(--accent);
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 14px;
	}
	.unit-icon {
		width: 54px;
		height: 54px;
		object-fit: cover;
		border-radius: var(--r);
		box-shadow: var(--shadow-1);
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 16px;
		margin: 8px 0 18px;
		color: var(--ink-3);
		font-size: 12.5px;
	}

	.footnote {
		margin-top: 8px;
		font-size: 12px;
	}

	.lineage p {
		margin: 4px 0;
		font-size: 13.5px;
	}
	.lineage a {
		text-decoration: none;
		color: var(--accent);
	}
	.lineage a:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.dim {
		color: var(--ink-3);
		font-size: 12px;
	}
</style>
