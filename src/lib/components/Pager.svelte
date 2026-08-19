<script lang="ts">
	/**
	 * Page links that keep the rest of the query string (sorting, filters)
	 * intact. Renders nothing when everything fits on one page.
	 *
	 * `shortcuts` adds two keys for previous/next page, bound by POSITION
	 * through `e.code` the way TabBar's are: the defaults `KeyA`/`KeyD` are
	 * the keys marked Q and D on AZERTY and A and D on QWERTY — the same two
	 * fingers a game puts "strafe left/right" on, and nothing for a reader to
	 * configure. The caps drawn on the arrows name whatever the reader's own
	 * keyboard prints, from `getLayoutMap` where it exists.
	 *
	 * Off by default: these are typing keys, so a page that takes them has to
	 * be sure it is not somewhere people type. The guard stands down inside
	 * inputs and while a dialog is open, but that is a floor, not a licence.
	 */
	import { page as currentPage } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { pageWindow } from 'sveltekit-commons/paging';

	let {
		page,
		pages,
		total,
		label = 'rows',
		param = 'page',
		shortcuts = false,
		prevKey = 'KeyA',
		nextKey = 'KeyD'
	}: {
		page: number;
		pages: number;
		total: number;
		label?: string;
		param?: string;
		/** Claim `prevKey`/`nextKey` for paging. See the note above. */
		shortcuts?: boolean;
		/** Physical key codes, when `shortcuts` is on. */
		prevKey?: string;
		nextKey?: string;
	} = $props();

	function href(n: number): string {
		const params = new URLSearchParams(currentPage.url.search);
		if (n === 1) params.delete(param);
		else params.set(param, String(n));
		const q = params.toString();
		return q ? `?${q}` : currentPage.url.pathname;
	}

	/** A press nothing else has a better claim on. */
	function claimable(e: KeyboardEvent): boolean {
		if (!shortcuts || pages < 2) return false;
		if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return false;
		// one press, one page: a held key would fire a navigation per repeat
		if (e.repeat) return false;
		const el = e.target as HTMLElement | null;
		if (el?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el?.tagName ?? ''))
			return false;
		// the palette is open: its own keys, not ours
		return !document.querySelector('dialog[open]');
	}

	function onkeydown(e: KeyboardEvent) {
		if (!claimable(e)) return;
		const step = e.code === prevKey ? -1 : e.code === nextKey ? 1 : 0;
		if (!step) return;
		const n = page + step;
		// no wrap: falling off the last page onto the first is a surprise, not a shortcut
		if (n < 1 || n > pages) return;
		e.preventDefault();
		goto(href(n));
	}

	/**
	 * What the two keys print on this reader's keyboard — "Q"/"D" on AZERTY,
	 * "A"/"D" on QWERTY. `getLayoutMap` is Chromium-only, so the QWERTY caps
	 * stand in elsewhere. Resolved on mount, never during render: it is a fact
	 * about one machine, and a prerendered page is built on one that is nobody's.
	 */
	let caps = $state({ prev: 'A', next: 'D' });
	onMount(async () => {
		if (!shortcuts) return;
		try {
			// not in lib.dom yet
			const kb = (navigator as Navigator & {
				keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> };
			}).keyboard;
			const map = await kb?.getLayoutMap?.();
			if (!map) return;
			caps = {
				prev: (map.get(prevKey) || 'A').toUpperCase(),
				next: (map.get(nextKey) || 'D').toUpperCase()
			};
		} catch {
			// unsupported or blocked; the defaults above are already the answer
		}
	});
</script>

<!-- Unconditional: `<svelte:window>` cannot sit inside a block. `claimable` is
     the gate, and it answers false the moment `shortcuts` is off. -->
<svelte:window {onkeydown} />

<nav class="pager" aria-label="Pagination">
	<span class="count mono">{total} {total === 1 ? label.replace(/s$/, '') : label}</span>
	{#if pages > 1}
		<span class="links">
			<!-- With shortcuts on, both arrows are always drawn — greyed at the
			     ends — so the cap has somewhere to sit on the first page, which
			     is where a reader meets it. -->
			{#if page > 1}
				<a class="step" href={href(page - 1)} rel="prev" aria-label="Previous page">
					{#if shortcuts}<kbd class="cap" aria-hidden="true">{caps.prev}</kbd>{/if}←
				</a>
			{:else if shortcuts}
				<span class="step off" aria-hidden="true"><kbd class="cap">{caps.prev}</kbd>←</span>
			{/if}
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
			{#if page < pages}
				<a class="step" href={href(page + 1)} rel="next" aria-label="Next page">
					→{#if shortcuts}<kbd class="cap" aria-hidden="true">{caps.next}</kbd>{/if}
				</a>
			{:else if shortcuts}
				<span class="step off" aria-hidden="true">→<kbd class="cap">{caps.next}</kbd></span>
			{/if}
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
		color: var(--text-faint);
		font-size: 11px;
	}
	.links {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.links a,
	.here,
	.gap,
	.step {
		min-width: 26px;
		padding: 4px 7px;
		border-radius: var(--radius-2);
		text-align: center;
		font: 500 12px/1 var(--font-mono);
		text-decoration: none;
		color: var(--text-dim);
	}
	.links a,
	.step {
		border: 1px solid var(--border);
	}
	.links a:hover {
		border-color: var(--accent);
		color: var(--accent);
	}
	.here {
		border: 1px solid var(--accent);
		background: var(--accent);
		color: var(--accent-contrast);
	}
	.gap {
		border: none;
		min-width: 0;
		padding: 4px 2px;
	}

	/* the arrow that has nowhere to go: still a box, so nothing shifts */
	.step.off {
		color: var(--text-faint);
		border-style: dashed;
	}
	.step {
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}
	/* the key that presses this arrow, worn on it like TabBar's number caps:
	   quiet, and it never takes the hover colour — it is a fact about the
	   button, not part of the button's state */
	.cap {
		font: 500 10px/1.4 var(--font-mono);
		padding: 0 4px;
		border-radius: var(--radius-1);
		background: var(--surface-raised);
		color: var(--text-dim);
	}
	.step.off .cap {
		color: var(--text-faint);
	}
	/* no keyboard to press below the width where the shell folds its rail
	   (AppShell's `wideAt`); the caps go with TabBar's hint */
	@media (max-width: 899.98px) {
		.cap {
			display: none;
		}
	}
</style>
