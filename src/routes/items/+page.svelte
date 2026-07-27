<script lang="ts">
	import {
		items,
		mosList,
		allowedLabel,
		itemTypeLabels,
		itemTypeOrder,
		sourceLabel,
		type Item,
		type ItemType
	} from '$lib/mos';
	import { applyText } from '$lib/units';

	let query = $state('');
	let mosFilter = $state('');
	let typeFilter = $state<ItemType | ''>('');
	let expanded = $state<string | null>(null);

	// null = the order the game data comes in, which groups related pickups;
	// a click on a header takes over from there
	type SortKey = 'name' | 'type' | 'charges';
	let sortKey = $state<SortKey | null>(null);
	let sortDir = $state(1);

	function setSort(key: SortKey) {
		if (sortKey === key) sortDir *= -1;
		else {
			sortKey = key;
			sortDir = 1;
		}
	}

	// charges come through as strings, and plenty of items have none
	function chargeCount(i: Item): number {
		const max = Number(i.charges?.max);
		return Number.isFinite(max) ? max : -Infinity;
	}

	const filtered = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		const out = items.filter((i) => {
			if (typeFilter && i.type !== typeFilter) return false;
			if (mosFilter && i.allowed !== null && !i.allowed.includes(mosFilter)) return false;
			if (!needle) return true;
			const hay = `${i.name} ${i.id} ${i.mods.map((m) => m.text).join(' ')} ${i.tooltip}`.toLowerCase();
			return hay.includes(needle);
		});
		if (sortKey === 'charges') {
			out.sort((a, b) => (chargeCount(a) - chargeCount(b)) * sortDir || a.name.localeCompare(b.name));
		} else if (sortKey) {
			const key = sortKey;
			out.sort(
				(a, b) => String(a[key]).localeCompare(String(b[key])) * sortDir || a.name.localeCompare(b.name)
			);
		}
		return out;
	});

	const columns: { key: SortKey; label: string; num?: boolean }[] = [
		{ key: 'name', label: 'Item' },
		{ key: 'type', label: 'Type' },
		{ key: 'charges', label: 'Charges', num: true }
	];
</script>

<svelte:head>
	<title>Items — UAR Unit Database</title>
</svelte:head>

<div class="datapage">
	<p class="note">
		Pickups, ammunition and carry equipment. Stat effects come from each item's carry-buff; who can
		use each item is derived from its validators. Click a description to expand it.
	</p>

	<div class="dtools">
		<input type="search" placeholder="Search items…" aria-label="Search items" bind:value={query} />
		<div class="chips">
			{#each itemTypeOrder as t (t)}
				<button
					class="chip"
					aria-pressed={typeFilter === t}
					onclick={() => (typeFilter = typeFilter === t ? '' : t)}
				>
					{itemTypeLabels[t]}
				</button>
			{/each}
		</div>
		<select bind:value={mosFilter} aria-label="Filter by class usability">
			<option value="">Usable by anyone…</option>
			{#each mosList as m (m.id)}
				<option value={m.id}>usable by {m.name}</option>
			{/each}
		</select>
		<span class="rowcount right">{filtered.length} / {items.length}</span>
	</div>

	<div class="tablewrap rows">
		<table class="data" style="min-width: 960px">
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
					<th>Effects</th>
					<th>Classes</th>
					<th>Conflicts</th>
					<th>Description</th>
				</tr>
			</thead>
			<tbody>
				{#each filtered as item, i (item.id)}
					<tr id={item.id} class="itemrow">
						<td class="num rownum">{i + 1}</td>
						<td class="namecell">
							{#if item.icon}
								<img class="item-icon" src={item.icon} alt="" loading="lazy" />
							{:else}
								<span class="item-icon placeholder"></span>
							{/if}
							{#if item.unit}
								<a href="/entities/{item.unit}">{item.name}</a>
							{:else}
								<span>{item.name}</span>
							{/if}
							{#if !item.playable}<span class="tag t-hostile">NPC only</span>{/if}
						</td>
						<td>
							<span class="tag t-item">{item.type}</span>
							{#if item.playable && sourceLabel(item)}
								<span class="tag t-mos">{sourceLabel(item)}</span>
							{/if}
						</td>
						<td class="num">{item.charges ? `${item.charges.start ?? '?'}/${item.charges.max}` : ''}</td>
						<td class="mono effects">
							{#each item.mods as m (m.text + (m.note ?? ''))}
								<div>{m.text}{#if m.note}<span class="scope">({m.note})</span>{/if}</div>
							{/each}
							{#each item.grants as g (g.id)}
								<div class="grant">
									grants {g.id}: {g.dmg ?? '?'} dmg · rng {g.range ?? '?'} · {g.period ?? '?'}s
								</div>
								{#each g.applies ?? [] as a (a.name + (a.cond ?? ''))}
									<div class="grant">{applyText(a)}</div>
								{/each}
							{/each}
						</td>
						<td class="classes">
							{#if item.allowed !== null}{allowedLabel(item)}{:else}<span class="dim">everyone</span
								>{/if}
						</td>
						<td class="mono conflicts">{item.conflicts.join(' · ')}</td>
						<td
							class="desc"
							class:open={expanded === item.id}
							onclick={() => (expanded = expanded === item.id ? null : item.id)}
						>
							{item.tooltip}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
	/* the page shape — toolbar put, rows scrolling, full-bleed table — is
	   .datapage in the layout, shared with /players and /entities */
	.note {
		margin: 0 0 12px;
		max-width: 84ch;
	}

	.itemrow {
		scroll-margin-top: 80px;
	}
	.namecell {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 170px;
	}
	.namecell a {
		font-weight: 600;
		text-decoration: none;
		color: inherit;
	}
	.namecell a:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.item-icon {
		width: 24px;
		height: 24px;
		object-fit: cover;
		border-radius: var(--r-sm);
		flex-shrink: 0;
	}
	.item-icon.placeholder {
		display: inline-block;
		background: var(--surface-2);
	}
	.effects {
		font-size: 11.5px;
		color: var(--ink-2);
		min-width: 180px;
	}
	.effects .scope {
		color: var(--ink-3);
		margin-left: 0.4em;
	}
	.effects .grant {
		color: var(--ink-3);
	}
	.classes {
		font-size: 12px;
		max-width: 180px;
	}
	.conflicts {
		font-size: 11px;
		color: var(--ink-3);
		max-width: 170px;
	}
	.dim {
		color: var(--ink-3);
	}
	.desc {
		font-size: 11.5px;
		color: var(--ink-2);
		max-width: 300px;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		cursor: pointer;
	}
	.desc.open {
		display: block;
		-webkit-line-clamp: unset;
		line-clamp: unset;
		white-space: pre-line;
	}
</style>
