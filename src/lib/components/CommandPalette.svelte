<script lang="ts">
	/**
	 * Site-wide search, as a modal palette. Opened with Ctrl/Cmd+K, Ctrl/Cmd+F
	 * or "/" (the layout owns those bindings) and by the top bar's search
	 * button, which is how a phone with no keyboard gets to it.
	 *
	 * A native <dialog> rather than a hand-rolled overlay: `showModal()` traps
	 * focus, makes the rest of the page inert to a screen reader, closes on Esc,
	 * sits in the top layer above every piece of chrome without joining the
	 * z-index argument, and gives us ::backdrop — all things a div would have to
	 * reimplement and would get subtly wrong.
	 *
	 * What it searches comes from two places. Pages, classes and SIs are already
	 * in this bundle because the sidebar needs them, so they answer from the
	 * first keystroke; the ~450 entities are fetched once from the prerendered
	 * /search.json on first open. Players cannot be prerendered at all, so they
	 * come from /api/search/players, debounced — see the note on that handler
	 * for why the shape of that request matters.
	 */
	import { goto } from '$app/navigation';
	import { mosList, skillIdentifiers } from '$lib/mos';
	import { extraDestinations, navItems, searchIcon } from '$lib/nav';
	import {
		entityRows,
		mosRows,
		pageRows,
		playerRows,
		rankRows,
		siRows,
		step,
		type EntityIndexRow,
		type PaletteRow
	} from '$lib/palette';

	/** Rows of the static half shown at once — a keyboard target, not a page. */
	const HITS = 7;
	/** Wait after the last keystroke before asking the database about players. */
	const DEBOUNCE_MS = 180;

	let dialog = $state<HTMLDialogElement | null>(null);
	let input = $state<HTMLInputElement | null>(null);
	let q = $state('');
	let active = $state(0);
	let entities = $state<PaletteRow[]>([]);
	let players = $state<PaletteRow[]>([]);
	/** True from the keystroke until the answer lands — the debounce included. */
	let searching = $state(false);

	/* The sidebar's icons, so a page row in the palette carries the same mark as
	   the row it will take you to. They are SVG source rather than URLs, which is
	   why they cannot ride along on PaletteRow with the picture-based ones. */
	const navGlyphs = new Map(navItems.map((n) => [n.href, n.icon]));

	const staticRows = $derived<PaletteRow[]>([
		...pageRows([...navItems, ...extraDestinations]),
		...mosRows(mosList),
		...siRows(skillIdentifiers),
		...entities
	]);

	const hits = $derived(rankRows(staticRows, q, HITS));

	/* The escape hatches: whatever the palette had no room for. Both list pages
	   read `?q=`, so the term the reader has already typed carries over. */
	const browse = $derived<PaletteRow[]>(
		q.trim()
			? [
					{
						kind: 'page',
						id: 'browse:entities',
						href: `/entities?q=${encodeURIComponent(q.trim())}`,
						label: `All entities matching “${q.trim()}”`,
						note: 'browse'
					},
					{
						kind: 'page',
						id: 'browse:players',
						href: `/players?q=${encodeURIComponent(q.trim())}`,
						label: `All players matching “${q.trim()}”`,
						note: 'browse'
					}
				]
			: []
	);

	/** With nothing typed, the palette offers the destinations. */
	const defaults = pageRows(navItems).slice(0, 6);

	/* One flat list, so ↑/↓ walks the whole thing rather than three lists with
	   boundaries the reader cannot see. The markup renders it in three pieces so
	   the players can carry a heading and a loader, and each piece offsets its
	   index into this — the cursor and the keys agree on one numbering. */
	const head = $derived<PaletteRow[]>(q.trim() ? hits : defaults);
	const list = $derived<PaletteRow[]>(q.trim() ? [...head, ...players, ...browse] : defaults);

	/** Nothing found, and nothing still coming that could change that. */
	const blank = $derived(Boolean(q.trim()) && !head.length && !players.length && !searching);

	/* Fetched on first open, not at boot: most visits never search, and this is
	   ~35 KB. A failed load leaves the flag down so the next open retries. */
	let indexRequested = false;
	async function ensureIndex() {
		if (indexRequested) return;
		indexRequested = true;
		try {
			const res = await fetch('/search.json');
			if (!res.ok) throw new Error(`search index: ${res.status}`);
			entities = entityRows((await res.json()) as EntityIndexRow[]);
		} catch {
			indexRequested = false;
		}
	}

	/* Players, debounced, newest answer wins. `seq` is what stops a slow reply
	   to "sni" from landing on top of the results for "sniper" — the requests
	   are independent and nothing else guarantees they come back in order. */
	let seq = 0;
	$effect(() => {
		const term = q.trim();
		if (term.length < 2) {
			players = [];
			searching = false;
			return;
		}
		/* Set before the debounce, not after it: the wait is part of what the
		   reader is waiting for, and a spinner that only appears once the request
		   is actually in flight leaves the list looking finished for the first
		   fifth of a second of every query. The rows from the previous term stay
		   up meanwhile — replacing them with a blank is a flicker, and they are
		   usually still close to right. */
		searching = true;
		const mine = ++seq;
		const timer = setTimeout(async () => {
			try {
				const res = await fetch(`/api/search/players?q=${encodeURIComponent(term)}`);
				if (!res.ok) return;
				const body = (await res.json()) as { players: Parameters<typeof playerRows>[0] };
				if (mine === seq) players = playerRows(body.players);
			} catch {
				// transient — the static half of the palette still answers
			} finally {
				// only the newest query may clear the flag: an older reply landing
				// late would otherwise call off a search that is still running
				if (mine === seq) searching = false;
			}
		}, DEBOUNCE_MS);
		return () => clearTimeout(timer);
	});

	// a new query invalidates the cursor; without this, narrowing the results
	// leaves the highlight past the end and Enter navigates nowhere
	$effect(() => {
		q;
		active = 0;
	});

	export function open() {
		q = '';
		active = 0;
		players = [];
		searching = false;
		void ensureIndex();
		dialog?.showModal();
		// showModal focuses the dialog itself, not the field inside it
		queueMicrotask(() => input?.focus());
	}

	function close() {
		dialog?.close();
	}

	function go(href: string) {
		close();
		void goto(href);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			active = step(active, 1, list.length);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			active = step(active, -1, list.length);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			const row = list[active];
			if (row) go(row.href);
		}
	}
