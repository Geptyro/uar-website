<script lang="ts">
	import { skillIdentifiers, mosById, mosName, siXpLabel, type Si, type SiChoice } from '$lib/mos';
	import { mapRegions } from '$lib/map';
	import { renderBuildInline } from '$lib/buildMarkdown';
	import { refResolver } from '$lib/buildRefs';
	import Rich from '$lib/components/builds/Rich.svelte';

	/* An SI's menu, in the build markdown's words: the same chips, hover text
	   and links a build gets, from the same renderer. Written here, drawn there. */
	const resolve = refResolver(null);
	function choiceLine(c: SiChoice): string {
		if (c.special) {
			const who = c.special.mos.map((m) => `[[mos:${m}]]`).join(' or ');
			return `[[unit:${c.special.unit}]] as a ${who}${c.special.once ? ', one per game' : ''}; [[unit:${c.unit}]] otherwise`;
		}
		const where = c.region ? mapRegions.find((r) => r.id === c.region)?.name : null;
		return `[[unit:${c.unit}]]${where ? `, only from inside **${where}**` : ''}${c.once ? ', one per game' : ''}`;
	}
	import Seo from '$lib/components/Seo.svelte';
	import { Page } from 'sveltekit-commons';

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

{#snippet siCard(si: Si)}
	<!-- the anchor the command palette links to: an SI has no page of its own,
	     and landing at the top of a screen of thirty cards would leave the
	     reader to find by eye what they just picked by name -->
	<article class="card si" id="si-{si.num}">
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
		{#if si.choices?.length}
			<!-- the menu the SI opens in the game, and the rule on each entry, read
			     from the dialog and its click triggers rather than typed -->
			<Rich>
				<dl class="choices">
					{#each si.choices as c (c.key)}
						<dt>{c.name}</dt>
						<dd class="md">{@html renderBuildInline(choiceLine(c), resolve)}</dd>
					{/each}
				</dl>
			</Rich>
		{/if}
	</article>
{/snippet}

<Page>
	<Seo
		title="Skill Identifiers"
		description="Every Skill Identifier in Undead Assault Reborn: the permanent hero bonuses you pick two of per game, with the rank track and account XP each one unlocks at."
	/>

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
</Page>

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
		font-family: var(--font-mono);
		font-size: 11.5px;
		color: var(--text-faint);
		font-variant-numeric: tabular-nums;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr));
		gap: 12px;
	}
	/* the menu: the button's name in a column, what it gives beside it */
	.choices {
		margin: 4px 0 0;
		padding: 8px 0 0;
		border-top: 1px solid var(--border);
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		column-gap: 12px;
		row-gap: 7px;
		align-items: baseline;
		font-size: 12px;
		line-height: 1.7;
	}
	.choices dt {
		color: var(--text);
		font-weight: 600;
		white-space: nowrap;
	}
	.choices dd {
		margin: 0;
		color: var(--text-dim);
	}
	.choices :global(.md) {
		font-size: 12px;
	}
	.choices :global(.ref) {
		font-size: 11.5px;
	}
	.si {
		display: flex;
		flex-direction: column;
		gap: 7px;
		/* arriving from the palette's /si#si-<n> link, the card stops clear of
		   the sticky chrome instead of under it */
		scroll-margin-top: 16px;
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
		border-radius: var(--radius-2);
		flex-shrink: 0;
	}
	.si-icon.placeholder {
		display: inline-block;
		background: var(--surface-raised);
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
		font-family: var(--font-mono);
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
		font-family: var(--font-mono);
		font-size: 10.5px;
		color: var(--text-faint);
		letter-spacing: 0.04em;
	}
	.desc {
		margin: 0;
		font-size: 12.5px;
		color: var(--text-dim);
		white-space: pre-line;
	}
</style>
