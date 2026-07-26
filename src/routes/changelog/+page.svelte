<script lang="ts">
	import ChangeChip from '$lib/components/ChangeChip.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Changelog — UAR Unit Database</title>
</svelte:head>

<p class="note">What changed on this site, release by release.</p>

{#each data.releases as rel (rel.version)}
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
		font-family: var(--mono);
		font-size: 17px;
		font-weight: 700;
		letter-spacing: -0.01em;
	}
	.rel-head time {
		font-size: 12px;
		color: var(--ink-3);
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
		color: var(--ink-3);
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
		color: var(--ink-3);
	}
	.body {
		margin-top: 5px;
		font-size: 13px;
		line-height: 1.55;
		color: var(--ink-2);
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
		font-family: var(--mono);
		font-size: 12px;
		background: var(--surface-2);
		padding: 1px 4px;
		border-radius: var(--r-sm);
	}
	.body :global(a) {
		color: var(--accent);
	}
</style>