</script>

<dialog
	bind:this={dialog}
	aria-label="Search"
	onclose={() => (q = '')}
	onclick={(e) => {
		// the backdrop is the dialog element itself; a click inside the panel
		// lands on a child, so this only fires for the surround
		if (e.target === dialog) close();
	}}
>
	<div class="panel">
		<div class="field">
			<span class="field-icon" aria-hidden="true">{@html searchIcon}</span>
			<input
				bind:this={input}
				bind:value={q}
				type="search"
				placeholder="Search units, classes, players…"
				aria-label="Search the site"
				autocomplete="off"
				spellcheck="false"
				onkeydown={onKeydown}
			/>
			<kbd>Esc</kbd>
		</div>

		{#snippet option(row: PaletteRow, i: number)}
			<li>
				<a
					href={row.href}
					class:active={i === active}
					class:browse={row.note === 'browse'}
					role="option"
					aria-selected={i === active}
					onmouseenter={() => (active = i)}
					onclick={(e) => {
						e.preventDefault();
						go(row.href);
					}}
				>
					{#if row.icon}
						<img
							class="icon"
							class:round={row.kind === 'player'}
							src={row.icon}
							alt=""
							width="22"
							height="22"
							loading="lazy"
						/>
					{:else if navGlyphs.has(row.href)}
						<span class="icon glyph svg" aria-hidden="true">{@html navGlyphs.get(row.href)}</span>
					{:else}
						<span class="icon glyph" aria-hidden="true">
							{row.kind === 'player' ? '·' : '⌗'}
						</span>
					{/if}

					<span class="name">{row.label}</span>
					{#if row.note}<span class="note">{row.note}</span>{/if}
				</a>
			</li>
		{/snippet}

		<ul role="listbox" aria-label="Results" aria-busy={searching}>
			{#each head as row, i (row.kind + row.id)}
				{@render option(row, i)}
			{/each}

			{#if blank}
				<li class="empty" role="presentation">Nothing matches “{q.trim()}”.</li>
			{/if}

			<!-- the one seam in the list. It appears the moment a lookup starts, so
			     the reader can see that players are on the way rather than absent —
			     they are the half of this palette that cannot answer instantly. -->
			{#if searching || players.length}
				<li class="divider" role="presentation">
					<span>Players</span>
					{#if searching}<span class="spinner" aria-hidden="true"></span>{/if}
				</li>
				{#each players as row, i (row.kind + row.id)}
					{@render option(row, head.length + i)}
				{/each}
				{#if searching && !players.length}
					<li class="pending" role="presentation">Searching…</li>
				{/if}
			{/if}

			{#each browse as row, i (row.kind + row.id)}
				{@render option(row, head.length + players.length + i)}
			{/each}
		</ul>

		<footer>
			<span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
			<span><kbd>↵</kbd> open</span>
			<!-- Ctrl rather than the platform's own modifier: the layout accepts
			     either, so this line is true on a Mac as well -->
			<span class="wide"><kbd>Ctrl</kbd><kbd>F</kbd> reopen</span>
		</footer>
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

	dialog::backdrop {
		background: rgb(0 0 0 / 0.55);
		backdrop-filter: blur(2px);
	}

	/* sits high rather than centred: the list grows downwards, and a centred
	   panel would walk up the screen as results arrive */
	.panel {
		width: min(38rem, calc(100vw - 2rem));
		margin: 12vh auto 0;
		background: var(--surface);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-3);
		box-shadow: var(--shadow-2);
		overflow: hidden;
	}

	.field {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 11px 14px;
		border-bottom: 1px solid var(--border);
	}

	.field-icon {
		display: flex;
		flex: none;
		color: var(--text-faint);
	}
	.field-icon :global(svg) {
		width: 17px;
		height: 17px;
	}

	.field input {
		flex: 1;
		min-width: 0;
		border: none;
		background: none;
		font: 16px/1.4 var(--font-sans);
		color: var(--text);
		outline: none;
	}
	.field input::placeholder {
		color: var(--text-faint);
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 5px;
		max-height: 50vh;
		overflow-y: auto;
	}

	/* the one seam in the list: everything above it is this site's own data,
	   everything below is a person */
	.divider {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 9px 9px 4px;
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-faint);
	}
	/* the rule fills whatever the heading and the spinner leave, so the spinner
	   sits beside the word rather than out at the far end of the panel */
	.divider :global(span:first-child) {
		flex: none;
	}
	.divider::after {
		content: '';
		order: 3;
		flex: 1;
		height: 1px;
		background: var(--border);
	}

	/* An arc, not a full ring: a circle spinning is only legible because part of
	   it is missing. 10px, so it reads as punctuation on the heading rather than
	   as a piece of chrome the panel grew. */
	.spinner {
		width: 10px;
		height: 10px;
		flex: none;
		border: 1.5px solid var(--border-strong);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 700ms linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(1turn);
		}
	}
	/* Turning is the part that has to go, not the indicator: the arc stays, and
	   fades instead. The word below it carries the meaning either way. */
	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation: fade 1.6s ease-in-out infinite;
		}
		@keyframes fade {
			50% {
				opacity: 0.25;
			}
		}
	}

	/* the placeholder for the first query of a session, when there are no rows
	   from a previous term to leave standing */
	.pending {
		padding: 7px 9px;
		font-size: 13px;
		color: var(--text-faint);
	}

	a {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 9px;
		border-radius: var(--radius-2);
		text-decoration: none;
		color: inherit;
	}

	/* one highlight for both pointer and keyboard: hovering moves `active`, so
	   there is never a second, competing indicator */
	a.active {
		background: var(--surface-raised);
	}

	.icon {
		width: 22px;
		height: 22px;
		flex: none;
		object-fit: cover;
		border-radius: 4px;
	}
	.icon.round {
		border-radius: 50%;
	}
	.glyph {
		display: grid;
		place-items: center;
		color: var(--text-faint);
	}
	.glyph.svg :global(svg) {
		width: 16px;
		height: 16px;
	}

	.name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* the trailing rows are a way out of the palette, not an answer in it */
	a.browse .name {
		color: var(--text-dim);
	}

	.note {
		font-family: var(--font-mono);
		font-size: 10.5px;
		color: var(--text-faint);
		white-space: nowrap;
	}

	.empty {
		padding: 10px 9px;
		color: var(--text-dim);
		font-size: 13px;
	}

	footer {
		display: flex;
		gap: 14px;
		padding: 7px 14px;
		border-top: 1px solid var(--border);
		background: var(--surface-sunken);
		font-size: 11px;
		color: var(--text-faint);
	}

	kbd {
		font-family: var(--font-mono);
		font-size: 10px;
		border: 1px solid var(--border);
		border-radius: var(--radius-1);
		padding: 0 0.35em;
		margin-right: 0.2em;
		color: var(--text-dim);
	}

	/* the shortcut hint is no use to the device that has no keyboard */
	@media (max-width: 620px) {
		.panel {
			margin-top: 6vh;
		}
		footer .wide {
			display: none;
		}
	}
</style>
