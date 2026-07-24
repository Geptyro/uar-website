<script lang="ts">
	import { items, restrictionLabel } from '$lib/mos';

	let query = $state('');
	let classFilter = $state('');

	const classes = [...new Set(items.map((i) => i.class))].sort();

	const filtered = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		return items.filter((i) => {
			if (classFilter && i.class !== classFilter) return false;
			if (!needle) return true;
			const hay = `${i.name} ${i.id} ${i.mods.join(' ')} ${i.tooltip}`.toLowerCase();
			return hay.includes(needle);
		});
	});
</script>

<svelte:head>
	<title>Items — UAR Unit Database</title>
</svelte:head>

<h1>Items &amp; equipment</h1>
<p class="note">
	All {items.length} items defined in the game data: pickups, ammunition and carry equipment. Stat
	effects come from each item's carry-buff; restrictions are derived from its validators.
</p>

<div class="controls">
	<input type="search" placeholder="Search items…" aria-label="Search items" bind:value={query} />
	<select bind:value={classFilter} aria-label="Filter by class">
		<option value="">All classes</option>
		{#each classes as c (c)}
			<option value={c}>{c}</option>
		{/each}
	</select>
	<span class="count">{filtered.length} / {items.length}</span>
</div>

<div class="grid">
	{#each filtered as item (item.id)}
		<article class="item" id={item.id}>
			<header>
				<h3>{item.name}</h3>
				<span class="cls">{item.class}</span>
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
			{#if item.restrictions.length}
				<div class="restr">
					{#each item.restrictions as r (r.raw)}
						<span class="restr-tag" class:only={r.kind === 'only'} class:not={r.kind === 'not'}>
							{restrictionLabel(r)}
						</span>
					{/each}
				</div>
			{/if}
			{#if item.tooltip}<p class="tip">{item.tooltip}</p>{/if}
		</article>
	{/each}
</div>

<style>
	h1 {
		margin: 0 0 6px;
		font-size: clamp(22px, 4vw, 28px);
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}
	.note {
		color: var(--ink-soft);
		font-size: 13.5px;
		max-width: 75ch;
		margin: 0 0 14px;
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
		margin-bottom: 16px;
	}
	input[type='search'],
	select {
		background: var(--panel);
		color: var(--ink);
		border: 1px solid var(--line);
		padding: 7px 12px;
		font: inherit;
	}
	input[type='search'] {
		width: 230px;
	}
	.count {
		margin-left: auto;
		font-family: var(--mono);
		font-size: 12px;
		color: var(--ink-soft);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
		gap: 12px;
	}
	.item {
		background: var(--panel);
		border: 1px solid var(--line);
		border-top: 3px solid var(--item);
		padding: 12px 14px;
		scroll-margin-top: 70px;
	}
	.item header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
	}
	.item h3 {
		margin: 0;
		font-size: 14.5px;
	}
	.cls {
		font-family: var(--mono);
		font-size: 10px;
		color: var(--item);
		white-space: nowrap;
	}
	.facts {
		display: flex;
		gap: 12px;
		font-family: var(--mono);
		font-size: 11px;
		color: var(--ink-soft);
		margin: 3px 0 6px;
	}
	.mods {
		margin: 0 0 6px;
		padding-left: 18px;
		font-size: 12.5px;
	}
	.mods li {
		font-family: var(--mono);
		font-size: 11.5px;
	}
	.restr {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-bottom: 6px;
	}
	.restr-tag {
		font-family: var(--mono);
		font-size: 10px;
		padding: 2px 7px;
		border: 1px solid var(--line);
		color: var(--ink-soft);
	}
	.restr-tag.only {
		color: var(--mos);
		border-color: var(--mos);
	}
	.restr-tag.not {
		color: var(--hostile);
		border-color: var(--hostile);
	}
	.tip {
		margin: 0;
		font-size: 12.5px;
		color: var(--ink-soft);
		white-space: pre-line;
	}
</style>
