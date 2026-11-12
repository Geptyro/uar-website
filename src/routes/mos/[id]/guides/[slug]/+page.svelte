<script lang="ts">
	/**
	 * One guide, read. A title block (the title, who wrote it and when, the
	 * modes and ranks it is for; not the summary, which is the guide's first
	 * paragraph cut short and would repeat it), the head drawn from the class's
	 * data (skill IDs, skill order), the document as its author wrote it,
	 * rendered on the server, and a closing card that asks whether it helped.
	 *
	 * On a wide screen a rail runs beside the text and stays in view while it
	 * scrolls: the mark and the two vote buttons, the guide's sections as
	 * links, its comments. Narrower, the rail folds into a strip under the
	 * title (votes, then the sections), so voting never waits for the end of
	 * a long guide. The guide's tabs and the author's controls are the bar
	 * above (BuildBar); draft and hidden banners are the layout's.
	 */
	import { page } from '$app/state';
	import Seo from '$lib/components/Seo.svelte';
	import BuildHead from '$lib/components/builds/BuildHead.svelte';
	import BuildBody from '$lib/components/builds/BuildBody.svelte';
	import GuideVote, { type VoteState } from '$lib/components/builds/GuideVote.svelte';
	import ModeMark from '$lib/components/ModeMark.svelte';
	import RankMark from '$lib/components/RankMark.svelte';
	import { ANON_PORTRAIT as anonPortrait, portraitFallback } from '$lib/portrait';
	import { modeNames } from '$lib/players';
	import { mosCardUrl } from '$lib/seo';
	import { buildHref } from '$lib/builds';
	import { signInHref } from '$lib/signin';

	let { data, form } = $props();

	const mos = $derived(data.mos);
	const build = $derived(data.build);
	const viewer = $derived(data.viewer);
	const author = $derived(data.author);
	const outline = $derived(data.outline);
	const published = $derived(build.status === 'published');

	/* the server's word on the tally: the vote action's answer if it just
	   gave one, else the load's */
	const vote = $derived((form?.vote ?? data.vote) as 1 | -1 | 0);
	const ups = $derived(form?.ups ?? build.ups ?? 0);
	const downs = $derived(form?.downs ?? build.downs ?? 0);
	/** a vote on its way, shared by every vote box on the page */
	let pending = $state<VoteState | null>(null);
	/** which form a refusal answers: the vote box and the report show their own */
	const failedOn = $derived(form && 'on' in form ? form.on : undefined);
	const voteError = $derived(failedOn === 'vote' ? (form?.error ?? null) : null);

	const href = $derived(buildHref(mos.id, build.slug));
	const commentsHref = $derived(`${href}/comments`);
	const signin = $derived(signInHref(page.url.pathname));
	const comments = $derived(build.comments ?? 0);

	const fmtDate = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' });
	const since = $derived(build.publishedAt ?? build.createdAt);
	const edited = $derived(build.updatedAt.slice(0, 10) !== since.slice(0, 10));

	/* the section being read, lit in the rail's list: the last one whose
	   heading has passed the top third of the window, or the last of all
	   once the page is scrolled to its end (a short closing section never
	   reaches the top). The page scrolls inside the shell, not the window. */
	let current = $state<string | null>(null);
	$effect(() => {
		const els = outline.map((o) => document.getElementById(o.id)).filter((e) => e !== null);
		if (els.length < 2) return;
		let scroller: HTMLElement | null = els[0].parentElement;
		while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
		const box = scroller ?? document.documentElement;
		let frame = 0;
		const measure = () => {
			frame = 0;
			const line = window.innerHeight / 3;
			let at: string | null = null;
			for (const el of els) if (el.getBoundingClientRect().top <= line) at = el.id;
			if (box.scrollTop > 0 && box.scrollTop + box.clientHeight >= box.scrollHeight - 2) at = els[els.length - 1].id;
			current = at;
		};
		const soon = () => {
			if (!frame) frame = requestAnimationFrame(measure);
		};
		document.addEventListener('scroll', soon, { capture: true, passive: true });
		window.addEventListener('resize', soon);
		measure();
		return () => {
			document.removeEventListener('scroll', soon, { capture: true });
			window.removeEventListener('resize', soon);
			cancelAnimationFrame(frame);
		};
	});
</script>

