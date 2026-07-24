<script lang="ts">
	import {
		missions,
		mapSize,
		mapRegions,
		regionCategory,
		regionSizeLabel,
		regionCenter,
		relatedMissions,
		categoryColors,
		type MapRegion,
		type RegionCategory
	} from '$lib/map';

	const categories = (
		['landing zone', 'objective site', 'cache', 'defense', 'settlement', 'other'] as RegionCategory[]
	).filter((c) => mapRegions.some((r) => regionCategory(r) === c));

	let active = $state<Set<RegionCategory>>(
		new Set(['landing zone', 'objective site', 'cache', 'defense', 'settlement'])
	);
	let hovered = $state<number | null>(null);
	let selected = $state<number | null>(null);
	let tipPos = $state({ x: 0, y: 0 });
	let mapFrame = $state<HTMLElement | null>(null);
	let regionQuery = $state('');
	let missionQuery = $state('');

	const regionById = new Map(mapRegions.map((r) => [r.id, r]));
	// precompute related missions once — heuristic name matching
	const related = new Map(mapRegions.map((r) => [r.id, relatedMissions(r)]));

	function area(r: MapRegion): number {
		if (r.type === 'rect') return ((r.x2 ?? 0) - (r.x1 ?? 0)) * ((r.y2 ?? 0) - (r.y1 ?? 0));
		if (r.type === 'circle') return Math.PI * (r.r ?? 0) ** 2;
		return ((r.w ?? 0) * (r.h ?? 0)) / 2;
	}

	// large regions first so small ones render on top and stay hoverable
	const visible = $derived(
		mapRegions
			.filter((r) => {
				const cat = regionCategory(r);
				if (cat === 'boundary') return false;
				if (!active.has(cat) && selected !== r.id) return false;
				if (regionQuery && !r.name.toLowerCase().includes(regionQuery.trim().toLowerCase()))
					return false;
				return true;
			})
			.sort((a, b) => area(b) - area(a))
	);

	const hoveredRegion = $derived(hovered !== null ? (regionById.get(hovered) ?? null) : null);
	const selectedRegion = $derived(selected !== null ? (regionById.get(selected) ?? null) : null);

	const filteredMissions = $derived.by(() => {
		if (selectedRegion) return related.get(selectedRegion.id) ?? [];
		if (!missionQuery) return missions;
		const q = missionQuery.trim().toLowerCase();
		return missions.filter(
			(m) =>
				m.name.toLowerCase().includes(q) || m.triggers.some((t) => t.toLowerCase().includes(q))
		);
	});

	function toggle(cat: RegionCategory) {
		const next = new Set(active);
		if (next.has(cat)) next.delete(cat);
		else next.add(cat);
		active = next;
	}

	function selectRegion(id: number) {
		selected = selected === id ? null : id;
	}

	function onMove(e: MouseEvent) {
		if (!mapFrame) return;
		const rect = mapFrame.getBoundingClientRect();
		tipPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
	}

	// game coords have origin bottom-left; SVG top-left
	const flip = (y: number) => mapSize - y;
</script>

<svelte:head>
	<title>Map & missions — UAR Unit Database</title>
</svelte:head>

<p class="note">
	AO Thalim with the {mapRegions.length} named trigger regions extracted from the map file, and the
	{missions.length} mission outcomes found in the trigger script with their XP rewards. Region
	positions are exact; mission links are matched by name and are indicative. Click a marker to
	filter the missions panel.
</p>

