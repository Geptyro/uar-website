<script lang="ts">
	import { page } from '$app/state';
	import { units, categories, tagClass, weaponLabel, type Unit } from '$lib/units';

	let query = $state('');
	let activeCats = $state<Set<string>>(new Set());
	let sortKey = $state<keyof Unit>('category');
	let sortDir = $state(1);

	// Seed the category filter from ?cat= links on the overview page.
	$effect(() => {
		const cat = page.url.searchParams.get('cat');
		if (cat && categories.includes(cat)) activeCats = new Set([cat]);
	});

	const numericKeys: (keyof Unit)[] = ['life', 'armor', 'speed', 'energy'];

	function toggleCat(cat: string) {
		const next = new Set(activeCats);
		if (next.has(cat)) next.delete(cat);
		else next.add(cat);
		activeCats = next;
	}

	function setSort(key: keyof Unit) {
		if (sortKey === key) sortDir *= -1;
		else {
			sortKey = key;
			sortDir = 1;
		}
	}

	const filtered = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		const out = units.filter((u) => {
			if (activeCats.size && !activeCats.has(u.category)) return false;
			if (!needle) return true;
			const hay = `${u.name} ${u.id} ${u.role} ${u.weapons.map((w) => w.id).join(' ')}`.toLowerCase();
			return hay.includes(needle);
		});
		const numeric = numericKeys.includes(sortKey);
		out.sort((a, b) => {
			if (numeric) {
				const x = (a[sortKey] as number | null) ?? -Infinity;
				const y = (b[sortKey] as number | null) ?? -Infinity;
				return (x - y) * sortDir;
			}
			const x = String(a[sortKey] ?? '');
			const y = String(b[sortKey] ?? '');
			return x.localeCompare(y) * sortDir || a.id.localeCompare(b.id);
		});
		return out;
	});

	const columns: { key: keyof Unit; label: string; num?: boolean }[] = [
		{ key: 'name', label: 'Name' },
		{ key: 'id', label: 'ID' },
		{ key: 'category', label: 'Category' },
		{ key: 'life', label: 'Life', num: true },
		{ key: 'armor', label: 'Armor', num: true },
		{ key: 'speed', label: 'Speed', num: true },
		{ key: 'energy', label: 'Energy', num: true }
	];
</script>

<svelte:head>
	<title>All units — UAR Unit Database</title>
</svelte:head>

<h1>All units</h1>

<div class="controls">
	<input
		type="search"
		placeholder="Search name, id, weapon…"
		aria-label="Search units"
		bind:value={query}
	/>
	{#each categories as cat (cat)}
		<button class="chip" aria-pressed={activeCats.has(cat)} onclick={() => toggleCat(cat)}>
			{cat}
		</button>
	{/each}
	<span class="count">{filtered.length} / {units.length} units</span>
</div>

<div class="tablewrap">
	<table>
		<thead>
			<tr>
				{#each columns as col (col.key)}
					<th class:num={col.num} onclick={() => setSort(col.key)}>
						{col.label}
						<span class="dir">{sortKey === col.key ? (sortDir > 0 ? '▲' : '▼') : ''}</span>
					</th>
				{/each}
				<th>Weapons (dmg · range · period)</th>
			</tr>
		</thead>
		<tbody>
			{#each filtered as u (u.id)}
				<tr>
					<td><a href="/units/{u.id}">{u.name || '—'}</a></td>
					<td class="mono">{u.id}</td>
					<td><span class="tag {tagClass(u.category)}">{u.category}</span></td>
					<td class="num">{u.life ?? ''}</td>
					<td class="num">{u.armor ?? ''}</td>
					<td class="num">{u.speed ?? ''}</td>
					<td class="num">{u.energy ?? ''}</td>
					<td class="mono wpns">{u.weapons.map(weaponLabel).join('; ')}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	h1 {
		margin: 0 0 14px;
		font-size: clamp(22px, 4vw, 28px);
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.controls {
		position: sticky;
		top: 0;
		z-index: 5;
		background: var(--paper);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		padding: 10px 0;
		border-bottom: 1px solid var(--line);
	}
	input[type='search'] {
		background: var(--panel);
		color: var(--ink);
		border: 1px solid var(--line);
		padding: 7px 12px;
		font: inherit;
		width: 230px;
	}
	.chip {
		background: var(--chip-bg);
		color: var(--ink);
		border: 1px solid var(--line);
		font: 12px/1 var(--mono);
		letter-spacing: 0.04em;
		padding: 7px 11px;
		cursor: pointer;
	}
	.chip[aria-pressed='true'] {
		background: var(--accent);
		color: var(--accent-ink);
		border-color: var(--accent);
	}
	.count {
		margin-left: auto;
		font-family: var(--mono);
		font-size: 12px;
		color: var(--ink-soft);
	}

	.tablewrap {
		overflow-x: auto;
		border: 1px solid var(--line);
		margin-top: 14px;
	}
	table {
		border-collapse: collapse;
		width: 100%;
		min-width: 900px;
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
		cursor: pointer;
		white-space: nowrap;
		user-select: none;
	}
	th .dir {
		color: var(--accent);
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
		overflow-wrap: anywhere;
	}
	td.wpns {
		min-width: 220px;
	}
	tr:hover td {
		background: color-mix(in srgb, var(--panel) 60%, transparent);
	}

	.tag {
		display: inline-block;
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.05em;
		padding: 2px 7px;
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
