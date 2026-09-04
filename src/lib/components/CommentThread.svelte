<script lang="ts">
	/**
	 * A conversation, drawn the way a thread is read: each comment with its
	 * author's portrait on a rail, the answers indented under it along a line
	 * that folds the branch when clicked, and under every comment the arrows
	 * and the score, an answer link, and what its author or the maintainer
	 * may do to it. The box for a new comment is at the top; an answer's box
	 * opens under the comment it answers. Comments are the guide's own
	 * markdown (chips, key caps, pictures) through the same field and the
	 * same renderer. The same thread hangs under a guide and on a class page;
	 * the page it sits on gives it the subject's actions (`?/post`, `?/vote`,
	 * `?/edit`, `?/delete`, `?/hide` — see $lib/server/comments).
	 *
	 * Every form here is enhanced: a comment, a vote or a delete goes out over
	 * fetch and the thread redraws in place, no page load, and the same forms
	 * still work as plain posts with scripts off.
	 */
	import { SvelteSet } from 'svelte/reactivity';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from 'sveltekit-commons';
	import { timeAgo } from 'sveltekit-commons/time';
	import Confirm from '$lib/components/Confirm.svelte';
	import VoteArrows from '$lib/components/VoteArrows.svelte';
	import Reactions from '$lib/components/Reactions.svelte';
	import { invalidateAll } from '$app/navigation';
	import { ANON_PORTRAIT as anonPortrait, portraitFallback } from '$lib/portrait';
	import Rich from '$lib/components/builds/Rich.svelte';
	import MarkdownField from '$lib/components/builds/MarkdownField.svelte';
	import type { Mos } from '$lib/mos';
	import { BUILD_LIMITS, COMMENT_DEPTH_MAX, countThreads, type CommentView, type Thread } from '$lib/builds';

	let {
		mos,
		threads,
		canPost,
		admin,
		open,
		replyTo: opened = null,
		form,
		placeholder = 'A question, a correction, what worked for you. Markdown works; @ names a skill or an item.',
		opTitle = "The guide's author"
	}: {
		/** The class the @ search leans to; null on a subject with no class (an entity). */
		mos: Mos | null;
		threads: Thread<CommentView>[];
		/** Signed in. */
		canPost: boolean;
		admin: boolean;
		/** The subject takes comments and votes right now (a guide that is out; a class page always). */
		open: boolean;
		/** The comment whose answer box starts open (from `?reply=`). */
		replyTo?: string | null;
		/** The page's form result, for an error and the words to keep. */
		form: { error?: string; text?: string; parent?: string | null; editing?: string } | null | undefined;
		placeholder?: string;
		opTitle?: string;
	} = $props();

	const now = Date.now();
	/** Whether anything may be said or voted: signed in, on an open subject. */
	const live = $derived(open && canPost);
	const total = $derived(countThreads(threads));

	/* which comment has its answer box open: the one whose answer came back
	   with an error, else the one the link named (the way without scripts) */
	let replyTo = $state<string | null>(null);
	let topText = $state('');
	let replyText = $state('');
	/** The comment being reworded, and the words in its box. */
	let editing = $state<string | null>(null);
	let editText = $state('');
	$effect(() => {
		replyTo = form?.parent ?? opened ?? null;
		// a rewording that came back refused reopens its box with what was typed
		if (form?.editing) {
			editing = form.editing;
			if (form.text !== undefined) editText = form.text;
		} else if (form?.text !== undefined) {
			if (form.parent) replyText = form.text;
			else topText = form.text;
		}
	});

	let confirmBox = $state<Confirm>();

	/** A comment went out: the thread reloads in place, the box empties and shuts. */
	const posted: SubmitFunction = () => async ({ result, update }) => {
		await update();
		if (result.type === 'success') {
			topText = '';
			replyText = '';
			replyTo = null;
		}
	};
	/** A rewording went out: the thread reloads in place and the box shuts. */
	const edited: SubmitFunction = () => async ({ result, update }) => {
		await update();
		if (result.type === 'success') editing = null;
	};
	/** A delete asks first; No cancels the submit before anything is sent. */
	const deleting: SubmitFunction = async ({ cancel }) => {
		const ok = await confirmBox!.ask({
			title: 'Delete this comment?',
			message: 'If someone answered it, it stays as [deleted] with the answers under it; otherwise it is gone.'
		});
		if (!ok) cancel();
	};

	/** A face on a comment: the page's own action, then the thread reloads in place. */
	async function react(id: string, emoji: string) {
		const body = new FormData();
		body.set('id', id);
		body.set('emoji', emoji);
		await fetch('?/react', { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } });
		await invalidateAll();
	}

	const folded = new SvelteSet<string>();
	const fold = (id: string) => (folded.has(id) ? folded.delete(id) : folded.add(id));

	const REPLY =
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
</script>

