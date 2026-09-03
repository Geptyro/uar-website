<script lang="ts">
	/**
	 * What the guide markdown renderer's HTML needs from the page around it:
	 * the styles of its elements (`.md`, the reference chips, key caps,
	 * tables in the site's frame, pictures) and the hover card on the chips.
	 * Wrap anything that shows that HTML in this, on any page: a guide's
	 * document, an SI's menu, a line of inline markdown.
	 *
	 * `:global` under `.rich`, because the markup is the renderer's and
	 * Svelte's scoping cannot reach it. What the renderer can emit is an
	 * allow-list, so this is the whole of it.
	 *
	 * A chip's hover card is the site's Tooltip, drawn by hand: Tooltip wraps a
	 * Svelte child, and these chips are HTML the renderer wrote, so one card
	 * here listens for the pointer over any `[data-tip]` inside (the renderer
	 * put the in-game text on the chip) and takes the same look and the same
	 * placer. Mouse and keyboard; a tap on a chip is the link.
	 */
	import type { Snippet } from 'svelte';
	import { placeFloating, type Placement } from 'sveltekit-commons/place';

	let { children }: { children: Snippet } = $props();

	let tip = $state<{ name: string; text: string; icon: string | null; html: string | null } | null>(null);
	let card = $state<HTMLElement>();
	let anchor: HTMLElement | null = null;
	let x = $state(0);
	let y = $state(0);
	let side = $state<Placement>('top');
	let arrow = $state(0);
	let placed = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	const chipOf = (t: EventTarget | null) =>
		(t instanceof Element ? t.closest('[data-tip]') : null) as HTMLElement | null;

	function show(el: HTMLElement, delay: number) {
		if (el === anchor) return;
		anchor = el;
		clearTimeout(timer);
		timer = setTimeout(() => {
			tip = { name: el.dataset.tipName ?? '', text: el.dataset.tip ?? '', icon: el.dataset.tipIcon ?? null, html: el.dataset.tipHtml ?? null };
			placed = false;
		}, delay);
	}
	function hide() {
		clearTimeout(timer);
		anchor = null;
		tip = null;
		placed = false;
	}
	function over(e: MouseEvent) {
		const el = chipOf(e.target);
		if (el) show(el, 80);
	}
	function out(e: MouseEvent) {
		const el = chipOf(e.target);
		if (!el) return;
		const to = e.relatedTarget;
		if (to instanceof Node && el.contains(to)) return;
		hide();
	}
	function focusIn(e: FocusEvent) {
		const el = chipOf(e.target);
		if (el) show(el, 0);
	}

	/** The listeners, delegated on the wrapper: the chips are not Svelte's to attach to. */
	function tips(node: HTMLElement) {
		node.addEventListener('mouseover', over);
		node.addEventListener('mouseout', out);
		node.addEventListener('focusin', focusIn);
		node.addEventListener('focusout', hide);
		return {
			destroy() {
				node.removeEventListener('mouseover', over);
				node.removeEventListener('mouseout', out);
				node.removeEventListener('focusin', focusIn);
				node.removeEventListener('focusout', hide);
				hide();
			}
		};
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
			placement: 'top'
		});
		x = r.x;
		y = r.y;
		side = r.side;
		arrow = r.arrow;
		placed = true;
	}

	$effect(() => {
		if (!tip) return;
		place();
		// the page scrolls inside <main>: capture phase catches every scroller
		window.addEventListener('scroll', place, true);
		window.addEventListener('resize', place);
		return () => {
			window.removeEventListener('scroll', place, true);
			window.removeEventListener('resize', place);
		};
	});
	$effect(() => () => clearTimeout(timer));
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && tip) hide();
	}}
/>

<div class="rich" use:tips>
	{@render children()}
</div>

