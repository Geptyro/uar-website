<script lang="ts">
	import { medals, decals, clanDecals, type Medal } from '$lib/unlocks';

	function xpLabel(m: Medal): string {
		return m.xp.map((v) => `+${v.toLocaleString('en')} XP`).join(' / ');
	}
</script>

<svelte:head>
	<title>Medals & Decals — UAR Unit Database</title>
</svelte:head>

<p class="note">
	Medals are permanent account achievements, awarded in-game when their conditions are met — most
	also grant a one-time XP bonus. Decals are cosmetic insignia painted on your hero, unlocked by
	specific feats and picked from the Unlocks dialog.
</p>

<h2 class="section">Medals</h2>
<div class="grid">
	{#each medals as m (m.num)}
		<article class="card medal">
			{#if m.icon}
				<img class="medal-icon" src={m.icon} alt="" loading="lazy" />
			{:else}
				<span class="medal-icon placeholder"></span>
			{/if}
			<div class="body">
				<header>
					<h3>{m.name}</h3>
					{#if m.xp.length}
						<span class="xp">{xpLabel(m)}</span>
					{/if}
				</header>
				{#if m.desc}<p class="desc">{m.desc}</p>{/if}
			</div>
		</article>
	{/each}
</div>

<h2 class="section">Decals</h2>
<div class="grid">
	{#each decals as d (d.num)}
		<article class="card decal">
			{#if d.icon}
				<img class="decal-icon" src={d.icon} alt="" loading="lazy" />
			{:else}
				<span class="decal-icon placeholder"></span>
			{/if}
			<div class="body">
				<h3>{d.name}</h3>
				<p class="desc">{d.req || 'Available from the start.'}</p>
			</div>
		</article>
	{/each}
</div>

<h2 class="section">iSAR clan decals</h2>
<div class="grid">
	{#each clanDecals as d (d.num)}
		<article class="card decal">
			{#if d.icon}
				<img class="decal-icon" src={d.icon} alt="" loading="lazy" />
			{:else}
				<span class="decal-icon placeholder"></span>
			{/if}
			<div class="body">
				<h3>iSAR · {d.name}</h3>
				<p class="desc">{d.req}</p>
			</div>
		</article>
	{/each}
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr));
		gap: 12px;
	}
	.medal,
	.decal {
		display: flex;
		gap: 13px;
		align-items: flex-start;
	}
	.medal-icon {
		width: 52px;
		height: 52px;
		object-fit: contain;
		flex-shrink: 0;
	}
	.decal-icon {
		width: 46px;
		height: 46px;
		object-fit: contain;
		border-radius: var(--r-sm);
		flex-shrink: 0;
	}
	.medal-icon.placeholder,
	.decal-icon.placeholder {
		display: inline-block;
		background: var(--surface-2);
		border-radius: var(--r-sm);
	}
	.body {
		flex: 1;
		min-width: 0;
	}
	.medal header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
	}
	h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		letter-spacing: -0.01em;
	}
	.xp {
		font-family: var(--mono);
		font-size: 10.5px;
		font-weight: 650;
		color: var(--accent);
		white-space: nowrap;
	}
	.desc {
		margin: 4px 0 0;
		font-size: 12.5px;
		color: var(--ink-2);
		white-space: pre-line;
	}
</style>
