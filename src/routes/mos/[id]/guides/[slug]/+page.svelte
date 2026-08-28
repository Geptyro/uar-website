<script lang="ts">
	/**
	 * One guide, read: the head (modes, SIs, skill order) drawn from the
	 * class's data, the document as its author wrote it, rendered on the
	 * server, and under it what a reader can do: vote it up or down, or
	 * report it. The byline, the state and the author's controls are the guide
	 * layout's, above; the title is the top bar's crumb.
	 */
	import Seo from '$lib/components/Seo.svelte';
	import BuildHead from '$lib/components/builds/BuildHead.svelte';
	import BuildBody from '$lib/components/builds/BuildBody.svelte';
	import VoteArrows from '$lib/components/VoteArrows.svelte';
	import { mosCardUrl } from '$lib/seo';
	import { formatRating, rating } from '$lib/builds';

	let { data, form } = $props();

	const mos = $derived(data.mos);
	const build = $derived(data.build);
	const viewer = $derived(data.viewer);
	const author = $derived(data.author);
	const vote = $derived((form?.vote ?? data.vote) as 1 | -1 | 0);
	const ups = $derived(form?.ups ?? build.ups ?? 0);
	const downs = $derived(form?.downs ?? build.downs ?? 0);
	const mark = $derived(rating(ups, downs));
	const published = $derived(build.status === 'published');
</script>

<Seo
	title="{build.title} — {mos.name} build"
	description={build.summary || `A player-written ${mos.name} build for Undead Assault Reborn.`}
	image={mosCardUrl(mos.id)}
	noindex={!published}
/>

{#if form?.error}
	<p class="quote error">{form.error}</p>
{/if}

<BuildHead {mos} modes={build.modes} skills={build.skills} sis={build.sis} />

<BuildBody blocks={data.blocks} />

<div class="foot">
	{#if published}
		<div class="helpful">
			<VoteArrows
				action="?/vote"
				score={ups - downs}
				{vote}
				can={viewer.signedIn && !viewer.isAuthor}
				signin={!viewer.signedIn}
				why={viewer.isAuthor ? 'Your own guide' : undefined}
			/>
			<span class="fine">
				{#if mark === null}
					No votes yet.{#if !viewer.signedIn} Sign in to be the first.{/if}
				{:else}
					<b class="mark">{formatRating(mark)} / 10</b> from {ups + downs} {ups + downs === 1 ? 'vote' : 'votes'}: {ups} up, {downs} down.
				{/if}
			</span>
		</div>
	{/if}

	<div class="fine">
		{#if form?.reported}
			Thanks, the report is with the maintainer.
		{:else}
			<details class="report">
				<summary>Something wrong with it?</summary>
				<form method="POST" action="?/report">
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
</div>

<style>
	.mark {
		color: var(--accent);
		font-family: var(--font-mono);
		font-size: 11.5px;
	}
	.quote.error {
		border-left-color: var(--hostile);
		margin-bottom: 14px;
	}
	.foot {
		margin-top: 30px;
		padding-top: 16px;
		border-top: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.helpful {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.fine {
		font-size: 11.5px;
		line-height: 1.5;
		color: var(--text-faint);
		margin: 0;
	}
	.report {
		display: inline-block;
		margin-top: 4px;
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
</style>
