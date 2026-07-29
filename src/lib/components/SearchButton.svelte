<script lang="ts">
	/**
	 * The top bar's way into the command palette.
	 *
	 * The keyboard shortcuts are the fast path, but they are also invisible and
	 * a phone has no keyboard to press them on — so the palette gets a control
	 * you can see and tap, sized like the chips beside it.
	 *
	 * Wide, it names its own shortcut; compact it is the magnifier alone, which
	 * is the shape a phone has room for.
	 *
	 * Three keys open the palette and the chip only has room to name one, so it
	 * names Ctrl/Cmd+F: the one already in the hand of anyone who wants to find
	 * something on a page, and the easiest of the three to reach. It does shadow
	 * the browser's find-in-page, which is the cost of saying it out loud — the
	 * other two are in the tooltip for anyone who would rather keep that key.
	 */
	import { onMount } from 'svelte';
	import { searchIcon } from '$lib/nav';

	let { onopen, compact = false }: { onopen: () => void; compact?: boolean } = $props();

	/* Resolved after mount, not during render: this layout is prerendered, so
	   the markup is built on a machine that is nobody's, and a hint baked in
	   there would be wrong for half the readers and would hydrate mismatched. */
	let mod = $state('Ctrl');
	onMount(() => {
		if (/mac|iphone|ipad/i.test(navigator.userAgent)) mod = '⌘';
	});
</script>

<button
	class="search-btn"
	class:compact
	onclick={onopen}
	aria-label="Search"
	title="Search — {mod}+F, {mod}+K or /"
>
	<span class="glyph" aria-hidden="true">{@html searchIcon}</span>
	{#if !compact}
		<span class="label">Search</span>
		<kbd>{mod} F</kbd>
	{/if}
</button>

<style>
	/* 30px like the ready and account chips, so the bar reads as one row of
	   controls rather than three sizes of them */
	.search-btn {
		display: flex;
		align-items: center;
		gap: 7px;
		height: 30px;
		padding: 0 8px 0 9px;
		background: var(--surface);
		color: var(--text-dim);
		border: 1px solid var(--border-strong);
		border-radius: 99px;
		cursor: pointer;
		transition:
			border-color 120ms ease,
			color 120ms ease,
			background 120ms ease;
	}
	.search-btn:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.search-btn.compact {
		width: 30px;
		padding: 0;
		justify-content: center;
	}

	.glyph {
		display: flex;
		flex: none;
	}
	.glyph :global(svg) {
		width: 15px;
		height: 15px;
	}

	.label {
		font: 500 12px/1 var(--font-mono);
		letter-spacing: 0.03em;
	}

	/* the shortcut, worn like a label: quiet, and it never takes the hover
	   colour — it is a fact about the button, not part of the button's state */
	kbd {
		font: 500 10px/1 var(--font-mono);
		color: var(--text-faint);
		background: var(--surface-raised);
		border-radius: var(--radius-1);
		padding: 4px 5px;
	}
</style>
