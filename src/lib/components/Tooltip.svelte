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
	 * `href` makes the whole thing a link to the subject's own page, and puts
	 * that link at the foot of the card as well. The two input methods want
	 * opposite things from a tap, so they get opposite things:
	 *
	 *   mouse — hover reads the card, click goes straight through to the page
	 *   finger — no hover exists, so a tap opens the card and the link in it is
	 *            the way through; the anchor's own navigation is suppressed
	 *
	 * A card with a link in it is interactive: it takes the pointer, it survives
	 * the trip across the gap from the anchor, and it does not claim
	 * role="tooltip" — a tooltip may not contain a link.
	 *
	 * (Don't pass `href` around content that is already a link — the anchor
	 * becomes an <a> and anchors cannot nest.)
	 *
	 * The card is position:fixed and flipped/clamped against the viewport by the
	 * shared placer, so it escapes the scrolling main column and .tablewrap
	 * overflow instead of being clipped by them, and never hangs off a screen
	 * edge on a phone.
	 */
	import type { Snippet } from 'svelte';
	import { placeFloating, type Placement } from 'uar-shared/place';

	let {
		children,
		tip,
		label = '',
		text = '',
		/** the thing's own page — rendered as a link at the foot of the card */
		href = '',
		linkText = '',
		/** a fixed side, or 'entry' — see entrySide below */
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
		href?: string;
		linkText?: string;
		placement?: Placement | 'entry';
		delay?: number;
		maxWidth?: number;
		focusable?: boolean;
		disabled?: boolean;
	} = $props();

	const id = $props.id();
	const empty = $derived(!tip && !label && !text && !href);
	/** a card you can reach into, rather than one that only reads */
	const interactive = $derived(!!href);
	/** a real <a>, so a mouse click, a middle-click and Enter all just work */
	const asLink = $derived(!!href && !disabled);
	/** wrapped content that isn't focusable on its own needs a real button, so
	    keyboard and touch reach the tooltip too */
	const asButton = $derived(!asLink && focusable && !disabled && !empty);

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
	/**
	 * With `placement="entry"` the card opens on the side the pointer came in
	 * through, which is the side it came *from* — so it lands behind the travel,
	 * not across it. Sweeping a grid left to right, each card falls on the tiles
	 * already read rather than over the ones about to be hovered. Keyboard and
	 * touch have no travel to read, so they keep the default side.
	 */
	let entry = $state<Placement>('top');
	/** opened by a tap rather than a hover — see the scroll handling below */
	let byTap = false;

	function edgeEntered(r: DOMRect, x: number, y: number): Placement {
		const d: Record<Placement, number> = {
			left: x - r.left,
			right: r.right - x,
			top: y - r.top,
			bottom: r.bottom - y
		};
		return (Object.keys(d) as Placement[]).reduce((a, b) => (d[b] < d[a] ? b : a));
	}

	function enter(e: MouseEvent) {
		if (placement === 'entry' && anchor) {
			entry = edgeEntered(anchor.getBoundingClientRect(), e.clientX, e.clientY);
		}
		show();
	}

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
		byTap = false;
	}

	/** an interactive card must survive the pointer crossing the gap to it */
	function leave() {
		clearTimeout(timer);
		if (!interactive) return hide();
		timer = setTimeout(hide, 140);
	}

	/** ...and must not close on the way to the link inside it */
	function leaveFocus(e: FocusEvent) {
		const to = e.relatedTarget as Node | null;
		if (interactive && to && (anchor?.contains(to) || card?.contains(to))) return;
		hide();
	}

	function place() {
		if (!anchor || !card) return;
		const r = placeFloating({
			anchor: anchor.getBoundingClientRect(),
			card: card.getBoundingClientRect(),
			viewport: {
				width: document.documentElement.clientWidth,
				height: document.documentElement.clientHeight
			},
			placement: placement === 'entry' ? entry : placement
		});
		x = r.x;
		y = r.y;
		side = r.side;
		arrow = r.arrow;
		placed = true;
	}

	$effect(() => {
		if (!open) return;
		place();
		/**
		 * A hovered card follows its anchor: the pointer is still on the thing,
		 * and a card that vanished on a wheel nudge would be unreadable. A tapped
		 * one closes instead — a finger has nothing holding it open, and on a
		 * phone the card is the size of the content being scrolled past.
		 */
		const onScroll = () => (byTap ? hide() : place());
		// the page scrolls inside <main>, so listen in the capture phase to catch
		// every scrolling ancestor rather than just the window
		window.addEventListener('scroll', onScroll, true);
		window.addEventListener('resize', place);
		return () => {
			window.removeEventListener('scroll', onScroll, true);
			window.removeEventListener('resize', place);
		};
	});

	$effect(() => () => clearTimeout(timer));

	/** what opened the last interaction — a finger's tap must not also navigate */
	let byTouch = false;

	/** How far a finger may travel, and how long it may rest, and still be a tap. */
	const TAP_SLOP_PX = 10;
	const TAP_MS = 700;
	/** where a finger went down, so a scroll is not read as a tap */
	let down: { x: number; y: number; at: number } | null = null;

	/**
	 * Touch has no hover, so a tap is what opens the card — but a scroll starts
	 * with a finger on the same tile, and acting on pointerdown opened a card
	 * under every flick of the page. The decision waits for pointerup and only
	 * counts a finger that stayed put: anything that travelled is the page
	 * moving, and pointercancel is the browser saying so outright.
	 */
	function onpointerdown(e: PointerEvent) {
		byTouch = e.pointerType === 'touch';
		down = byTouch ? { x: e.clientX, y: e.clientY, at: e.timeStamp } : null;
	}

	function onpointerup(e: PointerEvent) {
		if (!down) return;
		const travelled = Math.hypot(e.clientX - down.x, e.clientY - down.y);
		const held = e.timeStamp - down.at;
		down = null;
		if (travelled > TAP_SLOP_PX || held > TAP_MS) return;
		// a fresh tap reads the card from the default side, not from wherever the
		// pointer last entered with a mouse
		entry = 'top';
		if (open) return hide();
		byTap = true;
		show(true);
	}

	/** the browser claimed the gesture for a scroll — there was no tap */
	function onpointercancel() {
		down = null;
	}

	/**
	 * A mouse click goes through to the page — that is what the anchor is for.
	 * A tap does not: it just opened the card, and the card's own link is the
	 * way on. Keyboard activation reports detail 0 and always goes through.
	 */
	function onclick(e: MouseEvent) {
		if (asLink && byTouch && e.detail > 0) e.preventDefault();
	}

	function onwindowpointerdown(e: PointerEvent) {
		if (!open || !anchor) return;
		const t = e.target as Node;
		// a tap on the card is a tap on its link, not a tap outside
		if (anchor.contains(t) || card?.contains(t)) return;
		hide();
	}
