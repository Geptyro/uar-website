<script lang="ts">
	/**
	 * Hover/focus/tap tooltip. Wraps whatever is put inside it and shows a card
	 * next to it — `label`/`text` for the plain case, the `tip` snippet when the
	 * content needs markup:
	 *
	 *   <Tooltip label={a.name} text={a.tooltip}><img … /></Tooltip>
	 *
	 *   <Tooltip>
	 *     {#snippet tip()}<b>Damage</b> 45 · <b>Range</b> 6{/snippet}
	 *     <span class="chip">…</span>
	 *   </Tooltip>
	 *
	 * The card is position:fixed and flipped/clamped against the viewport, so it
	 * escapes the scrolling main column and .tablewrap overflow instead of being
	 * clipped by them.
	 */
	import type { Snippet } from 'svelte';

	type Placement = 'top' | 'bottom' | 'left' | 'right';

	let {
		children,
		tip,
		label = '',
		text = '',
		placement = 'top',
		delay = 80,
		maxWidth = 300,
		/** false when the wrapped content is already focusable (a link, a button) */
		focusable = true,
		disabled = false
	}: {
		children: Snippet;
		tip?: Snippet;
		label?: string;
		text?: string;
		placement?: Placement;
		delay?: number;
		maxWidth?: number;
		focusable?: boolean;
		disabled?: boolean;
	} = $props();

	const id = $props.id();
	const empty = $derived(!tip && !label && !text);
	/** wrapped content that isn't focusable on its own needs a real button, so
	    keyboard and touch reach the tooltip too */
	const asButton = $derived(focusable && !disabled && !empty);

	let anchor = $state<HTMLElement>();
	let card = $state<HTMLElement>();
	let open = $state(false);
	/** placed only after the first measure, so the card never flashes at 0,0 */
	let placed = $state(false);
	let side = $state<Placement>('top');
	let x = $state(0);
	let y = $state(0);
	let arrow = $state(0);
	let timer: ReturnType<typeof setTimeout> | undefined;

	function show(instant = false) {
		if (disabled || empty) return;
		clearTimeout(timer);
		if (instant || delay <= 0) open = true;
		else timer = setTimeout(() => (open = true), delay);
	}

	function hide() {
		clearTimeout(timer);
		open = false;
		placed = false;
	}

	const opposite: Record<Placement, Placement> = {
		top: 'bottom',
		bottom: 'top',
		left: 'right',
		right: 'left'
	};

	function place() {
		if (!anchor || !card) return;
		const a = anchor.getBoundingClientRect();
		const c = card.getBoundingClientRect();
		const gap = 8;
		const pad = 8;
		const vw = document.documentElement.clientWidth;
		const vh = document.documentElement.clientHeight;

		const fits: Record<Placement, boolean> = {
			top: a.top - c.height - gap >= pad,
			bottom: a.bottom + c.height + gap <= vh - pad,
			left: a.left - c.width - gap >= pad,
			right: a.right + c.width + gap <= vw - pad
		};
		const s =
			([placement, opposite[placement], 'top', 'bottom', 'right', 'left'] as Placement[]).find(
				(p) => fits[p]
			) ?? placement;

		let nx: number;
		let ny: number;
		if (s === 'top' || s === 'bottom') {
			nx = a.left + a.width / 2 - c.width / 2;
			ny = s === 'top' ? a.top - c.height - gap : a.bottom + gap;
		} else {
			nx = s === 'left' ? a.left - c.width - gap : a.right + gap;
			ny = a.top + a.height / 2 - c.height / 2;
		}
		x = Math.min(Math.max(pad, nx), Math.max(pad, vw - c.width - pad));
		y = Math.min(Math.max(pad, ny), Math.max(pad, vh - c.height - pad));

		// the arrow tracks the anchor's centre, which the clamp above may have
		// pushed away from the card's centre
		const along =
			s === 'top' || s === 'bottom' ? a.left + a.width / 2 - x : a.top + a.height / 2 - y;
		const span = s === 'top' || s === 'bottom' ? c.width : c.height;
		arrow = Math.min(Math.max(10, along), Math.max(10, span - 10));

		side = s;
		placed = true;
	}

	$effect(() => {
		if (!open) return;
		place();
		// the page scrolls inside <main>, so listen in the capture phase to catch
		// every scrolling ancestor rather than just the window
		const onMove = () => place();
		window.addEventListener('scroll', onMove, true);
		window.addEventListener('resize', onMove);
		return () => {
			window.removeEventListener('scroll', onMove, true);
			window.removeEventListener('resize', onMove);
		};
	});

	$effect(() => () => clearTimeout(timer));

	/** touch has no hover: tap toggles, and a tap elsewhere closes */
	function onpointerdown(e: PointerEvent) {
		if (e.pointerType !== 'touch') return;
		if (open) hide();
		else show(true);
	}

	function onwindowpointerdown(e: PointerEvent) {
		if (open && anchor && !anchor.contains(e.target as Node)) hide();
	}
