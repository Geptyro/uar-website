<script lang="ts">
	import { page } from '$app/state';
	import { units, categories, tagClass, weaponLabel, type Unit } from '$lib/units';

	let query = $state('');
	let activeCats = $state<Set<string>>(new Set());
	let sortKey = $state<keyof Unit>('category');
	let sortDir = $state(1);

	// Seed filters from links: ?cat= (overview tiles) and ?q= (top-bar quick search).
	$effect(() => {
		const cat = page.url.searchParams.get('cat');
		if (cat && categories.includes(cat)) activeCats = new Set([cat]);
		const q = page.url.searchParams.get('q');
		if (q) query = q;
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
	<span class="count">{filtered.length} / {units.length}</span>
</div>

<div class="tablewrap">
	<table class="data" style="min-width: 940px">
		<thead>
			<tr>
				{#each columns as col (col.key)}
					<th class:num={col.num} class="sortable" onclick={() => setSort(col.key)}>
						{col.label}
						<span class="dir">{sortKey === col.key ? (sortDir > 0 ? '↑' : '↓') : ''}</span>
					</th>
				{/each}
				<th>Weapons (dmg · range · period)</th>
			</tr>
		</thead>
		<tbody>
			{#each filtered as u (u.id)}
				<tr>
					<td class="namecell">
						{#if u.icon}<img class="row-icon" src={u.icon} alt="" loading="lazy" />{/if}
						<a href="/units/{u.id}">{u.name || '—'}</a>
					</td>
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
	.controls {
		position: sticky;
		top: -26px;
		z-index: 5;
		background: var(--bg);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 7px;
		padding: 10px 0 12px;
	}
	input[type='search'] {
		width: 240px;
	}
	.count {
		margin-left: auto;
		font-family: var(--mono);
		font-size: 11.5px;
		color: var(--ink-3);
		font-variant-numeric: tabular-nums;
	}

	th.sortable {
		cursor: pointer;
		user-select: none;
	}
	th.sortable:hover {
		color: var(--ink);
	}
	.dir {
		color: var(--accent);
		font-size: 11px;
	}
	td.namecell {
		white-space: nowrap;
	}
	.row-icon {
		width: 20px;
		height: 20px;
		object-fit: cover;
		border-radius: 4px;
		vertical-align: -5px;
		margin-right: 7px;
	}
	td.wpns {
		min-width: 240px;
		overflow-wrap: anywhere;
	}
</style>
