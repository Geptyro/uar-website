<script lang="ts">
	import { unitById, tagClass, applyText } from '$lib/units';
	import { mosById, items, allowedLabel } from '$lib/mos';
	import FactsCard, { type Fact } from '$lib/components/FactsCard.svelte';
	import ModelCard from '$lib/components/ModelCard.svelte';
	import DescCard from '$lib/components/DescCard.svelte';

	let { data } = $props();

	const unit = $derived(data.unit);
	const children = $derived(data.children);
	const modelUrl = $derived(data.modelUrl);

	/** The item this unit represents, when it's a pickup's world object. */
	const item = $derived(items.find((i) => (i.unit ?? i.id) === unit.id));

	const facts = $derived([
		...(unit.role ? [{ icon: 'role', label: 'Role', value: unit.role } as Fact] : []),
		...(
			[
				['life', 'Life', unit.life],
				['armor', 'Armor', unit.armor],
				['speed', 'Speed', unit.speed],
				['energy', 'Energy', unit.energy],
				['regen', 'Regen', unit.regen],
				['sight', 'Sight', unit.sight]
			] as const
		)
			.filter(([, , v]) => v !== null)
			.map(
				([icon, label, value]) =>
					({
						icon,
						label,
						value: typeof value === 'number' ? value.toLocaleString('en') : (value ?? '')
					}) as Fact
			),
		{ icon: 'type', label: 'Source', value: unit.src.replace('+', ' + '), mono: true } as Fact
	]);
</script>

<svelte:head>
	<title>{unit.name || unit.id} — UAR Unit Database</title>
</svelte:head>

<nav class="crumbs">
	<a href="/entities">← All entities</a>
</nav>

<div class="layout">
	<div class="main">
		{#if item}
			<h2 class="section">Item effects</h2>
			<div class="itembox">
				<div class="itemfacts">
					<span class="tag t-item">{item.type}</span>
					{#if item.charges}<span class="mono dim">charges {item.charges.start ?? '?'}/{item.charges.max}</span>{/if}
					{#if item.allowed !== null}<span class="tag t-mos">{allowedLabel(item)}</span>{/if}
					<a href="/items#{item.id}">full item card →</a>
				</div>
				{#if item.mods.length}
					<ul class="mods">
						{#each item.mods as m (m.text + (m.note ?? ''))}
							<li>{m.text}{#if m.note}<span class="scope">({m.note})</span>{/if}</li>
						{/each}
					</ul>
				{/if}
				{#if item.conflicts.length}
					<div class="itemfacts">
						{#each item.conflicts as c (c)}<span class="tag t-hostile">{c}</span>{/each}
					</div>
				{/if}
			</div>
		{/if}

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
							<th>On hit</th>
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
								<td class="mono applies">{(w.applies ?? []).map(applyText).join(' · ')}</td>
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
	</div>

	<aside class="infobox">
		<FactsCard
			portrait={unit.icon}
			title={unit.name || unit.id}
			chip={unit.mos ? `MOS ${unit.mos}` : unit.name && unit.name !== unit.id ? unit.id : null}
			{facts}
			link={mosById.has(unit.id) ? { href: `/mos/${unit.id}`, label: 'Class page →' } : null}
		>
			{#snippet tags()}
				<span class="tag {tagClass(unit.category)}">{unit.category}</span>
			{/snippet}
		</FactsCard>
		{#if modelUrl}
			<ModelCard src={modelUrl} alt="3D model of {unit.name || unit.id}" />
		{/if}
		{#if unit.tooltip}
			<DescCard label="In-game description" text={unit.tooltip} />
		{/if}
	</aside>
</div>

<style>
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 290px;
		gap: 0 28px;
		align-items: start;
	}
	.main {
		min-width: 0;
	}
	.main :global(h2.section:first-child) {
		margin-top: 4px;
	}
	.infobox {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	@media (max-width: 1080px) {
		.layout {
			display: block;
		}
		.infobox {
			margin: 16px 0 4px;
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr));
			align-items: start;
		}
	}

	/* ---------- main column ---------- */
	.applies {
		font-size: 11px;
		color: var(--ink-2);
		max-width: 340px;
	}
	.itembox {
		display: grid;
		gap: 8px;
	}
	.itemfacts {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		font-size: 12.5px;
	}
	.itemfacts a {
		font-family: var(--mono);
		font-size: 11px;
	}
	.mods {
		margin: 0;
		padding-left: 18px;
	}
	.mods li {
		font-family: var(--mono);
		font-size: 11.5px;
		color: var(--ink-2);
	}
	.mods .scope {
		color: var(--ink-3);
		margin-left: 0.4em;
	}
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