{#snippet buttons(parent: string | null)}
	{#if parent}
		<Button
			variant="ghost"
			href="#c-{parent}"
			onclick={(e: MouseEvent) => {
				e.preventDefault();
				replyTo = null;
			}}>Cancel</Button
		>
	{/if}
	<Button>{parent ? 'Reply' : 'Comment'}</Button>
{/snippet}

{#snippet composer(parent: string | null)}
	<form method="POST" action="?/post" class="post" class:answer={parent !== null} use:enhance={posted}>
		{#if parent}
			<input type="hidden" name="parent" value={parent} />
			<MarkdownField
				bind:value={replyText}
				{mos}
				name="text"
				rows={3}
				maxlength={BUILD_LIMITS.comment.max}
				required
				chips
				placeholder="Your answer. Markdown works; @ names a skill or an item."
			>
				{#snippet footer()}{@render buttons(parent)}{/snippet}
			</MarkdownField>
		{:else}
			<MarkdownField bind:value={topText} {mos} name="text" rows={3} maxlength={BUILD_LIMITS.comment.max} required {placeholder} chips>
				{#snippet footer()}{@render buttons(null)}{/snippet}
			</MarkdownField>
		{/if}
	</form>
{/snippet}

{#snippet thread(t: Thread<CommentView>)}
	{@const c = t.node}
	{@const shut = folded.has(c.id)}
	<article class="c" id="c-{c.id}" class:shut class:hidden={c.hidden} class:stump={c.deleted}>
		<div class="rail">
			{#if c.deleted}
				<span class="av gone"></span>
			{:else}
				<img class="av" src={c.avatar ?? anonPortrait} alt="" use:portraitFallback={anonPortrait} />
			{/if}
			{#if t.replies.length && !shut}
				<button class="line" onclick={() => fold(c.id)} aria-label="Fold this thread" title="Fold"></button>
			{/if}
		</div>
		<div class="main">
			<header class="chead">
				{#if shut}
					<button class="unfold" onclick={() => fold(c.id)} aria-label="Unfold this thread" title="Unfold">+</button>
				{/if}
				{#if c.deleted}
					<span class="who gone">[deleted]</span>
				{:else if c.toon}
					<a class="who" href="/players/{c.toon}">{c.name}</a>
				{:else}
					<b class="who">{c.name}</b>
				{/if}
				{#if c.op}<span class="op" title={opTitle}>OP</span>{/if}
				{#if c.unseen}<span class="new" title="Since you were last here">new</span>{/if}
				<span class="when">· {timeAgo(c.createdAt, now)}</span>
				{#if c.editedAt}<span class="when" title="Edited {timeAgo(c.editedAt, now)}">· edited</span>{/if}
				{#if c.hidden}<span class="tag t-hostile">hidden</span>{/if}
				{#if shut && t.replies.length}
					<span class="when">· {countThreads(t.replies)} {countThreads(t.replies) === 1 ? 'answer' : 'answers'}</span>
				{/if}
			</header>
			{#if !shut}
				{#if !c.deleted}
					{#if editing === c.id}
						<form method="POST" action="?/edit" class="post" use:enhance={edited}>
							<input type="hidden" name="id" value={c.id} />
							<MarkdownField bind:value={editText} {mos} name="text" rows={3} maxlength={BUILD_LIMITS.comment.max} required chips>
								{#snippet footer()}
									<Button type="button" variant="ghost" onclick={() => (editing = null)}>Cancel</Button>
									<Button>Save</Button>
								{/snippet}
							</MarkdownField>
						</form>
					{:else}
						<div class="md">{@html c.html}</div>
					{/if}
					<div class="acts">
						<VoteArrows
							action="?/vote"
							fields={{ id: c.id }}
							score={c.score}
							vote={c.vote}
							can={live && !c.mine}
							signin={!canPost && open}
							why={c.mine ? 'Your own' : undefined}
						/>
						<Reactions reactions={c.reactions} can={live} onreact={(e) => react(c.id, e)} />
						{#if live && !c.hidden && t.depth < COMMENT_DEPTH_MAX}
							<a
								class="act"
								href="?reply={c.id}#c-{c.id}"
								onclick={(e) => {
									e.preventDefault();
									replyTo = replyTo === c.id ? null : c.id;
								}}>{@html REPLY}Reply</a
							>
						{/if}
						{#if admin}
							<form method="POST" action="?/hide" use:enhance>
								<input type="hidden" name="id" value={c.id} />
								<button class="act">{c.hidden ? 'Unhide' : 'Hide'}</button>
							</form>
						{/if}
						{#if c.mine && live && editing !== c.id}
							<button
								type="button"
								class="act"
								onclick={() => {
									editing = c.id;
									editText = c.text;
								}}>Edit</button
							>
						{/if}
						{#if c.mine || admin}
							<form method="POST" action="?/delete" use:enhance={deleting}>
								<input type="hidden" name="id" value={c.id} />
								<button class="act danger">Delete</button>
							</form>
						{/if}
					</div>
					{#if replyTo === c.id && live}
						{@render composer(c.id)}
					{/if}
				{/if}
				{#each t.replies as r (r.node.id)}
					{@render thread(r)}
				{/each}
			{/if}
		</div>
	</article>
{/snippet}

<div class="comments">
	{#if form?.error}
		<p class="quote error">{form.error}</p>
	{/if}

	{#if open}
		{#if canPost}
			{@render composer(null)}
		{:else}
			<p class="fine signin"><a href="/account">Sign in with Battle.net</a> to comment.</p>
		{/if}
	{/if}

	<Rich>
		{#if threads.length}
			<p class="count">{total} {total === 1 ? 'comment' : 'comments'}</p>
			<div class="threads">
				{#each threads as t (t.node.id)}
					{@render thread(t)}
				{/each}
			</div>
		{:else}
			<p class="note">Nothing said yet.</p>
		{/if}
	</Rich>
</div>
<Confirm bind:this={confirmBox} />

<style>
	.comments {
		max-width: 86ch;
	}
	.quote.error {
		border-left-color: var(--hostile);
		margin-bottom: 14px;
	}
	.count {
		margin: 18px 0 2px;
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-faint);
	}

	/* one comment: the rail (portrait, then the line the answers hang from) and the rest */
	.c {
		display: grid;
		grid-template-columns: 28px minmax(0, 1fr);
		column-gap: 10px;
		margin-top: 14px;
	}
	.rail {
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.av {
		width: 28px;
		height: 28px;
		flex: none;
		border-radius: 50%;
		object-fit: cover;
		border: 1px solid var(--border);
		background: var(--surface-raised);
	}
	.av.gone {
		border-style: dashed;
		background: none;
	}
	/* the line is the fold: wider than it looks, so it can be hit */
	.line {
		flex: 1;
		width: 16px;
		margin-top: 6px;
		border: 0;
		padding: 0;
		cursor: pointer;
		background: linear-gradient(var(--border), var(--border)) center / 2px 100% no-repeat;
	}
	.line:hover {
		background-image: linear-gradient(var(--accent), var(--accent));
	}
	.main {
		min-width: 0;
	}
	.chead {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		min-height: 28px;
		font-size: 12px;
		color: var(--text-faint);
	}
	.who {
		color: var(--text);
		font-weight: 600;
		text-decoration: none;
	}
	a.who:hover {
		text-decoration: underline;
	}
	.who.gone {
		color: var(--text-faint);
		font-weight: 500;
		font-style: italic;
	}
	.op {
		font-family: var(--font-mono);
		font-size: 9.5px;
		line-height: 14px;
		padding: 0 4px;
		border: 1px solid var(--accent);
		border-radius: 3px;
		color: var(--accent);
	}
	.new {
		font-family: var(--font-mono);
		font-size: 9.5px;
		line-height: 14px;
		padding: 0 5px;
		border-radius: 3px;
		background: var(--accent);
		color: var(--accent-contrast);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.unfold {
		width: 20px;
		height: 20px;
		border: 1px solid var(--border-strong);
		border-radius: 50%;
		background: var(--surface-raised);
		color: var(--text-dim);
		font: 600 13px/1 var(--font-mono);
		cursor: pointer;
	}
	.unfold:hover {
		color: var(--accent);
		border-color: var(--accent);
	}
	.shut > .main > .chead .who {
		color: var(--text-dim);
	}
	.hidden > .main > .md,
	.hidden > .main > .chead .who {
		opacity: 0.6;
	}
	.main > .md {
		margin: 2px 0 0;
		font-size: 13.5px;
	}

	/* the row under a comment: the arrows and the score in a pill, then the links */
	.acts {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px;
		margin: 6px 0 0 -2px;
	}
	.acts form {
		display: contents;
	}
	.act {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		height: 26px;
		padding: 0 9px;
		border: 0;
		border-radius: 99px;
		background: none;
		font: 600 12px var(--font-sans, inherit);
		color: var(--text-dim);
		text-decoration: none;
		cursor: pointer;
	}
	.act :global(svg) {
		width: 15px;
		height: 15px;
	}
	.act:hover {
		background: var(--surface-raised);
		color: var(--text);
	}
	.act.danger:hover {
		color: var(--hostile);
	}

	/* the box for a comment, and the smaller one for an answer */
	.post {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.post.answer {
		margin: 10px 0 4px;
	}
	.fine {
		font-size: 11.5px;
		line-height: 1.5;
		color: var(--text-faint);
	}
	.signin {
		margin: 0 0 6px;
	}

	@media (max-width: 599.98px) {
		.c {
			grid-template-columns: 22px minmax(0, 1fr);
			column-gap: 8px;
			margin-top: 12px;
		}
		.av {
			width: 22px;
			height: 22px;
		}
		.chead {
			min-height: 22px;
		}
	}
</style>