<Seo
	title="{build.title} — {mos.name} build"
	description={build.summary || `A player-written ${mos.name} build for Undead Assault Reborn.`}
	image={mosCardUrl(mos.id)}
	noindex={!published}
/>

{#snippet voteBox(variant: 'rail' | 'strip' | 'card')}
	<GuideVote
		{ups}
		{downs}
		{vote}
		bind:pending
		{viewer}
		{signin}
		comments={commentsHref}
		error={voteError}
		{variant}
	/>
{/snippet}

{#snippet commentsLink()}
	<a class="clink" href={commentsHref}>
		<svg viewBox="0 0 24 24" aria-hidden="true"
			><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg
		>
		{comments === 0 ? 'No comments yet' : comments === 1 ? '1 comment' : `${comments} comments`}
	</a>
{/snippet}

<div class="guide">
	<article class="gmain">
		<header class="ghead">
			<h1>{build.title}</h1>
			<div class="byline">
				<img class="av" src={author.avatar ?? anonPortrait} alt="" use:portraitFallback={anonPortrait} />
				<span>
					by
					{#if author.toon}
						<a class="who" href="/players/{author.toon}"
							>{#if author.clan}&lt;{author.clan}&gt;{/if}{author.name}</a
						>
					{:else}
						<b class="who">{author.name}</b>
					{/if}
				</span>
				<span class="dot">·</span>
				<time datetime={since}>{fmtDate.format(new Date(since))}</time>
				{#if edited}
					<span class="dot">·</span>
					<span>updated <time datetime={build.updatedAt}>{fmtDate.format(new Date(build.updatedAt))}</time></span>
				{/if}
				<span class="dot">·</span>
				{@render commentsLink()}
			</div>
			{#if build.modes.length || build.ranks?.length}
				<div class="marks">
					{#each build.modes as m (m)}<ModeMark mode={modeNames.indexOf(m) + 1} />{/each}
					{#each build.ranks ?? [] as r (r)}<RankMark rank={r} small />{/each}
				</div>
			{/if}
		</header>

		{#if form?.error && !failedOn}
			<p class="quote error">{form.error}</p>
		{/if}

		<!-- the rail, folded, for screens that have no room for it -->
		<div class="narrow">
			{#if published}
				<div class="card stripbox">{@render voteBox('strip')}</div>
			{/if}
			{#if outline.length > 1}
				<nav class="toc-inline" aria-label="Sections of this guide">
					<span class="k">In this guide</span>
					{#each outline.filter((o) => o.depth === 0) as o (o.id)}<a href="#{o.id}">{o.title}</a>{/each}
				</nav>
			{/if}
		</div>

		<BuildHead {mos} modes={[]} skills={build.skills} sis={build.sis} />

		<BuildBody blocks={data.blocks} />

		{#if published}
			<section class="card verdict" aria-label="Rate this guide">
				{@render voteBox('card')}
			</section>
		{/if}

		<div class="report fine">
			{#if form?.reported}
				Thanks, the report is with the maintainer.
			{:else}
				<details open={failedOn === 'report'}>
					<summary>Something wrong with this guide? Report it</summary>
					<form method="POST" action="?/report">
						{#if failedOn === 'report'}<p class="err">{form?.error}</p>{/if}
						<textarea
							name="reason"
							rows="3"
							maxlength="500"
							placeholder="What is wrong: out of date, misleading, not about the game…"
							required
						></textarea>
						<button class="chip">Send report</button>
					</form>
				</details>
			{/if}
		</div>
	</article>

	<aside class="grail" aria-label="About this guide">
		<div class="railin">
			{#if published}
				<div class="card railbox">{@render voteBox('rail')}</div>
			{:else}
				<p class="fine">Votes open once the guide is published.</p>
			{/if}
			{#if outline.length > 1}
				<nav class="toc" aria-label="Sections of this guide">
					<h2 class="k">In this guide</h2>
					<ol>
						{#each outline as o (o.id)}
							<li style:--depth={o.depth}>
								<a href="#{o.id}" class:on={o.id === current} aria-current={o.id === current ? 'location' : undefined}
									>{o.title}</a
								>
							</li>
						{/each}
					</ol>
				</nav>
			{/if}
			{@render commentsLink()}
		</div>
	</aside>
</div>

<style>
	/* one column, as wide as the page gives it; beside it, the rail, from the
	   width where the text keeps room for two cards side by side
	   (sidebar 240 + text ~800 + rail) */
	.guide {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
	}
	.grail {
		display: none;
	}
	.gmain {
		min-width: 0;
	}

	/* ---------- title block ---------- */
	.ghead {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin: 6px 0 22px;
	}
	h1 {
		margin: 0;
		font-size: 28px;
		line-height: 1.2;
		font-weight: 700;
		letter-spacing: -0.01em;
		color: var(--text);
		text-wrap: balance;
	}
	.byline {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 7px;
		font-size: 13px;
		color: var(--text-dim);
	}
	.av {
		width: 28px;
		height: 28px;
		margin-right: 2px;
		border-radius: 50%;
		object-fit: cover;
		border: 1px solid var(--border);
		background: var(--surface-raised);
	}
	.who {
		color: var(--text);
		font-weight: 600;
	}
	.dot {
		color: var(--text-faint);
	}
	.marks {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 14px;
		font-size: 12.5px;
	}
	.clink {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		color: var(--text-dim);
	}
	.clink:hover {
		color: var(--accent);
	}
	.clink svg {
		width: 14px;
		height: 14px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linejoin: round;
	}

	/* ---------- the rail, folded ---------- */
	.narrow {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin: 0 0 22px;
	}
	.stripbox {
		padding: 14px 16px;
	}
	.toc-inline {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 6px 14px;
		font-size: 13px;
	}
	.toc-inline a {
		color: var(--text);
		text-decoration: underline;
		text-decoration-color: var(--border-strong);
		text-underline-offset: 3px;
	}
	.toc-inline a:hover {
		color: var(--accent);
		text-decoration-color: currentColor;
	}
	.k {
		margin: 0;
		font: 500 10px var(--font-mono);
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-faint);
	}

	/* ---------- the rail ---------- */
	.railin {
		position: sticky;
		top: 18px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	.railbox {
		padding: 16px;
	}
	.toc ol {
		list-style: none;
		margin: 8px 0 0;
		padding: 0;
		border-left: 1px solid var(--border);
	}
	.toc li a {
		display: block;
		margin-left: -1px;
		padding: 4px 0 4px calc(12px + var(--depth, 0) * 12px);
		border-left: 2px solid transparent;
		font-size: 13px;
		line-height: 1.35;
		color: var(--text-dim);
		text-decoration: none;
	}
	.toc li a:hover {
		color: var(--text);
	}
	.toc li a.on {
		border-left-color: var(--accent);
		color: var(--text);
		font-weight: 600;
	}

	/* ---------- the guide's text, set for reading ---------- */
	.gmain :global(.bsections h2.section) {
		font-family: inherit;
		font-size: 19px;
		font-weight: 650;
		letter-spacing: -0.005em;
		text-transform: none;
		color: var(--text);
		margin-bottom: 14px;
	}
	.gmain :global(.rich .md) {
		font-size: 14.5px;
		line-height: 1.65;
	}
	.gmain :global(.rich .md ul li::before) {
		top: 10.5px;
	}
	/* a card's list was set small for a page of cards; here it is read */
	.gmain :global(.rich .md.incard li) {
		font-size: 13.5px;
		line-height: 1.55;
	}
	.gmain :global(.rich .md.incard ul li::before) {
		top: 8.5px;
	}

	/* ---------- the end of the guide ---------- */
	.verdict {
		margin-top: 36px;
		padding: 18px 20px;
	}
	.quote.error {
		border-left-color: var(--hostile);
		margin-bottom: 14px;
	}
	.fine {
		font-size: 12px;
		line-height: 1.5;
		color: var(--text-faint);
		margin: 0;
	}
	.report {
		margin-top: 18px;
	}
	.report summary {
		cursor: pointer;
		color: var(--text-dim);
	}
	.report form {
		display: flex;
		flex-direction: column;
		gap: 8px;
		align-items: flex-start;
		margin-top: 8px;
		width: min(480px, 100%);
	}
	.report .err {
		margin: 0;
		color: var(--hostile);
	}
	.report textarea {
		width: 100%;
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-2);
		padding: 7px 10px;
		font: inherit;
		font-size: 12.5px;
	}

	/* last, so it overrides the folded strip's own display above */
	@media (min-width: 1360px) {
		.guide {
			grid-template-columns: minmax(0, 1fr) 236px;
			gap: 44px;
		}
		.grail {
			display: block;
		}
		.narrow {
			display: none;
		}
	}
</style>