</script>

<svelte:window
	onpointerdown={onwindowpointerdown}
	onkeydown={(e) => {
		if (e.key === 'Escape' && open) hide();
	}}
/>

<svelte:element
	this={asLink ? 'a' : asButton ? 'button' : 'span'}
	class="tt"
	bind:this={anchor}
	{...asLink ? { href } : asButton ? { type: 'button' } : {}}
	aria-describedby={open ? id : undefined}
	onmouseenter={enter}
	onmouseleave={leave}
	onfocusin={() => show(true)}
	onfocusout={leaveFocus}
	{onpointerdown}
	{onpointerup}
	{onpointercancel}
	{onclick}
>
	{@render children()}
</svelte:element>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		{id}
		role={interactive ? undefined : 'tooltip'}
		class="tt-card {side}"
		class:placed
		class:interactive
		bind:this={card}
		style="left: {x}px; top: {y}px; max-width: {maxWidth}px; --arrow: {arrow}px"
		onmouseenter={() => show(true)}
		onmouseleave={leave}
		onfocusout={leaveFocus}
	>
		{#if tip}
			{@render tip()}
		{:else}
			{#if label}<b class="tt-label">{label}</b>{/if}
			{#if text}<span class="tt-text">{text}</span>{/if}
		{/if}
		{#if href}
			<!-- the anchor is already this link for a mouse and a keyboard; in the
			     card it exists for the finger that has no other way through, so it
			     stays out of the tab order rather than offering the same
			     destination twice -->
			<a class="tt-link" {href} tabindex="-1">{linkText || 'Open'} →</a>
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
		text-decoration: none;
		cursor: inherit;
		/* The browser flashes its blue "you followed a link" box over any
		   tappable element, and over this one it says the wrong thing: a tap
		   opens the card, only a click navigates. It also flashed on a scroll
		   that merely started here. The card arriving is the acknowledgement. */
		-webkit-tap-highlight-color: transparent;
	}
	.tt-card {
		position: fixed;
		z-index: var(--z-float, 60);
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
	/* only a card with something to click takes the pointer back */
	.tt-card.interactive {
		pointer-events: auto;
	}
	/* the way through to the thing's own page, on its own rule at the foot —
	   the same shape the overview's "Full changelog →" uses */
	.tt-link {
		margin-top: 2px;
		padding-top: 7px;
		border-top: 1px solid var(--border);
		font-size: 12px;
		font-weight: 550;
		color: var(--accent);
		text-decoration: none;
	}
	.tt-link:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
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
