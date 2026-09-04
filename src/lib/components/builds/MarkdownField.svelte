<script lang="ts">
	/**
	 * One markdown text: a textarea with the two things a guide's text needs
	 * beyond typing, on a strip above the text the way a comment box has one.
	 * Pictures upload as they are added (the strip's button, paste or drop)
	 * and come back as the `![](img:…)` the renderer understands. Naming the
	 * game's things is `@` and a few letters (typed, or the strip's button): a
	 * search opens under the caret (skills, abilities, items, classes, SIs,
	 * hostiles) and picking one writes the `[[kind:id]]` the renderer turns
	 * into a chip; `[[` does the same for someone who knows the syntax.
	 */
	import { tick, type Snippet } from 'svelte';
	import ChipEditor from './ChipEditor.svelte';
	import type { Mos } from '$lib/mos';
	import { BUILD_LIMITS, imageRef } from '$lib/builds';
	import { knownAvatars, searchRefs, type RefHit } from '$lib/buildRefs';
	import { fetchPlayers, mergeHits, PLAYER_QUERY_MIN } from '$lib/mentions';
	import { ANON_PORTRAIT as anonPortrait, portraitsIn } from '$lib/portrait';

	let {
		value = $bindable(''),
		mos,
		placeholder = 'What to do, where, and why. Markdown works; @ names a skill or an item.',
		rows = 8,
		/** Posted under this name when the field sits in a plain form (a comment). */
		name = undefined,
		/** Pictures may be added: off for a comment, which is words and chips only. */
		pictures = true,
		maxlength = BUILD_LIMITS.column,
		required = false,
		/** What sits under the text, inside the box: a form's buttons. */
		footer = undefined,
		/** Enter sends (Shift+Enter breaks a line) when the field is a chat box. */
		onsend = undefined,
		/** Every keystroke, for a "typing" signal. */
		oninput = undefined,
		/** Draw references as the chips they will be (a chat box, a comment) rather than as `[[…]]`. */
		chips = false
	}: {
		value: string;
		/** The class the @ search leans to; null for a text with no class behind it. */
		mos: Mos | null;
		placeholder?: string;
		rows?: number;
		name?: string;
		pictures?: boolean;
		maxlength?: number;
		required?: boolean;
		footer?: Snippet;
		onsend?: () => void;
		oninput?: () => void;
		chips?: boolean;
	} = $props();

	let ta = $state<HTMLTextAreaElement>();
	let ce = $state<ChipEditor>();
	let notice = $state('');

	/* ---------- emoji ---------- */
	/* a small, fixed set: what a game chat reaches for; anything else can be
	   typed from the keyboard's own picker, markdown passes it through as it is */
	const EMOJI = [
		'😀', '😂', '😅', '😉', '😍', '🤔', '😎', '😭', '😱', '🙄', '😤', '🥳', '🤝', '👍', '👎', '👏',
		'🙏', '💪', '🫡', '👀', '❤️', '🔥', '💀', '☠️', '💥', '⚡', '🎯', '🛡️', '🔫', '💣', '🩹', '⛑️',
		'🧟', '👾', '🤖', '🚁', '🚀', '🏆', '🥇', '⭐', '✅', '❌', '⚠️', '❓', '❗', '💬', '🎉', '🍀'
	];
	let emojiOpen = $state(false);
	let emojiBox = $state<HTMLElement>();
	function emoji(e: string) {
		emojiOpen = false;
		void insert(e);
	}
	function awayFromEmoji(e: PointerEvent) {
		if (emojiOpen && emojiBox && !emojiBox.contains(e.target as Node)) emojiOpen = false;
	}

	/**
	 * The two surfaces, one language: offsets in the markdown. A textarea
	 * speaks it natively; the chip surface translates (see ChipEditor). What
	 * follows — the inserts, the @ search — never asks which one it has.
	 */
	interface Editor {
		sel(): [number, number];
		setSel(a: number, b: number): void;
		focus(): void;
		caretXY(pos: number): { top: number; left: number };
		box(): DOMRect;
		width(): number;
		lineH(): number;
	}
	function editor(): Editor | null {
		if (ce) return ce;
		const el = ta;
		if (!el) return null;
		return {
			sel: () => [el.selectionStart, el.selectionEnd],
			setSel: (a, b) => el.setSelectionRange(a, b),
			focus: () => el.focus(),
			caretXY: (pos) => caretXY(el, pos),
			box: () => el.getBoundingClientRect(),
			width: () => el.clientWidth,
			lineH: () => parseFloat(getComputedStyle(el).lineHeight) || 20
		};
	}

	/** Put text between `from` and `to`, and leave the cursor where the author writes next. */
	async function splice(from: number, to: number, text: string, cursor = text.length) {
		value = value.slice(0, from) + text + value.slice(to);
		await tick();
		const ed = editor();
		if (ed) {
			ed.focus();
			ed.setSel(from + cursor, from + cursor);
		}
	}
	function insert(text: string, cursor = text.length) {
		const [from, to] = editor()?.sel() ?? [value.length, value.length];
		return splice(from, to, text, cursor);
	}

	/** The strip's @: an at sign at the caret (after a space if it needs one), then the search. */
	async function atSign() {
		const [from] = editor()?.sel() ?? [value.length];
		const before = value.slice(0, from);
		await insert(before === '' || /[\s(]$/.test(before) ? '@' : ' @');
		watch();
	}

	/* ---------- the @ search ---------- */

	interface Mention {
		from: number;
		query: string;
		index: number;
		top: number;
		left: number;
		/** Opens upward: the caret is too low on the screen for the list to fit under it. */
		up: boolean;
	}
	let mention = $state<Mention | null>(null);
	/** Roughly the list's height: what has to fit under the caret for it to open downward. */
	const LIST_H = 260;
	/* the game's things answer at once from the bundled data; players are asked of
	   the site a moment after the last keystroke, and the newest answer wins */
	let hits = $state<RefHit[]>([]);
	let seq = 0;
	$effect(() => {
		const q = mention?.query;
		if (q === undefined) {
			hits = [];
			return;
		}
		const mine = ++seq;
		const things = searchRefs(q, mos?.id ?? null);
		hits = things;
		if (q.trim().length < PLAYER_QUERY_MIN) return;
		const timer = setTimeout(async () => {
			const players = await fetchPlayers(q);
			// the portraits go with the handles, so the chip a pick makes wears one
			for (const p of players) if (p.avatarUrl) knownAvatars.set(p.toon, p.avatarUrl);
			if (mine === seq && players.length) hits = mergeHits(things, players, 10, q);
		}, 180);
		return () => clearTimeout(timer);
	});
	const KIND_WORD: Record<string, string> = {
		skill: 'skill',
		ability: 'ability',
		item: 'item',
		mos: 'class',
		si: 'SI',
		unit: 'hostile',
		mission: 'mission',
		player: 'player'
	};
	const AT = /(?<=^|[\s(])@([^\s@]{0,40})$/;
	const BRACKETS = /\[\[([^\]\n]{0,40})$/;

	/**
	 * Where the caret is, in the field's box: a hidden copy of the textarea
	 * with the same type, filled to the caret, tells where that character
	 * would have been drawn. The one way to know, since a textarea will not
	 * say; the copy lives for one measurement.
	 */
	function caretXY(el: HTMLTextAreaElement, pos: number): { top: number; left: number } {
		const cs = getComputedStyle(el);
		const div = document.createElement('div');
		for (const prop of [
			'fontFamily',
			'fontSize',
			'fontWeight',
			'lineHeight',
			'letterSpacing',
			'paddingTop',
			'paddingLeft',
			'paddingRight',
			'borderLeftWidth',
			'borderTopWidth',
			'boxSizing',
			'tabSize'
		] as const) {
			div.style[prop] = cs[prop];
		}
		Object.assign(div.style, {
			position: 'absolute',
			top: '0',
			left: '0',
			visibility: 'hidden',
			whiteSpace: 'pre-wrap',
			wordWrap: 'break-word',
			width: `${el.clientWidth}px`
		});
		div.textContent = el.value.slice(0, pos);
		const mark = document.createElement('span');
		mark.textContent = el.value.slice(pos, pos + 1) || '.';
		div.appendChild(mark);
		el.parentElement?.appendChild(div);
		const line = parseFloat(cs.lineHeight) || 20;
		const xy = {
			top: el.offsetTop + mark.offsetTop - el.scrollTop + line + 2,
			left: el.offsetLeft + mark.offsetLeft
		};
		div.remove();
		return xy;
	}

	/** After every keystroke and caret move: are we in an `@…`? Then show, or move, the search. */
	function watch() {
		const ed = editor();
		if (!ed) return;
		const [pos, end] = ed.sel();
		if (pos !== end) {
			mention = null;
			return;
		}
		const before = value.slice(0, pos);
		const m = AT.exec(before) ?? BRACKETS.exec(before);
		if (!m) {
			mention = null;
			return;
		}
		const from = pos - m[0].length;
		const open = mention?.from === from ? mention : null;
		const { top, left } = open ?? ed.caretXY(from);
		const lineH = ed.lineH();
		mention = {
			from,
			query: m[1],
			index: open && open.query === m[1] ? open.index : 0,
			top,
			left: Math.max(0, Math.min(left, ed.width() - 300)),
			// a box at the foot of the page (the chat's) has no room below: open above the line
			up: open ? open.up : ed.box().top + top + LIST_H > window.innerHeight,
			lineH
		} as Mention & { lineH: number };
	}
	function pick(h: RefHit) {
		if (!mention) return;
		const { from } = mention;
		const [to] = editor()?.sel() ?? [from];
		mention = null;
		void splice(from, to, `${h.ref} `);
	}
	function keys(e: KeyboardEvent) {
		if (!mention || !hits.length) {
			if (e.key === 'Escape' && mention) mention = null;
			// a chat box: Enter sends, Shift+Enter is the new line
			if (onsend && e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
				e.preventDefault();
				onsend();
			}
			return;
		}
		switch (e.key) {
			case 'ArrowDown':
				mention.index = (mention.index + 1) % hits.length;
				break;
			case 'ArrowUp':
				mention.index = (mention.index - 1 + hits.length) % hits.length;
				break;
			case 'Enter':
			case 'Tab':
				pick(hits[mention.index]);
				break;
			case 'Escape':
				mention = null;
				break;
			default:
				return;
		}
		e.preventDefault();
	}

	/* ---------- pictures ---------- */

	/**
	 * Shrink a big picture in the browser before it goes up. The server
	 * re-encodes whatever arrives regardless (that is the safety step); this
	 * only spares a phone on a slow link from sending a 4K screenshot to be
	 * thrown away. Anything that fails here just uploads the original.
	 */
	async function shrink(file: File): Promise<Blob> {
		if (file.size < 1_000_000) return file;
		try {
			const bmp = await createImageBitmap(file);
			const scale = Math.min(1, BUILD_LIMITS.imageSide / Math.max(bmp.width, bmp.height));
			if (scale === 1 && file.size <= BUILD_LIMITS.imageBytes) {
				bmp.close();
				return file;
			}
			const canvas = document.createElement('canvas');
			canvas.width = Math.round(bmp.width * scale);
			canvas.height = Math.round(bmp.height * scale);
			canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
			bmp.close();
			const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.9));
			return blob && blob.size < file.size ? blob : file;
		} catch {
			return file;
		}
	}

	async function upload(file: File) {
		if (!file.type.startsWith('image/')) {
			notice = 'That is not a picture.';
			return;
		}
		notice = 'Uploading…';
		try {
			const body = new FormData();
			body.set('image', await shrink(file), file.name || 'picture');
			const res = await fetch('/api/guide-images', {
				method: 'POST',
				body,
				headers: { 'x-uar-upload': '1', accept: 'application/json' }
			});
			const data = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
			if (!res.ok || !data?.id) {
				notice = data?.message ?? `The upload failed (${res.status}).`;
				return;
			}
			// the cursor lands between the brackets: what the picture shows goes there
			await insert(`![](${imageRef(data.id)})`, 2);
			notice = '';
		} catch {
			notice = 'The upload failed. Try again.';
		}
	}
	function fileFrom(list: FileList | null | undefined): File | null {
		const f = list?.[0];
		return f && f.type.startsWith('image/') ? f : null;
	}
</script>

<svelte:window onpointerdown={awayFromEmoji} />

<div class="field">
	<div class="box">
		<div class="bar" role="toolbar" aria-label="Writing tools">
			{#if pictures}
				<label class="tb" title="Add a picture; pasting or dropping one works too">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
					</svg>
					<span>Picture</span>
					<input
						type="file"
						accept="image/*"
						hidden
						onchange={(e) => {
							const f = fileFrom(e.currentTarget.files);
							if (f) void upload(f);
							e.currentTarget.value = '';
						}}
					/>
				</label>
			{/if}
			<!-- mousedown is swallowed so the textarea keeps its caret for the insert -->
			<button type="button" class="tb" title="Name a skill, an item, a class, a hostile, a mission or a player" onmousedown={(e) => e.preventDefault()} onclick={atSign}>
				<span class="at">@</span>
				<span>Mention</span>
			</button>
			<span class="emoji-box" bind:this={emojiBox}>
				<button type="button" class="tb" class:on={emojiOpen} title="Add an emoji" aria-expanded={emojiOpen} onmousedown={(e) => e.preventDefault()} onclick={() => (emojiOpen = !emojiOpen)}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
					</svg>
					<span>Emoji</span>
				</button>
				{#if emojiOpen}
					<!-- mousedown is swallowed so the caret stays where the emoji goes -->
					<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
					<span class="emoji-grid" role="group" aria-label="Emoji" onmousedown={(e) => e.preventDefault()}>
						{#each EMOJI as e (e)}
							<button type="button" class="emoji" onclick={() => emoji(e)} title={e}>{e}</button>
						{/each}
					</span>
				{/if}
			</span>
			{#if notice}<span class="notice">{notice}</span>{/if}
			<span class="hint" title="**bold**, *italic*, - lists, | tables |, `F1` for a key, [[name]] for a chip">Markdown</span>
		</div>
	{#if chips}
		<ChipEditor
			bind:this={ce}
			bind:value
			mosId={mos?.id ?? null}
			{name}
			{placeholder}
			oninput={() => {
				watch();
				oninput?.();
			}}
			onclick={watch}
			onkeyup={(e) => {
				if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) watch();
			}}
			onkeydown={keys}
			onblur={() => (mention = null)}
			onpaste={(e) => {
				const f = pictures ? fileFrom(e.clipboardData?.files) : null;
				if (f) {
					e.preventDefault();
					void upload(f);
				}
			}}
			ondrop={(e) => {
				const f = pictures ? fileFrom(e.dataTransfer?.files) : null;
				if (f) {
					e.preventDefault();
					void upload(f);
				}
			}}
		/>
	{:else}
		<textarea
			bind:this={ta}
			bind:value
			{name}
			{rows}
			{maxlength}
			{required}
			{placeholder}
			oninput={() => {
				watch();
				oninput?.();
			}}
			onclick={watch}
			onkeyup={(e) => {
				if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) watch();
			}}
			onkeydown={keys}
			onblur={() => (mention = null)}
			onpaste={(e) => {
				const f = pictures ? fileFrom(e.clipboardData?.files) : null;
				if (f) {
					e.preventDefault();
					void upload(f);
				}
			}}
			ondragover={(e) => e.preventDefault()}
			ondrop={(e) => {
				const f = pictures ? fileFrom(e.dataTransfer?.files) : null;
				if (f) {
					e.preventDefault();
					void upload(f);
				}
			}}
		></textarea>
	{/if}
		{#if footer}
			<div class="foot">{@render footer()}</div>
		{/if}
	</div>
	{#if mention}
		<!-- mousedown is swallowed so the textarea keeps focus and its blur
		     does not close the list before the click lands -->
		<ul
			class="mention"
			role="listbox"
			aria-label="Skills, items, classes"
			style={mention.up
				? `bottom:calc(100% - ${mention.top - (mention as Mention & { lineH: number }).lineH}px);left:${mention.left}px`
				: `top:${mention.top}px;left:${mention.left}px`}
			class:up={mention.up}
			onmousedown={(e) => e.preventDefault()}
			use:portraitsIn={anonPortrait}
		>
			{#each hits as h, n (h.ref)}
				<!-- the keyboard drives this list from the textarea (keys), the way a
				     combobox's options are never focused themselves -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<li
					role="option"
					aria-selected={n === mention.index}
					class:sel={n === mention.index}
					onclick={() => pick(h)}
					onmousemove={() => {
						if (mention) mention.index = n;
					}}
				>
					{#if h.icon}<img src={h.icon} alt="" class:portrait={h.kind === 'player'} />{:else}<span class="ph"></span>{/if}
					<span class="n">{h.name}</span>
					<span class="t">{h.note ?? KIND_WORD[h.kind]}</span>
				</li>
			{:else}
				<li class="none">Nothing called “{mention.query}”</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.field {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
	}
	/* the strip and the text are one box: one border, one focus ring */
	.box {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-2);
		background: var(--surface-raised);
		overflow: hidden;
	}
	.box:focus-within {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-soft);
	}
	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px;
		padding: 4px 6px;
		border-bottom: 1px solid var(--border);
		background: var(--surface-sunken);
	}
	.tb {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		height: 24px;
		padding: 0 8px;
		border: 0;
		border-radius: 6px;
		background: none;
		color: var(--text-dim);
		font: 600 11.5px var(--font-sans, inherit);
		cursor: pointer;
	}
	.tb:hover,
	.tb.on {
		background: var(--surface-raised);
		color: var(--text);
	}
	.emoji-box {
		position: relative;
		display: inline-flex;
	}
	.emoji-grid {
		position: absolute;
		z-index: var(--z-float, 60);
		top: calc(100% + 4px);
		left: 0;
		display: grid;
		grid-template-columns: repeat(8, 30px);
		gap: 2px;
		padding: 5px;
		background: var(--surface);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-2);
		box-shadow: var(--shadow-2);
	}
	.emoji {
		width: 30px;
		height: 30px;
		border: 1px solid transparent;
		border-radius: 6px;
		background: none;
		font-size: 17px;
		line-height: 1;
		cursor: pointer;
	}
	.emoji:hover {
		background: var(--surface-raised);
		border-color: var(--border);
	}
	.tb svg {
		width: 14px;
		height: 14px;
	}
	.at {
		font: 700 13px/1 var(--font-mono);
	}
	.notice {
		margin-left: 6px;
		font-size: 11.5px;
		color: var(--accent);
	}
	.hint {
		margin-left: auto;
		padding-right: 4px;
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-faint);
		cursor: help;
	}
	.foot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 6px;
		padding: 6px;
		border-top: 1px solid var(--border);
		background: var(--surface-sunken);
	}
	textarea {
		width: 100%;
		min-height: 72px;
		resize: vertical;
		font: 13px/1.55 var(--font-mono);
		background: transparent;
		color: var(--text);
		border: 0;
		border-radius: 0;
		padding: 8px 10px;
	}
	textarea:focus {
		outline: none;
	}
	.mention {
		position: absolute;
		z-index: var(--z-float, 60);
		width: 300px;
		max-width: 100%;
		margin: 0;
		padding: 4px;
		list-style: none;
		background: var(--surface);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-2);
		box-shadow: var(--shadow-2);
	}
	.mention li {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 5px 8px;
		border-radius: 6px;
		font-size: 12.5px;
		cursor: pointer;
	}
	.mention li.sel {
		background: var(--accent-soft);
	}
	.mention li.none {
		color: var(--text-faint);
		cursor: default;
	}
	.mention img,
	.mention .ph {
		width: 20px;
		height: 20px;
		object-fit: cover;
		border-radius: 5px;
		background: var(--surface-raised);
		flex-shrink: 0;
	}
	.mention .n {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.mention .t {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-faint);
		white-space: nowrap;
	}
</style>
