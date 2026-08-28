<script lang="ts">
	/**
	 * A modal box with whatever inside: a title, the content, and a strip of
	 * buttons under it. A native <dialog> rather than an overlay, for the
	 * reasons sveltekit-commons' SearchDialog gives: `showModal()` traps focus,
	 * makes the page behind inert, closes on Esc, sits in the top layer above
	 * every piece of chrome, and paints its own backdrop. Drawn on the same
	 * panel as that dialog so the two read as one family.
	 *
	 * Opened and shut through `open` (bindable) or `show()` / `close()`; a
	 * click on the backdrop and Esc shut it too, and `onclose` hears every way
	 * out. What the buttons do is the caller's: see Confirm for the one case
	 * everybody needs.
	 */
	import type { Snippet } from 'svelte';

	let {
		title = '',
		label = undefined,
		open = $bindable(false),
		/** The panel's width in px; narrower on a narrow screen. */
		width = 440,
		children,
		footer,
		onclose
	}: {
		title?: string;
		/** Accessible name when there is no title. */
		label?: string;
		open?: boolean;
		width?: number;
		children?: Snippet;
		footer?: Snippet;
		onclose?: () => void;
	} = $props();

	let dialog = $state<HTMLDialogElement>();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	export function show() {
		open = true;
	}
	export function close() {
		open = false;
	}
</script>

<!-- the backdrop is the dialog element itself; a click inside the panel lands on a child -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog
	bind:this={dialog}
	aria-label={label ?? title}
	onclose={() => {
		open = false;
		onclose?.();
	}}
	onclick={(e) => {
		if (e.target === dialog) close();
	}}
>
	<div class="panel" style:--w="{width}px">
		{#if title}<h2 class="title">{title}</h2>{/if}
		{#if children}<div class="body">{@render children()}</div>{/if}
		{#if footer}<div class="foot">{@render footer()}</div>{/if}
	</div>
</dialog>

<style>
	dialog {
		border: none;
		background: none;
		padding: 0;
		width: 100%;
		height: 100%;
		max-width: 100%;
		max-height: 100%;
		color: inherit;
	}
	dialog[open] {
		display: flex;
		align-items: center;
		justify-content: center;
	}
	dialog::backdrop {
		background: rgb(0 0 0 / 0.55);
		backdrop-filter: blur(2px);
	}
	.panel {
		width: min(var(--w), calc(100vw - 2rem));
		max-height: calc(100vh - 2rem);
		display: flex;
		flex-direction: column;
		background: var(--surface);
		border: var(--border-width) solid var(--border-strong);
		border-radius: var(--radius-3);
		box-shadow: var(--shadow-2);
		overflow: hidden;
	}
	.title {
		margin: 0;
		padding: 14px 16px 0;
		font-size: 15px;
		font-weight: 650;
		line-height: 1.3;
		color: var(--text);
	}
	.body {
		padding: 10px 16px 14px;
		overflow-y: auto;
		font-size: 13.5px;
		line-height: 1.5;
		color: var(--text-dim);
	}
	.body :global(p) {
		margin: 0;
	}
	.body :global(p + p) {
		margin-top: 8px;
	}
	.foot {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 8px;
		padding: 10px 12px;
		border-top: var(--border-width) solid var(--border);
		background: var(--surface-sunken);
	}
</style>