{#if tip}
	<div
		role="tooltip"
		class="tt-card {side}"
		class:placed
		bind:this={card}
		style="left: {x}px; top: {y}px; --arrow: {arrow}px"
	>
		{#if tip.icon || tip.name}
			<div class="tt-head">
				{#if tip.icon}<img class="tt-icon" src={tip.icon} alt="" />{/if}
				{#if tip.name}<b class="tt-label">{tip.name}</b>{/if}
			</div>
		{/if}
		{#if tip.html}
			<!-- the server's own card (a player's): built and escaped there, never a reader's text -->
			<div class="tt-body">{@html tip.html}</div>
		{:else if tip.text}<span class="tt-text">{tip.text}</span>{/if}
		<span class="tt-arrow" aria-hidden="true"></span>
	</div>
{/if}

<style>
		/* ---------- the hover card: Tooltip's, to the pixel ---------- */
	/* the thing's picture in the corner, its name beside it, level with it */
	.tt-head {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.tt-icon {
		width: 75px;
		height: 75px;
		flex: none;
		border-radius: var(--radius-2);
		object-fit: cover;
		background: var(--surface-sunken);
		border: 1px solid var(--border);
	}
	/* a player's card: the standing line, then two rows of pictures with names */
	.tt-body :global(.pc-line) {
		color: var(--text-dim);
		font-size: 12px;
	}
	.tt-body :global(.pc-sect) {
		margin-top: 6px;
		font-family: var(--font-mono);
		font-size: 9.5px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text-faint);
	}
	/* a card with the two lists is wider than a description's */
	.tt-card:has(:global(.pc-cols)) {
		max-width: 380px;
	}
	/* the two lists side by side, each a small table: picture, name, count on the right */
	.tt-body :global(.pc-cols) {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 0 14px;
	}
	.tt-body :global(.pc-list) {
		display: flex;
		flex-direction: column;
		gap: 3px;
		margin-top: 3px;
	}
	.tt-body :global(.pc-entry) {
		display: flex;
		align-items: center;
		gap: 5px;
		min-width: 0;
		font-size: 12px;
		color: var(--text);
	}
	.tt-body :global(.pc-entry > span) {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tt-body :global(.pc-none) {
		font-size: 11.5px;
		color: var(--text-faint);
	}
	.tt-body :global(.pc-entry img),
	.tt-body :global(.pc-entry i) {
		width: 20px;
		height: 20px;
		border-radius: 4px;
		object-fit: cover;
		background: var(--surface-sunken);
		display: inline-grid;
		place-items: center;
		font: 700 9px/1 var(--font-mono);
		font-style: normal;
		color: var(--text-dim);
	}
	.tt-body :global(.pc-entry.round img),
	.tt-body :global(.pc-entry.round i) {
		border-radius: 50%;
	}
	.tt-body :global(.pc-entry small) {
		flex: none;
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--text-faint);
	}
	.tt-card {
		position: fixed;
		z-index: var(--z-float, 60);
		display: flex;
		flex-direction: column;
		gap: 4px;
		max-width: 300px;
		padding: 8px 11px;
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-3);
		box-shadow: var(--shadow-2);
		font-size: 12.5px;
		line-height: 1.5;
		text-align: left;
		pointer-events: none;
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
		color: var(--text-dim);
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

	/* ---------- the markdown's own elements ---------- */
	.rich :global(.md) {
		min-width: 0;
		font-size: 13.5px;
		line-height: 1.6;
	}
	.rich :global(.md p) {
		margin: 0 0 10px;
	}
	.rich :global(.md > :last-child) {
		margin-bottom: 0;
	}
	.rich :global(.md h2),
	.rich :global(.md h3),
	.rich :global(.md h4) {
		margin: 16px 0 6px;
		line-height: 1.3;
	}
	.rich :global(.md h2) {
		font-size: 15px;
		font-weight: 650;
	}
	.rich :global(.md h3) {
		font-size: 13.5px;
		font-weight: 650;
	}
	.rich :global(.md h4) {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-faint);
		font-weight: 500;
	}
	.rich :global(.md :is(h2, h3, h4):first-child) {
		margin-top: 0;
	}
	/* in a card, a `#` heading is the card's eyebrow, as the guide's h3 is */
	.rich :global(.md.incard h2) {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-faint);
		font-weight: 500;
		margin: 0 0 9px;
	}
	.rich :global(.md ol) {
		margin: 0 0 10px;
		padding-left: 22px;
	}
	.rich :global(.md li) {
		margin: 3px 0;
	}
	/* the guide's bullet (`.pts li`): a small accent dot, not the browser's disc */
	.rich :global(.md ul) {
		list-style: none;
		margin: 0 0 10px;
		padding: 0;
	}
	.rich :global(.md ul li) {
		position: relative;
		padding-left: 14px;
	}
	.rich :global(.md ul li::before) {
		content: '';
		position: absolute;
		left: 0;
		top: 9px;
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: var(--accent);
	}
	.rich :global(.md ul ul) {
		margin: 3px 0 0;
	}
	.rich :global(.md.incard ol) {
		padding-left: 18px;
	}
	.rich :global(.md.incard ul li::before) {
		top: 8px;
	}
	.rich :global(.md.incard li) {
		margin: 0 0 7px;
		font-size: 12.5px;
		line-height: 1.5;
		color: var(--text-dim);
	}
	.rich :global(.md.incard li b) {
		color: var(--text);
	}
	.rich :global(.md li > p) {
		margin: 0;
	}
	.rich :global(.md a) {
		color: var(--accent);
	}
	.rich :global(.md blockquote) {
		margin: 0 0 10px;
		padding: 8px 14px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-left: 3px solid var(--accent);
		border-radius: var(--radius-2);
		color: var(--text-dim);
	}
	.rich :global(.md blockquote > :last-child) {
		margin-bottom: 0;
	}
	.rich :global(.md code) {
		font-family: var(--font-mono);
		font-size: 11.5px;
		background: var(--surface-raised);
		border-radius: 4px;
		padding: 1px 5px;
	}
	/* the guide's key cap */
	.rich :global(.md kbd) {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 650;
		color: var(--text);
		background: var(--surface);
		border: 1px solid var(--border-strong);
		border-bottom-width: 2px;
		border-radius: 4px;
		padding: 0 5px;
	}
	.rich :global(.md pre) {
		margin: 0 0 10px;
		padding: 10px 12px;
		overflow-x: auto;
		background: var(--surface-raised);
		border-radius: var(--radius-2);
	}
	.rich :global(.md pre code) {
		padding: 0;
		background: none;
	}
	.rich :global(.md hr) {
		border: 0;
		border-top: 1px solid var(--border);
		margin: 16px 0;
	}

	/* ---------- tables written in markdown: the site's own frame ---------- */
	.rich :global(.md .tablewrap) {
		margin: 4px 0 12px;
	}
	.rich :global(.md.incard .tablewrap) {
		border: 0;
		box-shadow: none;
		border-radius: 0;
		background: none;
	}
	.rich :global(.md table.data) {
		font-size: 12.5px;
	}
	.rich :global(.md table.data th) {
		position: static;
	}
	.rich :global(.md table.data :is(th, td):not(:last-child)) {
		width: 1%;
		white-space: nowrap;
	}
	.rich :global(.md table.data td:last-child) {
		min-width: 240px;
	}

	/* ---------- pictures ---------- */
	.rich :global(.md .md-fig) {
		margin: 4px 0 12px;
	}
	.rich :global(.md img) {
		max-width: 100%;
		height: auto;
		display: block;
		border-radius: var(--radius-2);
		border: 1px solid var(--border);
		background: var(--surface-raised);
	}
	.rich :global(.md figcaption) {
		margin-top: 5px;
		font-size: 11px;
		line-height: 1.45;
		color: var(--text-faint);
	}
	.rich :global(.md p > .md-fig) {
		display: inline-block;
		vertical-align: middle;
		margin: 2px 4px;
		max-width: 48%;
	}

	/* ---------- the game's own things, as chips ---------- */
	.rich :global(.ref) {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		vertical-align: middle;
		padding: 1px 8px 1px 3px;
		border-radius: 99px;
		background: var(--surface-raised);
		border: 1px solid var(--border);
		color: var(--text);
		font-size: 12px;
		font-weight: 550;
		line-height: 1.4;
		text-decoration: none;
		white-space: nowrap;
	}
	.rich :global(a.ref:hover) {
		border-color: var(--border-strong);
	}
	.rich :global(.ref-icon) {
		width: 18px;
		height: 18px;
		object-fit: cover;
		border-radius: 4px;
		border: 0;
		display: inline-block;
		background: none;
	}
	/* the initials tile the class pages use where the map has no icon */
	.rich :global(.ref-icon.ph),
	.rich :global(.ref-entry-icon.ph) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-mono);
		font-weight: 650;
		background: var(--surface-raised);
		color: var(--text-dim);
	}
	.rich :global(.ref-icon.ph) {
		font-size: 8.5px;
	}
	.rich :global(.ref-entry-icon.ph) {
		font-size: 12px;
	}
	.rich :global(.ref-skill),
	.rich :global(.ref-ability),
	.rich :global(.ref-mos) {
		color: var(--mos);
		background: var(--mos-soft);
		border-color: transparent;
	}
	.rich :global(.ref-item) {
		color: var(--item);
		background: var(--item-soft);
		border-color: transparent;
	}
	.rich :global(.ref-unit) {
		color: var(--hostile);
		background: var(--hostile-soft);
		border-color: transparent;
	}
	.rich :global(.ref-si) {
		color: var(--accent);
		background: var(--accent-soft);
		border-color: transparent;
	}
	.rich :global(.ref-effect) {
		color: var(--accent);
		background: var(--accent-soft);
		border-color: transparent;
	}
	.rich :global(.ref-mission) {
		color: var(--text);
		background: var(--surface-sunken);
		border-color: var(--border-strong);
	}
	.rich :global(.ref-player) {
		color: var(--mos);
		background: var(--surface-raised);
		border-color: var(--mos);
	}
	.rich :global(.ref-player .ref-icon) {
		border-radius: 50%;
	}
	/* the entry form: the guide's table name cell and icon list item */
	.rich :global(.ref-entry) {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		vertical-align: middle;
		color: var(--text);
		text-decoration: none;
	}
	.rich :global(.ref-entry b) {
		font-weight: 550;
	}
	.rich :global(a.ref-entry:hover b) {
		color: var(--accent);
	}
	.rich :global(.ref-entry-icon) {
		width: 30px;
		height: 30px;
		object-fit: cover;
		border-radius: 4px;
		border: 0;
		display: inline-block;
		background: var(--surface-raised);
		flex: none;
	}
	.rich :global(li .ref-entry-icon) {
		width: 26px;
		height: 26px;
	}
	.rich :global(li .ref-entry) {
		margin-right: 2px;
	}
	.rich :global(.ref-missing) {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--hostile);
		border-style: dashed;
		padding: 1px 6px;
	}
</style>
