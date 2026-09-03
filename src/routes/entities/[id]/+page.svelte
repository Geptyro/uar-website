<script lang="ts">
	import { unitById, tagClass, applyText, damageNotes } from '$lib/units';
	import { mosById, mosHref, items, allowedLabel } from '$lib/mos';
	import { roleLabel, type RefRole } from '$lib/refs';
	import FactsCard, { type Fact } from '$lib/components/FactsCard.svelte';
	import ModelCard from '$lib/components/ModelCard.svelte';
	import AbilityCards from '$lib/components/mos/AbilityCards.svelte';
	import DescCard from '$lib/components/DescCard.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { entityCardUrl, unitDescription } from '$lib/seo';
	import { displayName } from '$lib/ogcard';
	import { Page } from 'sveltekit-commons';

	let { data } = $props();

	const unit = $derived(data.unit);
	const children = $derived(data.children);
	const models = $derived(data.models);
	const abilities = $derived(data.abilities);
	const refs = $derived(data.refs);

	const ROLE_CLASS: Record<RefRole, string> = {
		spawns: 't-item',
		event: 't-mos',
		removes: 't-hostile',
		uses: 't-other'
	};

	/** The item behind this unit: the pickup's own item, or the one that deploys into it. */
	const item = $derived(
		items.find((i) => (i.unit ?? i.id) === unit.id) ?? items.find((i) => i.deploys === unit.id)
	);
	const pickups = $derived(data.pickups);

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
		{ icon: 'type', label: 'Source', value: unit.src.replace('+', ' + '), mono: true } as Fact,
		...(pickups.length
			? [
					{
						icon: 'type',
						label: 'Carried as',
						value: pickups.map((p) => p.id).join(', '),
						mono: true
					} as Fact
				]
			: [])
	]);
</script>

<Page>
	<Seo
		title={displayName(unit.name) || unit.id}
		description={unitDescription(unit)}
		image={entityCardUrl(unit.id)}
	/>

	<div class="layout">
		<div class="main">
			{#if item}
				<h2 class="section">Item effects</h2>
				<div class="itembox">
					<div class="itemfacts">
						<span class="tag t-item">{item.type}</span>
						{#if item.charges}<span class="mono dim">charges {item.charges.start ?? '?'}/{item.charges.max}</span>{/if}
						{#if item.allowed !== null}<span class="tag t-mos">{allowedLabel(item)}</span>{/if}
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

			{#if abilities.length}
				<h2 class="section">Abilities</h2>
				<AbilityCards
					items={abilities}
					stats={Object.fromEntries(abilities.filter((a) => a.rows).map((a) => [a.id, a.rows!]))}
					anchor="abil"
				/>
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
								<th>Notes</th>
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
									<td class="mono applies">
										{[...damageNotes(w), ...(w.applies ?? []).map(applyText)].join(' · ')}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<p class="note footnote">
					Damage is the direct hit, before the roll on top and the target's armor. The notes
					column carries what else the shot does, read from its effect tree: the roll, armor it
					bypasses, splash rings as a share of the damage within a radius, and damage on other
					branches such as an upgrade's rounds.
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

			{#if refs.length}
				<h2 class="section">In the script</h2>
				<p class="note">
					Every trigger of the map's script that names this unit, read from the Galaxy source:
					what makes the trigger fire and what it does with the unit. Names link to the mission
					flow graph when the trigger is part of it.
				</p>
				<div class="tablewrap">
					<table class="data" style="min-width: 560px">
						<thead>
							<tr>
								<th>Trigger</th>
								<th>Fires when</th>
								<th>Does</th>
							</tr>
						</thead>
						<tbody>
							{#each refs as r (r.id)}
								<tr>
									<td>
										{#if r.flow}<a href="/flow?t={r.id}">{r.name}</a>{:else}{r.name}{/if}
										{#if r.via}<span class="via">via <code>{r.via}</code></span>{/if}
									</td>
									<td class="when">
										{#each r.when as w, i (w)}{#if i > 0}<br />{/if}{w}{/each}
									</td>
									<td class="roles">
										{#each r.roles as role (role)}<span class="tag {ROLE_CLASS[role]}">{roleLabel[role]}</span>{/each}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

		<aside class="infobox">
			<FactsCard
				portrait={unit.icon}
				title={unit.name || unit.id}
				chip={unit.mos ? `MOS ${unit.mos}` : unit.name && unit.name !== unit.id ? unit.id : null}
				{facts}
				link={mosById.has(unit.id) ? { href: mosHref(unit.id), label: 'Class page →' } : null}
			>
				{#snippet tags()}
					<span class="tag {tagClass(unit.category)}">{unit.category}</span>
				{/snippet}
			</FactsCard>
			{#if models.length}
				<ModelCard variants={models} alt="3D model of {unit.name || unit.id}" />
			{/if}
			{#if unit.tooltip}
				<DescCard label="In-game description" text={unit.tooltip} />
			{/if}
		</aside>
	</div>
</Page>

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
	.via {
		display: block;
		font-size: 11px;
		color: var(--text-faint);
	}
	.via code {
		font-size: 10.5px;
	}
	.when {
		font-size: 12px;
		color: var(--text-dim);
	}
	.roles {
		white-space: nowrap;
	}
	.roles .tag + .tag {
		margin-left: 4px;
	}
	.applies {
		font-size: 11px;
		color: var(--text-dim);
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
	.mods {
		margin: 0;
		padding-left: 18px;
	}
	.mods li {
		font-family: var(--font-mono);
		font-size: 11.5px;
		color: var(--text-dim);
	}
	.mods .scope {
		color: var(--text-faint);
		margin-left: 0.4em;
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
		color: var(--text-faint);
		font-size: 12px;
	}
</style>
