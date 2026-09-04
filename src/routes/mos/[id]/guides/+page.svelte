<script lang="ts">
	/**
	 * The class's builds, one row each, best first: the mark out of ten and
	 * the votes behind it, the author's portrait, the title, who wrote it and
	 * when it last moved, and what it is written for. The hand-written guide
	 * (the Guide tab) is the site's; these are the players', and the page says
	 * so at the bottom rather than dressing them up as checked.
	 */
	import { Page } from 'sveltekit-commons';
	import Seo from '$lib/components/Seo.svelte';
	import ModeMark from '$lib/components/ModeMark.svelte';
	import RankMark from '$lib/components/RankMark.svelte';
	import RatingDial from '$lib/components/builds/RatingDial.svelte';
	import { ANON_PORTRAIT as anonPortrait, portraitFallback } from '$lib/portrait';
	import { mosCardUrl } from '$lib/seo';
	import { mosHref } from '$lib/mos';
	import { modeNames } from '$lib/players';
	import { buildHref } from '$lib/builds';
	import type { PageData } from './$types';

	type Row = PageData['builds'][number];

	let { data } = $props();

	const mos = $derived(data.mos);
	const newHref = $derived(`${mosHref(mos.id, 'guides')}/new`);
	const fmtDate = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'long', day: 'numeric' });
	const description = $derived(
		data.builds.length
			? `${data.builds.length} player-written ${data.builds.length === 1 ? 'guide' : 'guides'} for the ${mos.name} in Undead Assault Reborn: skill orders, loadouts, placements and strategy, with screenshots.`
			: `Player-written guides for the ${mos.name} in Undead Assault Reborn: skill orders, loadouts, placements and strategy. None yet. Write the first.`
	);

	const UP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5l7.5 8.5H15v6.5H9V13H4.5z"/></svg>';
	const DOWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19.5L4.5 11H9V4.5h6V11h4.5z"/></svg>';
	const COMMENTS =
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
</script>

{#snippet row(b: Row)}
	<li>
		<a class="card row" class:unpublished={b.status !== 'published'} href={buildHref(mos.id, b.slug)}>
			<span class="rate">
				{#if b.status === 'published'}
					<RatingDial ups={b.ups} downs={b.downs} />
					<span class="counts">
						<span class="u">{@html UP}{b.ups ?? 0}</span>
						<span class="lbl">votes</span>
						<span class="d">{@html DOWN}{b.downs ?? 0}</span>
					</span>
				{:else}
					<span class="tag" class:t-hostile={b.status === 'hidden'}>{b.status}</span>
				{/if}
			</span>
			<img class="portrait" src={b.authorAvatar ?? anonPortrait} alt="" use:portraitFallback={anonPortrait} />
			<span class="body">
				<b class="title">{b.title}</b>
				<span class="by">
					Guide by <b>{b.authorName}</b> · updated {fmtDate.format(new Date(b.updatedAt))}
				</span>
				<span class="tags">
					{#each b.modes as m (m)}<ModeMark mode={modeNames.indexOf(m) + 1} />{/each}
					{#each b.ranks ?? [] as r (r)}<RankMark rank={r} small />{/each}
					{#if b.comments}
						<span class="ctag">{@html COMMENTS}{b.comments}</span>
					{/if}
				</span>
			</span>
		</a>
	</li>
{/snippet}

<Page>
	<Seo title="{mos.name} guides — MOS" {description} image={mosCardUrl(mos.id)} />

	{#if !data.enabled}
		<p class="note">Guides are not available on this deployment.</p>
	{:else}
		<div class="cta">
			{#if data.viewer}
				<a class="chip" href={newHref}>Write a guide</a>
				{#if !data.viewer.mayPublish}
					<span class="fine">
						You can write and save drafts. Publishing needs a linked profile that has appeared in
						an uploaded replay (see <a href="/account">your account</a>).
					</span>
				{/if}
			{:else}
				<a class="chip" href="/account">Sign in with Battle.net to write one</a>
			{/if}
		</div>

		{#if data.mine.length}
			<h2 class="sect">Yours, unpublished</h2>
			<ul class="rows">
				{#each data.mine as b (b.slug)}
					{@render row(b)}
				{/each}
			</ul>
		{/if}

		{#if data.builds.length}
			<h2 class="sect">{data.builds.length === 1 ? 'One guide' : `${data.builds.length} guides`}</h2>
			<ul class="rows">
				{#each data.builds as b (b.slug)}
					{@render row(b)}
				{/each}
			</ul>
		{:else}
			<div class="card empty">
				<b>No guide for the {mos.name} yet.</b>
				<span>
					If you play it, you know something the class page cannot say: where the first thing
					goes, and what to do when it does not work.
				</span>
			</div>
		{/if}
	{/if}
</Page>

<style>
	.cta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		margin: 14px 0 22px;
	}
	.cta .chip {
		text-decoration: none;
	}
	.fine {
		font-size: 11.5px;
		line-height: 1.5;
		color: var(--text-faint);
		max-width: 60ch;
	}
	.sect {
		margin: 22px 0 10px;
		font-size: 13px;
		font-weight: 650;
	}
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	/* one guide: the mark in its own box, the portrait, the words */
	.row {
		display: grid;
		grid-template-columns: auto auto minmax(0, 1fr);
		align-items: center;
		gap: 0 14px;
		padding: 8px 14px 8px 8px;
		color: inherit;
		text-decoration: none;
	}
	.row:hover .title {
		color: var(--accent);
	}
	.rate {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 128px;
		min-height: 68px;
		padding: 6px 12px 6px 6px;
		border: 1px solid var(--border);
		border-radius: var(--radius-2);
		background: var(--surface-sunken);
	}
	.unpublished .rate {
		justify-content: center;
	}
	.counts {
		display: flex;
		flex-direction: column;
		gap: 1px;
		font: 600 11.5px var(--font-mono);
		line-height: 1.3;
	}
	.counts span {
		display: inline-flex;
		align-items: center;
		gap: 3px;
	}
	.counts :global(svg) {
		width: 13px;
		height: 13px;
		fill: currentColor;
		stroke: currentColor;
		stroke-width: 1;
		stroke-linejoin: round;
	}
	.u {
		color: var(--accent);
	}
	.d {
		color: var(--text-faint);
	}
	.lbl {
		font-size: 9px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text-faint);
	}
	.portrait {
		width: 52px;
		height: 52px;
		border-radius: var(--radius-2);
		object-fit: cover;
		border: 1px solid var(--border);
		background: var(--surface-raised);
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}
	.title {
		font-size: 15.5px;
		font-weight: 650;
		letter-spacing: -0.01em;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.by {
		font-size: 11.5px;
		color: var(--text-faint);
	}
	.by b {
		font-weight: 600;
		color: var(--accent);
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin-top: 3px;
		font-size: 11.5px;
		min-height: 16px;
	}
	.ctag {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font: 600 11px var(--font-mono);
		color: var(--text-dim);
	}
	.ctag :global(svg) {
		width: 13px;
		height: 13px;
	}
	.empty {
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-width: 520px;
		font-size: 13px;
		color: var(--text-dim);
	}
	.empty b {
		color: var(--text);
	}

	@media (max-width: 599.98px) {
		.row {
			grid-template-columns: auto minmax(0, 1fr);
			gap: 0 10px;
		}
		.portrait {
			display: none;
		}
		.rate {
			min-width: 0;
		}
		.title {
			white-space: normal;
		}
	}
</style>
