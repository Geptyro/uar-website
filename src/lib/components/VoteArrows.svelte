<script lang="ts">
	/**
	 * The vote pill: up, the score, down. One shape for a guide and for a
	 * comment, so a reader learns it once. Each arrow is a form to `action`
	 * with a `dir` of 1, -1, or 0 when it is the arrow already lit (a second
	 * press takes the vote back), enhanced so the page redraws in place and
	 * still a plain post with scripts off. `fields` travel as hidden inputs
	 * (a comment's id). When the reader cannot vote the arrows stand off,
	 * with `why` as their title, or lead to sign-in.
	 */
	import { enhance } from '$app/forms';

	let {
		action = '?/vote',
		fields = {},
		score,
		vote = 0,
		can = false,
		signin = false,
		why = undefined
	}: {
		action?: string;
		fields?: Record<string, string>;
		score: number;
		/** The reader's own vote on this thing. */
		vote?: 1 | -1 | 0;
		/** Signed in and allowed to. */
		can?: boolean;
		/** Not signed in: the arrows lead to the account page. */
		signin?: boolean;
		/** Why the arrows are off, when they are. */
		why?: string;
	} = $props();

	const UP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5l7.5 8.5H15v6.5H9V13H4.5z"/></svg>';
	const DOWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19.5L4.5 11H9V4.5h6V11h4.5z"/></svg>';
</script>

{#snippet arrow(dir: 1 | -1)}
	{@const name = dir === 1 ? 'Upvote' : 'Downvote'}
	{@const glyph = dir === 1 ? UP : DOWN}
	{#if can}
		<form method="POST" {action} use:enhance>
			{#each Object.entries(fields) as [k, v] (k)}
				<input type="hidden" name={k} value={v} />
			{/each}
			<input type="hidden" name="dir" value={vote === dir ? 0 : dir} />
			<button class="arrow" aria-pressed={vote === dir} aria-label={name} title={name}>{@html glyph}</button>
		</form>
	{:else if signin}
		<a class="arrow" href="/account" aria-label="Sign in to vote" title="Sign in to vote">{@html glyph}</a>
	{:else}
		<span class="arrow off" title={why}>{@html glyph}</span>
	{/if}
{/snippet}

<span class="votes" class:up={vote === 1} class:down={vote === -1}>
	{@render arrow(1)}
	<b class="score">{score}</b>
	{@render arrow(-1)}
</span>

<style>
	.votes {
		display: inline-flex;
		align-items: center;
		height: 26px;
		padding: 0 2px;
		border-radius: 99px;
		border: 1px solid var(--border);
		background: var(--surface-raised);
	}
	.votes form {
		display: contents;
	}
	.arrow {
		width: 22px;
		height: 22px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: none;
		color: var(--text-dim);
		cursor: pointer;
		text-decoration: none;
	}
	.arrow :global(svg) {
		width: 16px;
		height: 16px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.7;
		stroke-linejoin: round;
	}
	.arrow:hover {
		background: var(--surface);
		color: var(--text);
	}
	.arrow.off {
		cursor: default;
		opacity: 0.45;
	}
	.arrow.off:hover {
		background: none;
		color: var(--text-dim);
	}
	.arrow[aria-pressed='true'] :global(svg) {
		fill: currentColor;
	}
	.score {
		min-width: 2ch;
		text-align: center;
		font: 600 12px var(--font-mono);
		color: var(--text);
	}
	.votes.up .arrow[aria-pressed='true'],
	.votes.up .score {
		color: var(--accent);
	}
	.votes.down .arrow[aria-pressed='true'],
	.votes.down .score {
		color: var(--mos);
	}
</style>
