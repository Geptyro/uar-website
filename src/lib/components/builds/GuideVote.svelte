<script lang="ts" module>
	export interface VoteState {
		vote: 1 | -1 | 0;
		ups: number;
		downs: number;
	}

	/** The tally after the reader's vote moves from `s.vote` to `to`. */
	function step(s: VoteState, to: 1 | -1 | 0): VoteState {
		let { ups, downs } = s;
		if (s.vote === 1) ups--;
		else if (s.vote === -1) downs--;
		if (to === 1) ups++;
		else if (to === -1) downs++;
		return { vote: to, ups: Math.max(0, ups), downs: Math.max(0, downs) };
	}
</script>

<script lang="ts">
	/**
	 * How a reader rates a guide: its mark out of ten, and two buttons that say
	 * what they do, Helpful and Not really, each with its count. Under them one
	 * line on what the reader can do from here: sign in (and come straight
	 * back), take a vote back, or tell the author what is missing.
	 *
	 * Votes are the same up/down the guides list sorts by. The page shows
	 * this box more than once (the rail, the strip on narrow screens, the end
	 * of the guide), so the vote in flight is the page's `pending`, bound into
	 * each copy: every copy moves on the click, before the server answers, and
	 * settles on the server's tally when it does. Each button is a plain POST
	 * form underneath, so it votes without scripts too.
	 */
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import RatingDial from './RatingDial.svelte';
	import { formatRating, rating } from '$lib/builds';

	let {
		ups,
		downs,
		vote,
		pending = $bindable(null),
		viewer,
		signin,
		comments,
		error = null,
		variant = 'card'
	}: {
		ups: number;
		downs: number;
		/** The reader's own vote, as the server last said. */
		vote: 1 | -1 | 0;
		/** The vote on its way, shared by every copy on the page. */
		pending?: VoteState | null;
		viewer: { signedIn: boolean; isAuthor: boolean };
		/** Sign-in that returns to this guide. */
		signin: string;
		/** The guide's comments tab. */
		comments: string;
		/** The vote action's refusal, if the last vote was refused. */
		error?: string | null;
		/** 'rail' stacks for the side column, 'strip' runs in a line, 'card' closes the guide. */
		variant?: 'rail' | 'strip' | 'card';
	} = $props();

	const shown = $derived(pending ?? { vote, ups, downs });
	const mark = $derived(rating(shown.ups, shown.downs));
	const total = $derived(shown.ups + shown.downs);
	const can = $derived(viewer.signedIn && !viewer.isAuthor);

	const submit =
		(dir: 1 | -1): SubmitFunction =>
		() => {
			pending = step(shown, shown.vote === dir ? 0 : dir);
			return async ({ update }) => {
				await update({ reset: false });
				pending = null;
			};
		};

	/* Feather, like the rest of the site's icons */
	const THUMB_UP =
		'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>';
	const THUMB_DOWN =
		'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>';
</script>

