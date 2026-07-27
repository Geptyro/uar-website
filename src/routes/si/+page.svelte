<script lang="ts">
	import { skillIdentifiers, mosById, mosName, siXpLabel, type Si } from '$lib/mos';

	let filter = $state<'all' | 'universal' | 'class'>('all');

	function matches(s: Si): boolean {
		if (filter === 'universal') return s.mos === null;
		if (filter === 'class') return s.mos !== null;
		return true;
	}

	// si.json is already sorted in the in-game dialog order
	const grid = $derived(skillIdentifiers.filter((s) => !s.special && matches(s)));
	const special = $derived(skillIdentifiers.filter((s) => s.special && matches(s)));

</script>

<svelte:head>
	<title>Skill Identifiers — UAR Unit Database</title>
</svelte:head>

<p class="note">
	SIs are small permanent bonuses applied to your hero, chosen at the start of a game (max 2 per
	game). Most unlock at an account-XP threshold per rank track (Enlisted / Warrant Officer /
	Commissioned Officer); the ones in the bottom section require special achievements. Shown in the
	same order as the in-game dialog.
</p>

<div class="controls">
	{#each [['all', 'All'], ['universal', 'Universal'], ['class', 'Class-specific']] as [key, label] (key)}
		<button
			class="chip"
			aria-pressed={filter === key}
			onclick={() => (filter = key as typeof filter)}
		>
			{label}
		</button>
	{/each}
	<span class="count">{grid.length + special.length} / {skillIdentifiers.length}</span>
</div>

{#snippet siCard(si: Si)}
	<article class="card si">
		<header>
			{#if si.icon}
				<img class="si-icon" src={si.icon} alt="" loading="lazy" />
			{:else}
				<span class="si-icon placeholder"></span>
			{/if}
			<div class="head-text">
				<h3>{si.name}</h3>
				<span class="code">{si.code}</span>
			</div>
			{#if si.mos}
				<a class="tag t-mos" href="/mos/{si.mos}">
					{#if mosById.get(si.mos)?.icon}
						<img src={mosById.get(si.mos)?.icon} alt="" loading="lazy" />
					{/if}
					{mosName(si.mos)}
				</a>
			{/if}
		</header>
		{#if siXpLabel(si)}
			<div class="xp">{siXpLabel(si)} XP</div>
		{/if}
		{#if si.desc}<p class="desc">{si.desc}</p>{/if}
	</article>
{/snippet}

{#if grid.length}
	<div class="grid">
		{#each grid as si (si.num)}
			{@render siCard(si)}
		{/each}
	</div>
{/if}

{#if special.length}
	<h2 class="section">Special unlocks</h2>
	<div class="grid">
		{#each special as si (si.num)}
			{@render siCard(si)}
		{/each}
	</div>
{/if}

<style>
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 7px;
		padding: 4px 0 14px;
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
		grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr));
		gap: 12px;
	}
	.si {
		display: flex;
		flex-direction: column;
		gap: 7px;
	}
	.si header {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.si-icon {
		width: 38px;
		height: 38px;
		object-fit: cover;
		border-radius: var(--r-sm);
		flex-shrink: 0;
	}
	.si-icon.placeholder {
		display: inline-block;
		background: var(--surface-2);
	}
	.head-text {
		flex: 1;
		min-width: 0;
	}
	.si h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		letter-spacing: -0.01em;
	}
	.code {
		font-family: var(--mono);
		font-size: 10px;
		font-weight: 650;
		color: var(--accent);
		letter-spacing: 0.08em;
	}
	.tag.t-mos {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		text-decoration: none;
	}
	.tag.t-mos img {
		width: 14px;
		height: 14px;
		object-fit: cover;
		border-radius: 3px;
	}
	.xp {
		font-family: var(--mono);
		font-size: 10.5px;
		color: var(--ink-3);
		letter-spacing: 0.04em;
	}
	.desc {
		margin: 0;
		font-size: 12.5px;
		color: var(--ink-2);
		white-space: pre-line;
	}
</style>
