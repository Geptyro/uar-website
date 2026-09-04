<script lang="ts">
	/**
	 * What moved last: guides written or edited and comments said anywhere,
	 * one feed, newest first, under the last games. A guide row is the
	 * class's portrait, the title, who wrote it and whether it is new or
	 * freshly edited, and its mark; a comment row is the writer's portrait,
	 * who said what where, and the first words. Drawn to the last-games
	 * card's measurements so the two read as one column.
	 */
	import { timeAgo } from 'sveltekit-commons/time';
	import { mosById } from '$lib/mos';
	import { formatRating, rating } from '$lib/builds';
	import { ANON_PORTRAIT as anonPortrait, portraitFallback } from '$lib/portrait';
	import type { ActivityItem } from '$lib/server/activity';

	let { items }: { items: ActivityItem[] } = $props();

	const now = Date.now();
	const KIND: Record<string, string> = { guide: 'guide', mos: 'class', entity: 'entity' };
</script>

<section class="card activity">
	<div class="g-label">Activity</div>
	<ol>
		{#each items as it (it.kind + (it.kind === 'guide' ? it.mos + it.slug : it.id))}
			<li>
				{#if it.kind === 'guide'}
					{@const mos = mosById.get(it.mos)}
					{@const mark = rating(it.ups, it.downs)}
					<a href={it.href} title="{it.title} · a {mos?.name ?? it.mos} guide by {it.name}">
						{#if mos?.icon}<img class="g-pic square" src={mos.icon} alt="" loading="lazy" />{/if}
						<span class="g-body">
							<span class="g-title">{it.title}</span>
							<span class="g-line">
								<span class="g-by">by {it.name}</span>
								<span class="g-when"><span class="g-tag" class:new={it.fresh}>{it.fresh ? 'new' : 'updated'}</span> {timeAgo(it.at, now)}</span>
							</span>
						</span>
						{#if mark !== null}
							<b class="g-mark" title="{formatRating(mark)} out of 10 from {it.ups + it.downs} {it.ups + it.downs === 1 ? 'vote' : 'votes'}">{formatRating(mark)}</b>
						{/if}
					</a>
				{:else}
					<a href={it.href} title="{it.name} on {it.subject.title}">
						<img class="g-pic" src={it.avatar ?? anonPortrait} alt="" loading="lazy" use:portraitFallback={anonPortrait} />
						<span class="g-body">
							<span class="g-title"><b>{it.name}</b> on {it.subject.title}</span>
							<span class="g-line">
								<span class="g-by g-excerpt">{it.excerpt}</span>
								<span class="g-when"><span class="g-tag">{KIND[it.subject.kind]}</span> {timeAgo(it.at, now)}</span>
							</span>
						</span>
					</a>
				{/if}
			</li>
		{/each}
	</ol>
	<a class="g-all" href="/activity">All activity →</a>
</section>

<style>
	.g-label {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-faint);
		margin-bottom: 3px;
	}
	ol {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	/* the whole row is the link, on the last-games band: picture, words, mark */
	ol a {
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 7px 9px 7px 8px;
		margin: 0 -9px;
		border-radius: var(--radius-2);
		text-decoration: none;
		color: inherit;
		background: var(--surface-raised);
		transition: background 120ms ease;
	}
	ol a:hover {
		background: var(--border);
	}
	.g-pic {
		width: 28px;
		height: 28px;
		flex: none;
		border-radius: 50%;
		object-fit: cover;
		border: 1px solid var(--border);
		background: var(--surface-sunken);
	}
	.g-pic.square {
		width: 30px;
		height: 30px;
		border: 0;
		border-radius: var(--radius-1);
	}
	.g-body {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
		flex: 1;
	}
	.g-title {
		font-size: 12.5px;
		font-weight: 600;
		line-height: 1.2;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.g-title b {
		font-weight: 700;
	}
	.g-line {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		min-width: 0;
		font-size: 11px;
		line-height: 1.2;
		color: var(--text-faint);
	}
	.g-by {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.g-when {
		flex: none;
		white-space: nowrap;
	}
	.g-tag {
		font-family: var(--font-mono);
		font-size: 9.5px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-dim);
	}
	.g-tag.new {
		color: var(--accent);
	}
	.g-mark {
		flex: none;
		min-width: 26px;
		text-align: center;
		font: 700 12px var(--font-mono);
		color: var(--accent);
	}
	/* the way out sits at the foot on its own rule, as it does on the last games */
	.g-all {
		display: block;
		margin-top: 9px;
		padding-top: 9px;
		border-top: 1px solid var(--border);
		font-size: 12px;
		color: var(--accent);
		text-decoration: none;
		white-space: nowrap;
	}
	.g-all:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
</style>
