<script lang="ts">
	import {
		items,
		mosList,
		mosName,
		mosPageId,
		itemTypeLabels,
		itemTypeOrder,
		type ItemType
	} from '$lib/mos';

	let query = $state('');
	let mosFilter = $state('');
	let typeFilter = $state<ItemType | ''>('');

	const filtered = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		return items.filter((i) => {
			if (typeFilter && i.type !== typeFilter) return false;
			if (mosFilter && i.allowed !== null && !i.allowed.includes(mosFilter)) return false;
			if (!needle) return true;
			const hay = `${i.name} ${i.id} ${i.mods.join(' ')} ${i.tooltip}`.toLowerCase();
			return hay.includes(needle);
		});
	});
</script>

<svelte:head>
	<title>Items — UAR Unit Database</title>
</svelte:head>

<p class="note">
	Pickups, ammunition and carry equipment. Stat effects come from each item's carry-buff; who can
	use each item is derived from its validators.
</p>

<div class="controls">
	<input type="search" placeholder="Search items…" aria-label="Search items" bind:value={query} />
	{#each itemTypeOrder as t (t)}
		<button
			class="chip"
			aria-pressed={typeFilter === t}
			onclick={() => (typeFilter = typeFilter === t ? '' : t)}
		>
			{itemTypeLabels[t]}
		</button>
	{/each}
	<select bind:value={mosFilter} aria-label="Filter by class usability">
		<option value="">Usable by anyone…</option>
		{#each mosList as m (m.id)}
			<option value={m.id}>usable by {m.name}</option>
		{/each}
	</select>
	<span class="count">{filtered.length} / {items.length}</span>
</div>

<div class="grid">
	{#each filtered as item (item.id)}
		<article class="card item" id={item.id}>
			<header>
				{#if item.icon}
					<img class="item-icon" src={item.icon} alt="" loading="lazy" />
				{:else}
					<span class="item-icon placeholder"></span>
				{/if}
				<h3>{item.name}</h3>
				<span class="tag t-item">{item.type}</span>
			</header>
			<div class="facts">
				{#if item.charges}<span>charges {item.charges.start ?? '?'}/{item.charges.max}</span>{/if}
				{#if item.unit}<a href="/units/{item.unit}">unit data</a>{/if}
			</div>
			{#if item.mods.length}
				<ul class="mods">
					{#each item.mods as m (m)}<li>{m}</li>{/each}
				</ul>
			{/if}
			{#if item.allowed !== null || item.conflicts.length}
				<div class="restr">
					{#if item.allowed !== null}
						{#each item.allowed as a (a)}
							{#if mosPageId(a)}
								<a class="tag t-mos" href="/mos/{mosPageId(a)}">{mosName(a)}</a>
							{:else}
								<span class="tag t-mos">{mosName(a)}</span>
							{/if}
						{/each}
					{/if}
					{#each item.conflicts as c (c)}
						<span class="tag t-hostile">{c}</span>
					{/each}
				</div>
			{/if}
			{#if item.tooltip}<p class="tip">{item.tooltip}</p>{/if}
		</article>
	{/each}
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
		gap: 8px;
		padding: 10px 0 12px;
		margin-bottom: 8px;
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

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 12px;
	}
	.item {
		scroll-margin-top: 80px;
		display: flex;
		flex-direction: column;
		gap: 7px;
	}
	.item header {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.item-icon {
		width: 32px;
		height: 32px;
		object-fit: cover;
		border-radius: var(--r-sm);
		flex-shrink: 0;
	}
	.item-icon.placeholder {
		display: inline-block;
		background: var(--surface-2);
	}
	.item h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		letter-spacing: -0.01em;
		flex: 1;
		min-width: 0;
	}
	.facts {
		display: flex;
		gap: 14px;
		font-family: var(--mono);
		font-size: 10.5px;
		color: var(--ink-3);
	}
	.facts a {
		color: var(--accent);
		text-decoration: none;
	}
	.facts a:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
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
	.restr {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.restr a.tag {
		text-decoration: none;
	}
	.restr a.tag:hover {
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.tip {
		margin: 0;
		font-size: 12.5px;
		color: var(--ink-2);
		white-space: pre-line;
	}
</style>
