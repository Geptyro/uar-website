<script lang="ts">
	/**
	 * The activity page, two columns of the same row (who, where, the first
	 * words, when; a row is a link to the comment on its thread): what the
	 * player was told, and what is being said anywhere. One column under the
	 * other when the screen is narrow.
	 */
	import { Page } from 'sveltekit-commons';
	import { timeAgo } from 'sveltekit-commons/time';
	import Seo from '$lib/components/Seo.svelte';
	import anonPortrait from '$lib/assets/anon-portrait.svg';
	import { portraitFallback } from '$lib/portrait';

	let { data } = $props();

	const now = Date.now();
	const KIND: Record<string, string> = { guide: 'guide', mos: 'class', entity: 'entity', chat: 'chat' };
	const said = (kind: 'comment' | 'reply' | 'mention') =>
		kind === 'reply' ? 'answered your comment on' : kind === 'mention' ? 'named you on' : 'commented on your guide';
</script>

<Page>
	<Seo title="Activity" description="Comments on your guides, answers to your comments, and what is being said on the site." noindex />

	{#if !data.enabled}
		<p class="note">Activity is not available on this deployment.</p>
	{:else}
	<div class="cols">
	<section>
		<h2 class="sect">Yours <small>· comments on your guides, answers to you</small></h2>
		{#if !data.signedIn}
			<p class="fine"><a href="/account">Sign in with Battle.net</a> to see who answered you.</p>
		{:else if data.mine.length}
			<ol class="rows">
				{#each data.mine as n (n.id)}
					<li>
						<a class="card row" class:unread={n.unread} href={n.href}>
							<img class="av" src={n.avatar ?? anonPortrait} alt="" loading="lazy" use:portraitFallback={anonPortrait} />
							<span class="body">
								<span class="line">
									<b>{n.name}</b> {said(n.kind)} <b>{n.subject.title}</b>
									<span class="kind">{KIND[n.subject.kind]}</span>
								</span>
								<span class="excerpt">{n.excerpt}</span>
							</span>
							<span class="when">{#if n.unread}<span class="dot" title="Unread"></span>{/if}{timeAgo(n.at, now)}</span>
						</a>
					</li>
				{/each}
			</ol>
		{:else}
			<p class="fine">Nothing yet. You are told here when someone comments on one of your guides or answers one of your comments.</p>
		{/if}
	</section>

	<section>
		<h2 class="sect">Everywhere <small>· the newest comments on the site</small></h2>
		{#if data.activity.length}
			<ol class="rows">
				{#each data.activity as c (c.id)}
					<li>
						<a class="card row" href={c.href}>
							<img class="av" src={c.avatar ?? anonPortrait} alt="" loading="lazy" use:portraitFallback={anonPortrait} />
							<span class="body">
								<span class="line">
									<b>{c.name}</b> on <b>{c.subject.title}</b>
									<span class="kind">{KIND[c.subject.kind]}</span>
								</span>
								<span class="excerpt">{c.excerpt}</span>
							</span>
							<span class="when">{timeAgo(c.at, now)}</span>
						</a>
					</li>
				{/each}
			</ol>
		{:else}
			<p class="fine">Nothing said anywhere yet.</p>
		{/if}
	</section>
	</div>
	{/if}
</Page>

<style>
	/* the two columns, side by side while there is room for two lists of words */
	.cols {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 24px;
		align-items: start;
	}
	@media (max-width: 899.98px) {
		.cols {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	.sect {
		margin: 6px 0 10px;
		font-size: 13px;
		font-weight: 650;
	}
	.sect small {
		font-weight: 500;
		color: var(--text-faint);
	}
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.row {
		display: grid;
		grid-template-columns: 28px minmax(0, 1fr) auto;
		align-items: center;
		gap: 0 10px;
		padding: 8px 12px 8px 10px;
		color: inherit;
		text-decoration: none;
	}
	.row.unread {
		border-color: var(--accent);
	}
	.row:hover .line {
		color: var(--accent);
	}
	.av {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		object-fit: cover;
		border: 1px solid var(--border);
		background: var(--surface-raised);
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.line {
		font-size: 12.5px;
		color: var(--text-dim);
	}
	.line b {
		color: var(--text);
		font-weight: 600;
	}
	.kind {
		margin-left: 6px;
		font-family: var(--font-mono);
		font-size: 9.5px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-faint);
	}
	.excerpt {
		font-size: 12px;
		color: var(--text-faint);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.when {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		color: var(--text-faint);
		white-space: nowrap;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent);
	}
	.fine {
		font-size: 12px;
		line-height: 1.5;
		color: var(--text-faint);
		max-width: 60ch;
	}
</style>
