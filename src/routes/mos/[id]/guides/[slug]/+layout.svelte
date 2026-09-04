<script lang="ts">
	/**
	 * A guide's own layer inside the class frame: its byline and its state.
	 * The guide's tabs and actions are in the bar above (BuildBar, which the
	 * class layout shows in place of its own tabs on a guide page), and the
	 * top bar's crumb reads the guide's title, so nothing is repeated here.
	 */
	import { page } from '$app/state';
	import { Page } from 'sveltekit-commons';
	import ModeMark from '$lib/components/ModeMark.svelte';
	import RankMark from '$lib/components/RankMark.svelte';
	import { ANON_PORTRAIT as anonPortrait, portraitFallback } from '$lib/portrait';
	import { modeNames } from '$lib/players';
	import { formatRating, rating } from '$lib/builds';

	let { data, children } = $props();

	/* the comments tab is the conversation, not the guide: no byline over it */
	const onComments = $derived(page.route.id?.endsWith('/comments') ?? false);

	const mos = $derived(data.mos);
	const build = $derived(data.build);
	const author = $derived(data.author);
	const fmtDate = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' });
	const mark = $derived(rating(build.ups, build.downs));
</script>

<Page>
	{#if !onComments}
	<header class="bhead">
		<div class="who">
			<span class="byline">
				<img class="av" src={author.avatar ?? anonPortrait} alt="" use:portraitFallback={anonPortrait} />
				{#if author.toon}
					<a href="/players/{author.toon}">
						{#if author.clan}&lt;{author.clan}&gt;{/if}
						{author.name}
					</a>
				{:else}
					{author.name}
				{/if}
				· {fmtDate.format(new Date(build.publishedAt ?? build.createdAt))}
				{#if build.updatedAt.slice(0, 10) !== (build.publishedAt ?? build.createdAt).slice(0, 10)}
					· edited {fmtDate.format(new Date(build.updatedAt))}
				{/if}
				{#if mark !== null}
					· <span class="score">{formatRating(mark)} / 10</span> from {(build.ups ?? 0) + (build.downs ?? 0)} votes
				{/if}
			</span>
			{#if build.modes.length}
				<span class="modes">
					{#each build.modes as m (m)}<ModeMark mode={modeNames.indexOf(m) + 1} />{/each}
				</span>
			{/if}
			{#if build.ranks?.length}
				<span class="modes">
					{#each build.ranks as r (r)}<RankMark rank={r} small />{/each}
				</span>
			{/if}
			{#if build.status !== 'published'}
				<span class="tag" class:t-hostile={build.status === 'hidden'}>{build.status}</span>
			{/if}
		</div>
	</header>
	{/if}

	{#if build.status === 'draft'}
		<p class="quote banner">{`A draft: only you can see it. Publish it when it is ready and it goes on the ${mos.name} guides list.`}</p>
	{:else if build.status === 'hidden'}
		<p class="quote banner hidden">{'Hidden by the maintainer. Its author and the maintainer can still see it; nobody else can.'}</p>
	{/if}

	{@render children()}
</Page>

<style>
	.bhead {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 16px;
		margin: 2px 0 14px;
	}
	.who {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 14px;
		font-size: 12.5px;
		color: var(--text-dim);
	}
	.byline {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.byline a {
		color: var(--text);
	}
	.av {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		object-fit: cover;
		border: 1px solid var(--border);
		background: var(--surface-raised);
	}
	.score {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--accent);
	}
	.modes {
		display: flex;
		gap: 10px;
		font-size: 12px;
	}
	.banner {
		margin: 0 0 14px;
	}
	.banner.hidden {
		border-left-color: var(--hostile);
	}
</style>
