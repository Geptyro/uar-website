<script lang="ts">
	/**
	 * AO Thalim: every named trigger region of the map, by kind, and for each
	 * one the trigger groups whose triggers name it. Click a region on the
	 * map or in the list to see who uses it; the map pans and zooms, and
	 * the names appear as you look closer.
	 */
	import {
		mapRegions,
		regionCategory,
		regionSizeLabel,
		regionCenter,
		categoryTones,
		type MapRegion,
		type RegionCategory
	} from '$lib/map';
	import { AoMap, Area, Rect, type MapLegendEntry } from '$lib/components/map';
	import { GROUP_TYPES, groupHref } from '$lib/groups';
	import Seo from '$lib/components/Seo.svelte';
	import { Page } from 'sveltekit-commons';

	let { data } = $props();

	const categories = (
		['landing zone', 'objective site', 'cache', 'defense', 'settlement', 'other'] as RegionCategory[]
	).filter((c) => mapRegions.some((r) => regionCategory(r) === c));
	const countOf = (c: RegionCategory) => mapRegions.filter((r) => regionCategory(r) === c).length;

	let active = $state<Set<RegionCategory>>(
		new Set(['landing zone', 'objective site', 'cache', 'defense', 'settlement'])
	);
	let hovered = $state<number | null>(null);
	let selected = $state<number | null>(null);
	let query = $state('');

	const regionById = new Map(mapRegions.map((r) => [r.id, r]));

	function area(r: MapRegion): number {
		if (r.type === 'rect') return ((r.x2 ?? 0) - (r.x1 ?? 0)) * ((r.y2 ?? 0) - (r.y1 ?? 0));
		if (r.type === 'circle') return Math.PI * (r.r ?? 0) ** 2;
		return ((r.w ?? 0) * (r.h ?? 0)) / 2;
	}

	// large regions first so small ones render on top and stay clickable
	const visible = $derived(
		mapRegions
			.filter((r) => {
				const cat = regionCategory(r);
				if (cat === 'boundary') return false;
				if (!active.has(cat) && selected !== r.id) return false;
				if (query && !r.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
				return true;
			})
			.sort((a, b) => area(b) - area(a))
	);
	const selectedRegion = $derived(selected !== null ? (regionById.get(selected) ?? null) : null);
	const uses = $derived(selectedRegion ? (data.uses[selectedRegion.id] ?? []) : []);
	const legend = $derived<MapLegendEntry[]>(
		categories
			.filter((c) => active.has(c))
			.map((c) => ({ tone: categoryTones[c], shape: 'ring', label: c }))
	);
	const typeLabel = (t: string) => GROUP_TYPES.find((x) => x.type === t)?.label ?? t;

	function toggle(cat: RegionCategory) {
		const next = new Set(active);
		if (next.has(cat)) next.delete(cat);
		else next.add(cat);
		active = next;
	}
	function pick(id: number) {
		selected = selected === id ? null : id;
	}
	/** the name shows when the map is looked at closely, or when the region is the one in hand */
	const labelFrom = (r: MapRegion) => (hovered === r.id || selected === r.id ? 1 : 2.5);
</script>

<Page>
	<Seo
		title="Map"
		description="AO Thalim mapped: every named trigger region of Undead Assault Reborn by kind, and for each one the missions and mechanics whose triggers use it, read from the map file."
	/>

	<p class="note">
		AO Thalim with its {mapRegions.length} named trigger regions, by kind, read from the map file. Click one to
		see which <a href="/triggers">trigger groups</a> name it; zoom in and the names come up.
	</p>

	<div class="layout">
		<section class="map-panel">
			<div class="map-controls">
				{#each categories as cat (cat)}
					<button class="chip t-{categoryTones[cat]}" aria-pressed={active.has(cat)} onclick={() => toggle(cat)}>
						<span class="dot"></span>
						{cat} · {countOf(cat)}
					</button>
				{/each}
				<input type="search" placeholder="Find region…" aria-label="Find region" bind:value={query} />
			</div>

			<AoMap alt="AO Thalim with its named regions" {legend}>
				{#each visible as r (r.id)}
					{@const tone = categoryTones[regionCategory(r)]}
					{@const used = data.uses[r.id] ?? []}
					{@const state = {
						tone,
						label: r.name,
						info: {
							title: r.name,
							kind: `${regionCategory(r)} region`,
							lines: [
								`${r.type}, ${regionSizeLabel(r)} at ${Math.round(regionCenter(r).x)},${Math.round(regionCenter(r).y)}`,
								used.length ? `used by ${used.map((u) => u.name).join(', ')}` : 'no trigger with a page names it'
							]
						},
						labelFrom: labelFrom(r),
						hot: hovered === r.id,
						on: selected === r.id,
						faint: selected !== null && selected !== r.id && hovered !== r.id,
						onpick: () => pick(r.id),
						onenter: () => (hovered = r.id),
						onleave: () => {
							if (hovered === r.id) hovered = null;
						}
					}}
					{#if r.type === 'rect'}
						<Rect x1={r.x1!} y1={r.y1!} x2={r.x2!} y2={r.y2!} {...state} />
					{:else if r.type === 'circle'}
						<Area x={r.cx!} y={r.cy!} r={r.r!} {...state} />
					{:else}
						<Area {...regionCenter(r)} r={Math.max(r.w ?? 1, r.h ?? 1) / 2} {...state} />
					{/if}
				{/each}
			</AoMap>

			<div class="region-list">
				{#each visible as r (r.id)}
					<button
						class="region-pill t-{categoryTones[regionCategory(r)]}"
						class:hl={hovered === r.id}
						class:sel={selected === r.id}
						onpointerenter={() => (hovered = r.id)}
						onpointerleave={() => (hovered = null)}
						onclick={() => pick(r.id)}
					>
						{r.name}
					</button>
				{/each}
			</div>
		</section>

		<section class="side">
			{#if selectedRegion}
				{@const cat = regionCategory(selectedRegion)}
				{@const c = regionCenter(selectedRegion)}
				<div class="card region t-{categoryTones[cat]}">
					<div class="head">
						<b>{selectedRegion.name}</b>
						<button class="chip" onclick={() => (selected = null)}>clear ✕</button>
					</div>
					<div class="meta">
						{cat} · {selectedRegion.type} · {regionSizeLabel(selectedRegion)} · at {Math.round(c.x)},{Math.round(
							c.y
						)}
					</div>
					<h2 class="section">Used by</h2>
					{#if uses.length}
						<ul class="uses">
							{#each uses as u (u.id)}
								<li>
									<a href={groupHref(u.id)}>{u.name}</a>
									<span class="kind k-{u.type}">{typeLabel(u.type)}</span>
									<span class="trig">{u.triggers.join(' · ')}</span>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="dim">No trigger with a page names this region. The script may still use it from a helper.</p>
					{/if}
				</div>
			{:else}
				<div class="card hint">
					<p class="dim">
						Click a region on the map or in the list to see the missions and mechanics that use it.
					</p>
					<p class="dim">
						Kinds are read from the names the map's author gave the regions; "other" holds the {countOf('other')}
						unnamed-looking ones (spawn points, routes, waypoints) and is off by default.
					</p>
				</div>
			{/if}
		</section>
	</div>
</Page>

<style>
	.layout {
		display: grid;
		grid-template-columns: minmax(420px, 1.3fr) minmax(min(320px, 100%), 1fr);
		gap: 28px;
		align-items: start;
	}
	@media (max-width: 1100px) {
		.layout {
			display: block;
		}
		.side {
			margin-top: 26px;
		}
	}

	/* the same tones the markers wear, on the chips, the pills and the card */
	.t-accent {
		--tone: var(--accent);
	}
	.t-item {
		--tone: var(--item);
	}
	.t-mos {
		--tone: var(--mos);
	}
	.t-hostile {
		--tone: var(--hostile);
	}
	.t-gold {
		--tone: var(--gold);
	}
	.t-warn {
		--tone: var(--warn);
	}
	.t-lobby {
		--tone: var(--lobby);
	}

	.map-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 7px;
		margin-bottom: 12px;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.chip .dot {
		width: 8px;
		height: 8px;
		border-radius: 99px;
		display: inline-block;
		background: var(--tone);
	}
	.chip[aria-pressed='true'] {
		background: color-mix(in srgb, var(--tone) 18%, transparent);
		border-color: var(--tone);
		color: var(--text);
	}
	.map-controls input {
		margin-left: auto;
		width: 160px;
		padding: 6px 11px;
		font-size: 12.5px;
	}

	.region-list {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		margin-top: 12px;
	}
	.region-pill {
		font: 500 11px/1 var(--font-mono);
		color: var(--text-dim);
		background: var(--surface);
		border: 1px solid var(--border);
		border-left: 3px solid var(--tone);
		border-radius: var(--radius-2);
		padding: 5px 9px;
		cursor: pointer;
	}
	.region-pill.hl,
	.region-pill:hover {
		background: var(--surface-raised);
		color: var(--text);
	}
	.region-pill.sel {
		background: var(--tone);
		color: var(--accent-contrast);
		border-color: var(--tone);
	}

	.region {
		border-left: 3px solid var(--tone);
	}
	.head {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.head b {
		font-size: 15px;
		font-weight: 650;
	}
	.head .chip {
		margin-left: auto;
		padding: 4px 10px;
	}
	.meta {
		font-family: var(--font-mono);
		font-size: 10.5px;
		color: var(--text-faint);
		margin-top: 4px;
	}
	.region :global(h2.section) {
		margin-top: 14px;
	}
	.uses {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.uses li {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 8px;
		font-size: 13px;
	}
	.uses a {
		font-weight: 600;
	}
	.trig {
		flex-basis: 100%;
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--text-faint);
	}
	.kind {
		font-family: var(--font-mono);
		font-size: 9px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		padding: 1px 6px;
		border-radius: var(--radius-2);
		border: 1px solid var(--k, var(--border-strong));
		color: var(--k, var(--text-dim));
	}
	.k-mission {
		--k: var(--accent);
	}
	.k-mechanic {
		--k: var(--mos);
	}
	.k-event {
		--k: var(--gold);
	}
	.k-world {
		--k: var(--item);
	}
	.dim {
		font-size: 12.5px;
		line-height: 1.5;
		color: var(--text-dim);
		margin: 0;
	}
	.hint p + p {
		margin-top: 8px;
	}
</style>