{#snippet button(dir: 1 | -1)}
	{@const word = dir === 1 ? 'Helpful' : 'Not really'}
	{@const glyph = dir === 1 ? THUMB_UP : THUMB_DOWN}
	{@const count = dir === 1 ? shown.ups : shown.downs}
	{@const on = shown.vote === dir}
	{#if can}
		<form method="POST" action="?/vote" use:enhance={submit(dir)}>
			<input type="hidden" name="dir" value={on ? 0 : dir} />
			<button
				class="vb"
				class:up={dir === 1}
				class:down={dir === -1}
				aria-pressed={on}
				disabled={pending !== null}
				title={on ? 'Take your vote back' : undefined}
			>
				{@html glyph}<span class="w">{word}</span><b>{count}</b>
			</button>
		</form>
	{:else if !viewer.signedIn}
		<a class="vb" class:up={dir === 1} class:down={dir === -1} href={signin} data-sveltekit-reload>
			{@html glyph}<span class="w">{word}</span><b>{count}</b>
		</a>
	{:else}
		<span class="vb off" class:up={dir === 1} class:down={dir === -1} aria-disabled="true" title="Your own guide">
			{@html glyph}<span class="w">{word}</span><b>{count}</b>
		</span>
	{/if}
{/snippet}

<div class="gv v-{variant}">
	{#if variant === 'card'}<h2 class="ask">Was this guide helpful?</h2>{/if}
	<div class="body">
		<div class="mark">
			<RatingDial ups={shown.ups} downs={shown.downs} size={variant === 'rail' ? 58 : 46} />
			<span class="mtext">
				{#if mark === null}
					<b>No votes yet</b>
					<small>{viewer.isAuthor ? 'Readers vote here' : 'Be the first'}</small>
				{:else}
					<b>{formatRating(mark)} <i>/ 10</i></b>
					<small>{total} {total === 1 ? 'vote' : 'votes'}</small>
				{/if}
			</span>
		</div>
		{#if variant === 'rail'}<p class="ask">Was it helpful?</p>{/if}
		<div class="btns">
			{@render button(1)}
			{@render button(-1)}
		</div>
	</div>
	<p class="hint" class:err={!!error} aria-live="polite">
		{#if error}
			{error}
		{:else if !viewer.signedIn}
			<a href={signin} data-sveltekit-reload>Sign in with Battle.net</a> to vote. You come back to this guide after.
		{:else if viewer.isAuthor}
			Your own guide: the votes are the readers'.
		{:else if shown.vote === 1}
			You found it helpful. Press it again to take the vote back.
		{:else if shown.vote === -1}
			Noted. <a href={comments}>Tell the author what is missing</a>, or press again to take the vote back.
		{:else}
			One vote per player. The class's guide list puts the most helpful first.
		{/if}
	</p>
</div>

<style>
	.gv {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.ask {
		margin: 0;
		font-size: 15px;
		font-weight: 650;
		color: var(--text);
	}
	.v-rail .ask {
		font-size: 13px;
		margin-top: 2px;
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	/* in a line: the mark, then the buttons, wrapping under it when narrow */
	.v-strip .body,
	.v-card .body {
		flex-direction: row;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px 28px;
	}
	.mark {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.mtext {
		display: flex;
		flex-direction: column;
		gap: 1px;
		line-height: 1.25;
	}
	.mtext b {
		font: 650 17px var(--font-mono);
		color: var(--text);
	}
	.mtext i {
		font-style: normal;
		font-size: 12px;
		font-weight: 500;
		color: var(--text-faint);
	}
	.mtext small {
		font-size: 12px;
		color: var(--text-dim);
	}

	.btns {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.v-rail .btns {
		flex-direction: column;
	}
	.btns form {
		display: contents;
	}
	.vb {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		height: 36px;
		padding: 0 14px;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-2);
		background: var(--surface);
		color: var(--text);
		font: inherit;
		font-size: 13.5px;
		font-weight: 550;
		text-decoration: none;
		cursor: pointer;
		transition:
			background 0.12s,
			border-color 0.12s,
			color 0.12s;
	}
	.v-rail .vb {
		width: 100%;
	}
	.vb :global(svg) {
		width: 17px;
		height: 17px;
		flex: none;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.vb b {
		margin-left: auto;
		padding-left: 6px;
		font: 600 12px var(--font-mono);
		color: var(--text-dim);
	}
	.vb.up:hover {
		border-color: var(--accent);
		color: var(--accent);
	}
	.vb.down:hover {
		border-color: var(--mos);
		color: var(--mos);
	}
	.vb.up[aria-pressed='true'] {
		background: var(--accent-soft);
		border-color: var(--accent);
		color: var(--accent);
	}
	.vb.down[aria-pressed='true'] {
		background: var(--mos-soft);
		border-color: var(--mos);
		color: var(--mos);
	}
	.vb[aria-pressed='true'] :global(svg) {
		fill: currentColor;
		fill-opacity: 0.25;
	}
	.vb[aria-pressed='true'] b {
		color: inherit;
	}
	.vb:disabled {
		cursor: progress;
	}
	.vb.off,
	.vb.off:hover {
		cursor: default;
		border-color: var(--border);
		color: var(--text-dim);
	}
	.vb:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.hint {
		margin: 0;
		font-size: 12px;
		line-height: 1.5;
		color: var(--text-dim);
	}
	.hint a {
		color: var(--accent);
	}
	.hint.err {
		color: var(--hostile);
	}
</style>
