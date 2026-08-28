<script lang="ts">
	/**
	 * A writing surface that shows a reference as the chip it will be, not as
	 * the `[[skill:Security]]` behind it. A contenteditable in which every
	 * reference is one atomic node (contenteditable="false": the caret steps
	 * over it, Backspace takes it whole) and everything else is the text as
	 * typed, markdown included. The markdown is still the truth: `value` is
	 * always the serialised text, and the field speaks to MarkdownField in
	 * offsets of that text, the way a textarea does, so the `@` search and
	 * the inserts are one implementation for both surfaces.
	 *
	 * Typing a complete `[[…]]` by hand, or pasting one, turns into a chip
	 * on the spot. Only the reference kinds are chips; a key cap, a picture
	 * or bold text stay as written, since a box this size is for a sentence
	 * and the preview shows the rest.
	 */
	import { tick } from 'svelte';
	import { refResolver } from '$lib/buildRefs';

	let {
		value = $bindable(''),
		mosId = null,
		placeholder = '',
		name = undefined,
		oninput,
		onkeydown,
		onkeyup,
		onclick,
		onblur,
		onpaste,
		ondrop
	}: {
		value: string;
		mosId?: string | null;
		placeholder?: string;
		name?: string;
		oninput?: () => void;
		onkeydown?: (e: KeyboardEvent) => void;
		onkeyup?: (e: KeyboardEvent) => void;
		onclick?: () => void;
		onblur?: () => void;
		/** First look at a paste (a picture?); when it prevents the default, the text is not inserted. */
		onpaste?: (e: ClipboardEvent) => void;
		ondrop?: (e: DragEvent) => void;
	} = $props();

	let root = $state<HTMLDivElement>();
	/** What the DOM last serialised to: a `value` that differs came from outside, and the DOM follows it. */
	let shown = '';

	const TOKEN = /(\[\[|\{\{)(?:([a-z]+):)?([^\]}|\n]+?)(?:\|([^\]}\n]+))?(\]\]|\}\})/g;
	const resolve = $derived(refResolver(mosId));
	const initials = (s: string) =>
		s
			.split(/[\s-]+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0]?.toUpperCase() ?? '')
			.join('');
	const isChip = (n: Node): n is HTMLElement => n instanceof HTMLElement && n.dataset.ref !== undefined;

	/* ---------- markdown <-> DOM ---------- */

	function chipNode(raw: string, kind: string | null, ref: string, label: string | undefined): HTMLElement {
		const target = kind === 'key' ? null : resolve(kind, ref);
		const el = document.createElement('span');
		el.contentEditable = 'false';
		el.dataset.ref = raw;
		el.className = `chip ${target ? `ref-${target.kind}` : 'ref-missing'}`;
		if (!target) {
			el.textContent = raw;
			return el;
		}
		const words = label ?? target.name;
		if (target.icon) {
			const img = document.createElement('img');
			img.src = target.icon;
			img.alt = '';
			el.appendChild(img);
		} else {
			const ph = document.createElement('i');
			ph.textContent = initials(words);
			el.appendChild(ph);
		}
		el.appendChild(document.createTextNode(words));
		el.title = target.name === words ? target.name : `${target.name} · ${raw}`;
		return el;
	}

	/** The nodes for a piece of markdown: text as it is, references as chips. */
	function nodesFor(text: string): Node[] {
		const out: Node[] = [];
		let last = 0;
		for (const m of text.matchAll(TOKEN)) {
			if (m.index > last) out.push(document.createTextNode(text.slice(last, m.index)));
			out.push(chipNode(m[0], m[2] ?? null, m[3], m[4]));
			last = m.index + m[0].length;
		}
		if (last < text.length) out.push(document.createTextNode(text.slice(last)));
		return out;
	}

	function render(text: string) {
		if (!root) return;
		root.replaceChildren(...nodesFor(text));
		shown = text;
	}

	/** The markdown the DOM holds: text as text, a chip as what it stands for, a break as a newline. */
	function serialize(node: Node = root!): string {
		let s = '';
		for (const n of node.childNodes) {
			if (n.nodeType === Node.TEXT_NODE) s += n.textContent ?? '';
			else if (isChip(n)) s += n.dataset.ref;
			else if (n instanceof HTMLBRElement) s += '\n';
			else if (n instanceof HTMLElement) {
				// a block a browser wrapped a line in: its words, on their own line
				if (s && !s.endsWith('\n') && (n.tagName === 'DIV' || n.tagName === 'P')) s += '\n';
				s += serialize(n);
			}
		}
		return s;
	}

	/* ---------- offsets in the markdown <-> positions in the DOM ---------- */

	const lengthOf = (n: Node): number =>
		n.nodeType === Node.TEXT_NODE
			? (n.textContent ?? '').length
			: isChip(n)
				? n.dataset.ref!.length
				: n instanceof HTMLBRElement
					? 1
					: serialize(n).length;

	/** The markdown offset of a DOM position (a node and an offset in it). */
	function posOf(node: Node, offset: number): number {
		if (!root) return 0;
		// inside a chip: the chip's end
		const el = node instanceof Element ? node : node.parentElement;
		const chip = el?.closest('[data-ref]');
		if (chip && chip !== root && root.contains(chip)) {
			node = chip;
			offset = 1;
		}
		let pos = 0;
		const walk = (parent: Node): boolean => {
			for (let i = 0; i < parent.childNodes.length; i++) {
				const child = parent.childNodes[i];
				if (parent === node && i === offset) return true;
				if (child === node) {
					if (node.nodeType === Node.TEXT_NODE) pos += Math.min(offset, (node.textContent ?? '').length);
					else if (offset > 0) pos += lengthOf(child);
					return true;
				}
				if (child.nodeType === Node.TEXT_NODE || isChip(child) || child instanceof HTMLBRElement) {
					pos += lengthOf(child);
				} else if (child.contains(node)) {
					if (walk(child)) return true;
				} else pos += lengthOf(child);
			}
			return parent === node && offset >= parent.childNodes.length;
		};
		walk(root);
		return pos;
	}

	/** The DOM position of a markdown offset: in a text node, or between children at a chip's edge. */
	function domOf(pos: number): { node: Node; offset: number } {
		let left = pos;
		const r = root!;
		for (let i = 0; i < r.childNodes.length; i++) {
			const child = r.childNodes[i];
			const len = lengthOf(child);
			if (child.nodeType === Node.TEXT_NODE) {
				if (left <= len) return { node: child, offset: left };
			} else if (left < len || (left === len && i === r.childNodes.length - 1)) {
				return { node: r, offset: left === 0 ? i : i + 1 };
			}
			left -= len;
		}
		return { node: r, offset: r.childNodes.length };
	}

	/* ---------- the textarea's language, for MarkdownField ---------- */

	function selection(): [number, number] {
		const s = window.getSelection();
		if (!root || !s || !s.rangeCount || !s.anchorNode || !root.contains(s.anchorNode)) return [value.length, value.length];
		const a = posOf(s.anchorNode, s.anchorOffset);
		const f = s.focusNode ? posOf(s.focusNode, s.focusOffset) : a;
		return [Math.min(a, f), Math.max(a, f)];
	}
	export function sel(): [number, number] {
		return selection();
	}
	export function setSel(a: number, b: number) {
		if (!root) return;
		const s = domOf(a);
		const e = domOf(b);
		const range = document.createRange();
		range.setStart(s.node, s.offset);
		range.setEnd(e.node, e.offset);
		const w = window.getSelection();
		w?.removeAllRanges();
		w?.addRange(range);
	}
	export function focus() {
		root?.focus();
	}
	/** Where a markdown offset is drawn, in the field's own box (its offset parent). */
	export function caretXY(pos: number): { top: number; left: number } {
		if (!root) return { top: 0, left: 0 };
		const { node, offset } = domOf(pos);
		const range = document.createRange();
		range.setStart(node, offset);
		range.collapse(true);
		let rect = range.getClientRects()[0];
		if (!rect) {
			// a boundary with no glyph to measure: a zero-width mark, gone at once
			const mark = document.createElement('span');
			mark.textContent = '​';
			range.insertNode(mark);
			rect = mark.getBoundingClientRect();
			mark.remove();
			root.normalize();
		}
		const base = (root.offsetParent ?? root).getBoundingClientRect();
		return { top: rect.top - base.top + lineH() + 2, left: rect.left - base.left };
	}
	export function box(): DOMRect {
		return root?.getBoundingClientRect() ?? new DOMRect();
	}
	export function width(): number {
		return root?.clientWidth ?? 0;
	}
	export function lineH(): number {
		return root ? parseFloat(getComputedStyle(root).lineHeight) || 20 : 20;
	}

	/* ---------- editing ---------- */

	function changed() {
		if (!root) return;
		const text = serialize();
		if (text === '') root.replaceChildren();
		value = text;
		shown = text;
		// a reference typed or pasted as text becomes its chip, the caret kept
		const loose = [...root.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join(' ');
		// a global regex carries lastIndex from test() into matchAll(): reset before either
		TOKEN.lastIndex = 0;
		const found = TOKEN.test(loose);
		TOKEN.lastIndex = 0;
		if (found) {
			const [pos] = selection();
			render(text);
			setSel(pos, pos);
		}
		oninput?.();
	}

	function insertText(text: string) {
		// execCommand keeps the browser's undo stack, which a hand-rolled insert would not
		if (!document.execCommand('insertText', false, text)) {
			const s = window.getSelection();
			if (!s?.rangeCount) return;
			const range = s.getRangeAt(0);
			range.deleteContents();
			range.insertNode(document.createTextNode(text));
			range.collapse(false);
			changed();
		}
	}

	function keydown(e: KeyboardEvent) {
		onkeydown?.(e);
		if (e.defaultPrevented) return;
		if (e.key === 'Enter' && !e.isComposing) {
			// a newline as text, never the <div> a browser would wrap the line in
			e.preventDefault();
			insertText('\n');
			return;
		}
		if ((e.key === 'Backspace' || e.key === 'Delete') && root) {
			// a chip goes whole, from either side
			const s = window.getSelection();
			if (!s?.rangeCount || !s.isCollapsed) return;
			const { anchorNode, anchorOffset } = s;
			let chip: Node | null = null;
			if (anchorNode === root) {
				chip = e.key === 'Backspace' ? (root.childNodes[anchorOffset - 1] ?? null) : (root.childNodes[anchorOffset] ?? null);
			} else if (anchorNode?.nodeType === Node.TEXT_NODE) {
				if (e.key === 'Backspace' && anchorOffset === 0) chip = anchorNode.previousSibling;
				if (e.key === 'Delete' && anchorOffset === (anchorNode.textContent ?? '').length) chip = anchorNode.nextSibling;
			}
			if (chip && isChip(chip)) {
				e.preventDefault();
				const [pos] = selection();
				const at = e.key === 'Backspace' ? pos - chip.dataset.ref!.length : pos;
				chip.remove();
				changed();
				setSel(at, at);
			}
		}
	}

	function paste(e: ClipboardEvent) {
		onpaste?.(e);
		if (e.defaultPrevented) return;
		e.preventDefault();
		const text = e.clipboardData?.getData('text/plain') ?? '';
		if (text) insertText(text);
	}

	// a value set from outside (emptied after a send, filled for an edit) redraws the surface
	$effect(() => {
		const v = value;
		if (root && v !== shown) {
			render(v);
			void tick().then(() => setSel(v.length, v.length));
		}
	});
</script>

<div
	class="ce"
	bind:this={root}
	contenteditable="true"
	tabindex="0"
	role="textbox"
	aria-multiline="true"
	aria-label={placeholder}
	data-placeholder={placeholder}
	spellcheck="true"
	oninput={changed}
	onkeydown={keydown}
	{onkeyup}
	{onclick}
	{onblur}
	onpaste={paste}
	ondragover={(e) => e.preventDefault()}
	ondrop={(e) => {
		ondrop?.(e);
		if (!e.defaultPrevented) e.preventDefault();
	}}
></div>
{#if name}<input type="hidden" {name} {value} />{/if}

<style>
	.ce {
		width: 100%;
		min-height: 72px;
		padding: 8px 10px;
		font: 13px/1.7 var(--font-mono);
		color: var(--text);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		outline: none;
		cursor: text;
	}
	.ce:empty::before {
		content: attr(data-placeholder);
		color: var(--text-faint);
		pointer-events: none;
	}
	/* a chip, as the page will draw it (see Rich): the kind's colour, its picture, its words */
	.ce :global(.chip) {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		vertical-align: baseline;
		margin: 0 1px;
		padding: 0 7px 0 3px;
		border: 1px solid transparent;
		border-radius: 99px;
		font: 600 12px/18px var(--font-sans);
		user-select: none;
		cursor: default;
	}
	.ce :global(.chip img),
	.ce :global(.chip i) {
		width: 14px;
		height: 14px;
		border-radius: 4px;
		object-fit: cover;
	}
	.ce :global(.chip i) {
		display: inline-grid;
		place-items: center;
		font: 700 8px/1 var(--font-mono);
		font-style: normal;
		background: var(--surface-sunken);
		color: var(--text-dim);
	}
	.ce :global(.ref-skill),
	.ce :global(.ref-ability),
	.ce :global(.ref-mos) {
		color: var(--mos);
		background: var(--mos-soft);
	}
	.ce :global(.ref-item) {
		color: var(--item);
		background: var(--item-soft);
	}
	.ce :global(.ref-unit) {
		color: var(--hostile);
		background: var(--hostile-soft);
	}
	.ce :global(.ref-si) {
		color: var(--accent);
		background: var(--accent-soft);
	}
	.ce :global(.ref-mission) {
		color: var(--text);
		background: var(--surface-sunken);
		border-color: var(--border-strong);
	}
	.ce :global(.ref-player) {
		color: var(--mos);
		background: var(--surface-raised);
		border-color: var(--mos);
	}
	.ce :global(.ref-player i) {
		border-radius: 50%;
	}
	.ce :global(.ref-missing) {
		color: var(--text-faint);
		background: var(--surface-sunken);
		border-style: dashed;
		border-color: var(--border-strong);
		font-family: var(--font-mono);
		font-weight: 500;
	}
</style>
