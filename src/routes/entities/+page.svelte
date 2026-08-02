<script lang="ts">
	import { page } from '$app/state';
	import { units, categories, tagClass, weaponLabel, type Unit } from '$lib/units';
	import Seo from '$lib/components/Seo.svelte';
	import { Page } from 'sveltekit-commons';

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

<Page fill>
	<Seo
		title="All entities"
		description="All {units.length} entities extracted from Undead Assault Reborn — player classes, undead, items, deployables, projectiles and props — with stats, weapons and lineage."
	/>

	<div class="datapage">
		<div class="dtools">
			<input
				type="search"
				placeholder="Search name, id, weapon…"
				aria-label="Search entities"
				bind:value={query}
			/>
			<div class="chips">
				{#each categories as cat (cat)}
					<button class="chip" aria-pressed={activeCats.has(cat)} onclick={() => toggleCat(cat)}>
						{cat}
					</button>
				{/each}
			</div>
			<span class="rowcount right">{filtered.length} / {units.length}</span>
		</div>

		<div class="tablewrap rows">
			<table class="data" style="min-width: 980px">
				<thead>
					<tr>
						<th class="num">#</th>
						{#each columns as col (col.key)}
							<th class:num={col.num} class="sortable">
								<button type="button" onclick={() => setSort(col.key)}>
									{col.label}
									<span class="dir">{sortKey === col.key ? (sortDir > 0 ? '↑' : '↓') : ''}</span>
								</button>
							</th>
						{/each}
						<th>Weapons (dmg · range · period)</th>
					</tr>
				</thead>
				<tbody>
					{#each filtered as u, i (u.id)}
						<tr>
							<td class="num rownum">{i + 1}</td>
							<td class="namecell">
								{#if u.icon}<img class="row-icon" src={u.icon} alt="" loading="lazy" />{/if}
								<a href="/entities/{u.id}">{u.name || '—'}</a>
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
	</div>
</Page>

<style>
	/* the page shape — toolbar put, rows scrolling, full-bleed table — is
	   .datapage in the layout, shared with /players */
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
