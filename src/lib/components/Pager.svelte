<script lang="ts">
	/**
	 * Page links that keep the rest of the query string (sorting, filters)
	 * intact. Renders nothing when everything fits on one page.
	 */
	import { page as currentPage } from '$app/state';
	import { pageWindow } from '$lib/paging';

	let {
		page,
		pages,
		total,
		label = 'rows',
		param = 'page'
	}: { page: number; pages: number; total: number; label?: string; param?: string } = $props();

	function href(n: number): string {
		const params = new URLSearchParams(currentPage.url.search);
		if (n === 1) params.delete(param);
		else params.set(param, String(n));
		const q = params.toString();
		return q ? `?${q}` : currentPage.url.pathname;
	}
</script>

<nav class="pager" aria-label="Pagination">
	<span class="count mono">{total} {total === 1 ? label.replace(/s$/, '') : label}</span>
	{#if pages > 1}
		<span class="links">
			{#if page > 1}<a class="step" href={href(page - 1)} rel="prev">←</a>{/if}
			<!-- key on position: gaps are null and would otherwise collide -->
			{#each pageWindow(page, pages) as n, i (n ?? `gap-${i}`)}
				{#if n === null}
					<span class="gap">…</span>
				{:else if n === page}
					<span class="here" aria-current="page">{n}</span>
				{:else}
					<a href={href(n)}>{n}</a>
				{/if}
			{/each}
			{#if page < pages}<a class="step" href={href(page + 1)} rel="next">→</a>{/if}
		</span>
	{/if}
</nav>

<style>
	.pager {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
		margin: 14px 0 4px;
	}
	.count {
		color: var(--ink-3);
		font-size: 11px;
	}
	.links {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.links a,
	.here,
	.gap {
		min-width: 26px;
		padding: 4px 7px;
		border-radius: var(--r-sm);
		text-align: center;
		font: 500 12px/1 var(--mono);
		text-decoration: none;
		color: var(--ink-2);
	}
	.links a {
		border: 1px solid var(--border);
	}
	.links a:hover {
		border-color: var(--accent);
		color: var(--accent);
	}
	.here {
		border: 1px solid var(--accent);
		background: var(--accent);
		color: var(--on-accent);
	}
	.gap {
		border: none;
		min-width: 0;
		padding: 4px 2px;
	}
</style>