<div class="layout">
	<section class="map-panel">
		<div class="map-controls">
			{#each categories as cat (cat)}
				<button class="chip" aria-pressed={active.has(cat)} onclick={() => toggle(cat)}>
					<span class="dot" style="background: {categoryColors[cat]}"></span>
					{cat}
				</button>
			{/each}
			<input
				type="search"
				placeholder="Find region…"
				aria-label="Find region"
				bind:value={regionQuery}
			/>
		</div>

		<div
			class="map-frame card"
			bind:this={mapFrame}
			onmousemove={onMove}
			role="presentation"
		>
			<svg viewBox="0 0 {mapSize} {mapSize}" role="img" aria-label="AO Thalim map">
				<image href="/map/minimap.png" width={mapSize} height={mapSize} />
				{#each visible as r (r.id)}
					{@const cat = regionCategory(r)}
					{@const color = categoryColors[cat]}
					{#if r.type === 'rect'}
						<rect
							x={r.x1}
							y={flip(r.y2 ?? 0)}
							width={(r.x2 ?? 0) - (r.x1 ?? 0)}
							height={(r.y2 ?? 0) - (r.y1 ?? 0)}
							fill={color}
							stroke={color}
							class="shape"
							class:hl={hovered === r.id}
							class:sel={selected === r.id}
							onmouseenter={() => (hovered = r.id)}
							onmouseleave={() => (hovered = null)}
							onclick={() => selectRegion(r.id)}
							role="button"
							tabindex="-1"
							onkeydown={(e) => e.key === 'Enter' && selectRegion(r.id)}
						/>
					{:else if r.type === 'circle'}
						<circle
							cx={r.cx}
							cy={flip(r.cy ?? 0)}
							r={r.r}
							fill={color}
							stroke={color}
							class="shape"
							class:hl={hovered === r.id}
							class:sel={selected === r.id}
							onmouseenter={() => (hovered = r.id)}
							onmouseleave={() => (hovered = null)}
							onclick={() => selectRegion(r.id)}
							role="button"
							tabindex="-1"
							onkeydown={(e) => e.key === 'Enter' && selectRegion(r.id)}
						/>
					{:else}
						<polygon
							points="{r.cx},{flip((r.cy ?? 0) + (r.h ?? 0) / 2)} {(r.cx ?? 0) +
								(r.w ?? 0) / 2},{flip(r.cy ?? 0)} {r.cx},{flip(
								(r.cy ?? 0) - (r.h ?? 0) / 2
							)} {(r.cx ?? 0) - (r.w ?? 0) / 2},{flip(r.cy ?? 0)}"
							fill={color}
							stroke={color}
							class="shape"
							class:hl={hovered === r.id}
							class:sel={selected === r.id}
							onmouseenter={() => (hovered = r.id)}
							onmouseleave={() => (hovered = null)}
							onclick={() => selectRegion(r.id)}
							role="button"
							tabindex="-1"
							onkeydown={(e) => e.key === 'Enter' && selectRegion(r.id)}
						/>
					{/if}
				{/each}
			</svg>

			{#if hoveredRegion}
				{@const cat = regionCategory(hoveredRegion)}
				{@const rel = related.get(hoveredRegion.id) ?? []}
				{@const c = regionCenter(hoveredRegion)}
				<div
					class="tip"
					style="left: {tipPos.x}px; top: {tipPos.y}px; --c: {categoryColors[cat]}"
				>
					<div class="tip-head">
						<b>{hoveredRegion.name}</b>
						<span class="tip-cat">{cat}</span>
					</div>
					<div class="tip-meta">
						{hoveredRegion.type} · {regionSizeLabel(hoveredRegion)} · at {Math.round(c.x)},{Math.round(
							c.y
						)}
					</div>
					{#if rel.length}
						<div class="tip-label">Related missions</div>
						<ul class="tip-missions">
							{#each rel.slice(0, 4) as m (m.name)}
								<li>
									<span class="tip-xp">{m.xp.length ? `+${m.xp.join('/')}` : `−${m.fail.join('/')}`}</span>
									{m.name}
								</li>
							{/each}
							{#if rel.length > 4}<li class="tip-more">+{rel.length - 4} more — click to filter</li>{/if}
						</ul>
					{:else}
						<div class="tip-meta dim">no mission matched by name</div>
					{/if}
				</div>
			{/if}
		</div>

		<div class="region-list">
			{#each visible as r (r.id)}
				<button
					class="region-pill"
					class:hl={hovered === r.id}
					class:sel={selected === r.id}
					style="--c: {categoryColors[regionCategory(r)]}"
					onmouseenter={() => (hovered = r.id)}
					onmouseleave={() => (hovered = null)}
					onclick={() => selectRegion(r.id)}
				>
					{r.name}
				</button>
			{/each}
		</div>
	</section>

	<section class="missions-panel">
		<h2 class="section">
			Missions · {filteredMissions.length}
		</h2>
		{#if selectedRegion}
			<div class="filter-banner">
				Missions matching <b>{selectedRegion.name}</b>
				<button class="chip" onclick={() => (selected = null)}>clear ✕</button>
			</div>
		{:else}
			<input
				class="mission-search"
				type="search"
				placeholder="Search missions…"
				aria-label="Search missions"
				bind:value={missionQuery}
			/>
		{/if}
		<div class="tablewrap">
			<table class="data">
				<thead>
					<tr>
						<th>Outcome</th>
						<th class="num">XP</th>
						<th class="num">Fail</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredMissions as m (m.name)}
						<tr>
							<td>
								{m.name}
								{#if m.triggers.length}
									<div class="trig">{m.triggers.join(' · ')}</div>
								{/if}
							</td>
							<td class="num gain">{m.xp.length ? '+' + m.xp.join('/') : ''}</td>
							<td class="num loss">{m.fail.length ? '−' + m.fail.join('/') : ''}</td>
						</tr>
					{:else}
						<tr><td colspan="3" class="empty">No missions matched.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</div>

<style>
	.layout {
		display: grid;
		grid-template-columns: minmax(420px, 1.2fr) minmax(360px, 1fr);
		gap: 28px;
		align-items: start;
	}
	@media (max-width: 1100px) {
		.layout {
			display: block;
		}
		.missions-panel {
			margin-top: 26px;
		}
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
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 99px;
		display: inline-block;
	}
	.map-controls input {
		margin-left: auto;
		width: 160px;
		padding: 6px 11px;
		font-size: 12.5px;
	}

	.map-frame {
		position: relative;
		padding: 0;
		overflow: hidden;
	}
	svg {
		display: block;
		width: 100%;
		height: auto;
	}
	.shape {
		fill-opacity: 0.28;
		stroke-width: 0.6;
		stroke-opacity: 0.9;
		cursor: pointer;
		transition: fill-opacity 100ms ease;
		outline: none;
	}
	.shape:hover,
	.shape.hl {
		fill-opacity: 0.55;
		stroke-width: 1;
	}
	.shape.sel {
		fill-opacity: 0.6;
		stroke-width: 1.4;
		stroke: #fff;
	}

	/* hover tooltip */
	.tip {
		position: absolute;
		transform: translate(14px, 10px);
		max-width: 280px;
		background: color-mix(in srgb, var(--surface) 94%, transparent);
		backdrop-filter: blur(6px);
		border: 1px solid var(--border-strong);
		border-left: 3px solid var(--c);
		border-radius: var(--r-sm);
		box-shadow: var(--shadow-2);
		padding: 9px 12px;
		pointer-events: none;
		z-index: 10;
	}
	.tip-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
	}
	.tip-head b {
		font-size: 13px;
		font-weight: 650;
	}
	.tip-cat {
		font-family: var(--mono);
		font-size: 9.5px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--c);
		white-space: nowrap;
	}
	.tip-meta {
		font-family: var(--mono);
		font-size: 10px;
		color: var(--ink-3);
		margin-top: 2px;
	}
	.tip-meta.dim {
		margin-top: 6px;
	}
	.tip-label {
		font-family: var(--mono);
		font-size: 9.5px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-3);
		margin: 8px 0 3px;
	}
	.tip-missions {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.tip-missions li {
		font-size: 12px;
		line-height: 1.5;
		color: var(--ink-2);
	}
	.tip-xp {
		font-family: var(--mono);
		font-size: 10.5px;
		font-weight: 650;
		color: var(--accent);
		margin-right: 4px;
	}
	.tip-more {
		font-family: var(--mono);
		font-size: 10px;
		color: var(--ink-3);
	}

	.region-list {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		margin-top: 12px;
	}
	.region-pill {
		font: 500 11px/1 var(--mono);
		color: var(--ink-2);
		background: var(--surface);
		border: 1px solid var(--border);
		border-left: 3px solid var(--c);
		border-radius: var(--r-sm);
		padding: 5px 9px;
		cursor: pointer;
	}
	.region-pill.hl,
	.region-pill:hover {
		background: var(--surface-2);
		color: var(--ink);
	}
	.region-pill.sel {
		background: var(--accent);
		color: var(--on-accent);
		border-color: var(--accent);
	}

	.missions-panel :global(h2.section) {
		margin-top: 0;
	}
	.mission-search {
		width: 100%;
		margin-bottom: 12px;
	}
	.filter-banner {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 13px;
		color: var(--ink-2);
		background: var(--accent-soft);
		border: 1px solid var(--accent);
		border-radius: var(--r-sm);
		padding: 7px 12px;
		margin-bottom: 12px;
	}
	.filter-banner b {
		color: var(--ink);
	}
	.filter-banner .chip {
		margin-left: auto;
		padding: 4px 10px;
	}
	.trig {
		font-family: var(--mono);
		font-size: 10px;
		color: var(--ink-3);
		margin-top: 2px;
	}
	.gain {
		color: var(--accent);
		font-weight: 600;
	}
	.loss {
		color: var(--hostile);
	}
	.empty {
		color: var(--ink-3);
		text-align: center;
		padding: 20px;
	}
</style>
