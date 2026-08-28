<script lang="ts">
	import { camos, specialCamos } from '$lib/unlocks';
	import Seo from '$lib/components/Seo.svelte';
	import { Page } from 'sveltekit-commons';

	const special = specialCamos.filter((c) => !c.walkerOnly);
	const walkerOnly = specialCamos.filter((c) => c.walkerOnly);

	const lightColors: Record<string, string> = {
		no: 'transparent',
		yellow: '#e6c84a',
		green: '#6fbf4a',
		blue: '#5a8fd4',
		red: '#d45a4a'
	};
</script>

{#snippet swatchImg(swatch: string | null, name: string)}
	{#if swatch}
		<img class="swatch" src={swatch} alt="{name} armor texture" loading="lazy" />
	{:else}
		<span class="swatch placeholder"></span>
	{/if}
{/snippet}

<Page>
	<Seo
		title="Camouflages"
		description="Every armor camouflage in Undead Assault Reborn, with swatches straight from the game files: standard, walker-capable, and the special clan and event camos."
	/>

	<p class="note">
		Armor camouflages are cosmetic unlocks picked from the Unlocks dialog (or the <code>-camo</code>
		command). Swatches are the armor textures straight from the game files; camos marked
		<span class="tag">walker</span> can also be applied to the FP500 Combat Walker. Special camos are
		tied to clans, events or staff.
	</p>

	<h2 class="section">Standard camouflages</h2>
	<div class="grid">
		{#each camos as c (c.num)}
			<article class="card camo">
				{@render swatchImg(c.swatch, c.name)}
				<div class="body">
					<header>
						<h3>{c.name}</h3>
						{#if c.walker}<span class="tag">walker</span>{/if}
						{#if c.adaptive}<span class="tag t-mos">adaptive</span>{/if}
					</header>
					<p class="desc">
						{c.req || 'Available from the start.'}
						{#if c.adaptive}
							Blends in by cycling terrain textures instead of a fixed pattern.
						{/if}
					</p>
				</div>
			</article>
		{/each}
	</div>

	<h2 class="section">Clan · event · staff</h2>
	<div class="grid">
		{#each special as c (c.name)}
			<article class="card camo">
				{@render swatchImg(c.swatch, c.name)}
				<div class="body">
					<header>
						<h3>{c.name}</h3>
					</header>
					<p class="desc">{c.req || '—'}</p>
				</div>
			</article>
		{/each}
	</div>

	<h2 class="section">Walker only</h2>
	<div class="grid">
		{#each walkerOnly as c (c.name)}
			<article class="card camo">
				{#if c.light}
					<span class="swatch light">
						<span
							class="light-dot"
							class:off={c.light === 'no'}
							style="background: {lightColors[c.light] ?? 'transparent'}"
						></span>
					</span>
				{:else}
					{@render swatchImg(c.swatch, c.name)}
				{/if}
				<div class="body">
					<header>
						<h3>{c.name}</h3>
					</header>
					<p class="desc">
						{c.req || (c.light ? 'Searchlight color for the FP500 Combat Walker.' : '—')}
					</p>
				</div>
			</article>
		{/each}
	</div>
</Page>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr));
		gap: 12px;
	}
	.camo {
		display: flex;
		gap: 13px;
		align-items: flex-start;
	}
	.swatch {
		width: 64px;
		height: 64px;
		object-fit: cover;
		border-radius: var(--radius-2);
		border: 1px solid var(--border);
		background: #101010;
		flex-shrink: 0;
	}
	.swatch.placeholder,
	.swatch.light {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--surface-raised);
	}
	.light-dot {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		box-shadow: 0 0 14px 2px color-mix(in srgb, currentcolor 0%, transparent);
	}
	.light-dot.off {
		border: 2px dashed var(--border-strong);
	}
	.body {
		flex: 1;
		min-width: 0;
	}
	.camo header {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		letter-spacing: -0.01em;
	}
	.desc {
		margin: 4px 0 0;
		font-size: 12.5px;
		color: var(--text-dim);
		white-space: pre-line;
	}
</style>
