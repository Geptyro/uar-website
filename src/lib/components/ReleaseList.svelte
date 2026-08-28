<script lang="ts">
	/**
	 * Releases as cards, newest first: the body of /changelog and of every
	 * month page under it. One component so the two cannot drift.
	 *
	 * `minor` entries do not get a card: they are the changes a player would
	 * not notice unless told, so they run along the foot of their release as
	 * one "Also:" line, which is the amount of room they are worth.
	 */
	import { ChangeChip } from 'sveltekit-commons';
	import type { Release } from '$lib/changelog';

	let { releases }: { releases: Release[] } = $props();
</script>

{#each releases as rel (rel.version)}
	<section class="release">
		<header class="rel-head">
			<h2>{rel.version}</h2>
			{#if rel.date}<time datetime={rel.date}>{rel.date}</time>{/if}
		</header>
		<div class="entries">
			{#each rel.entries.filter((e) => e.impact !== 'minor') as e (e.title)}
				<article class="card entry" class:major={e.impact === 'major'}>
					<header>
						<ChangeChip type={e.type} />
						<h3>{e.title}</h3>
						<span class="area">{e.area}</span>
					</header>
					<div class="body">
						<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized subset from our own files -->
						{@html e.html}
					</div>
				</article>
			{/each}
			{#if rel.entries.some((e) => e.impact === 'minor')}
				<p class="also">
					Also: {rel.entries
						.filter((e) => e.impact === 'minor')
						.map((e) => e.title)
						.join(' · ')}
				</p>
			{/if}
		</div>
	</section>
{/each}

<style>
	.release {
		margin-bottom: 26px;
	}
	.rel-head {
		display: flex;
		align-items: baseline;
		gap: 12px;
		margin-bottom: 10px;
	}
	.rel-head h2 {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 17px;
		font-weight: 700;
		letter-spacing: -0.01em;
	}
	.rel-head time {
		font-size: 12px;
		color: var(--text-faint);
	}
	.entries {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.entry.major {
		border-left: 3px solid var(--accent);
	}
	.entry header {
		display: flex;
		align-items: baseline;
		gap: 10px;
	}
	.also {
		margin: 2px 0 0;
		font-size: 12px;
		color: var(--text-faint);
	}
	.entry h3 {
		margin: 0;
		flex: 1;
		min-width: 0;
		font-size: 14px;
		font-weight: 600;
		letter-spacing: -0.01em;
	}
	.area {
		flex-shrink: 0;
		font-size: 11px;
		color: var(--text-faint);
	}
	.body {
		margin-top: 5px;
		font-size: 13px;
		line-height: 1.55;
		color: var(--text-dim);
	}
	.body :global(p) {
		margin: 0 0 6px;
	}
	.body :global(p:last-child),
	.body :global(ul:last-child) {
		margin-bottom: 0;
	}
	.body :global(ul) {
		margin: 0 0 6px;
		padding-left: 20px;
	}
	.body :global(code) {
		font-family: var(--font-mono);
		font-size: 12px;
		background: var(--surface-raised);
		padding: 1px 4px;
		border-radius: var(--radius-2);
	}
	.body :global(a) {
		color: var(--accent);
	}
</style>