</script>

<svelte:window
	onpointerdown={onwindowpointerdown}
	onkeydown={(e) => {
		if (e.key === 'Escape' && open) hide();
	}}
/>

<svelte:element
	this={asButton ? 'button' : 'span'}
	class="tt"
	bind:this={anchor}
	{...asButton ? { type: 'button' } : {}}
	aria-describedby={open ? id : undefined}
	onmouseenter={() => show()}
	onmouseleave={hide}
	onfocusin={() => show(true)}
	onfocusout={hide}
	{onpointerdown}
>
	{@render children()}
</svelte:element>

{#if open}
	<div
		{id}
		role="tooltip"
		class="tt-card {side}"
		class:placed
		bind:this={card}
		style="left: {x}px; top: {y}px; max-width: {maxWidth}px; --arrow: {arrow}px"
	>
		{#if tip}
			{@render tip()}
		{:else}
			{#if label}<b class="tt-label">{label}</b>{/if}
			{#if text}<span class="tt-text">{text}</span>{/if}
		{/if}
		<span class="tt-arrow" aria-hidden="true"></span>
	</div>
{/if}

<style>
	/* button or span depending on whether the wrapped content is focusable —
	   either way it must not look or space like a control of its own */
	.tt {
		display: inline-flex;
		align-items: center;
		margin: 0;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: inherit;
		cursor: inherit;
	}
	.tt-card {
		position: fixed;
		z-index: 60;
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 8px 11px;
		background: var(--surface);
		color: var(--ink);
		border: 1px solid var(--border-strong);
		border-radius: var(--r);
		box-shadow: var(--shadow-2);
		font-size: 12.5px;
		line-height: 1.5;
		text-align: left;
		pointer-events: none;
		/* hidden until the first measure lands, then faded in */
		opacity: 0;
		transition: opacity 110ms ease;
	}
	.tt-card.placed {
		opacity: 1;
	}
	.tt-label {
		font-size: 13px;
		font-weight: 600;
	}
	.tt-text {
		color: var(--ink-2);
		white-space: pre-line;
	}
	.tt-arrow {
		position: absolute;
		width: 8px;
		height: 8px;
		background: var(--surface);
		border: 1px solid var(--border-strong);
		transform: rotate(45deg);
	}
	.top .tt-arrow {
		bottom: -5px;
		left: var(--arrow);
		margin-left: -4px;
		border-width: 0 1px 1px 0;
	}
	.bottom .tt-arrow {
		top: -5px;
		left: var(--arrow);
		margin-left: -4px;
		border-width: 1px 0 0 1px;
	}
	.left .tt-arrow {
		right: -5px;
		top: var(--arrow);
		margin-top: -4px;
		border-width: 1px 1px 0 0;
	}
	.right .tt-arrow {
		left: -5px;
		top: var(--arrow);
		margin-top: -4px;
		border-width: 0 0 1px 1px;
	}
	@media (prefers-reduced-motion: reduce) {
		.tt-card {
			transition: none;
		}
	}
</style>
