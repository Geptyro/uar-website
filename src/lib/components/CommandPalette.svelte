<script lang="ts">
	/**
	 * Site-wide search. The panel, the cursor and the keys are commons'
	 * `SearchDialog`; what this adds is where the rows come from.
	 *
	 * What it searches comes from three places. Pages, classes and SIs are
	 * already in this bundle because the sidebar needs them, so they answer from
	 * the first keystroke; the ~450 entities are fetched once from the
	 * prerendered /search.json on first open. Players cannot be prerendered at
	 * all, so they come from /api/search/players, debounced — see the note on
	 * that handler for why the shape of that request matters. They are the half
	 * of this palette that cannot answer instantly, which is why they get a
	 * group of their own with a spinner on it rather than arriving silently.
	 */
	import { goto } from '$app/navigation';
	import { SearchDialog } from 'sveltekit-commons';
	import { rankRows, type PaletteRow, type RowGroup } from 'sveltekit-commons/palette';

	import { mosById, mosList, skillIdentifiers } from '$lib/mos';
	import { page } from '$app/state';
	import { extraDestinations, navItems } from '$lib/nav';
	import { tabSegment } from '$lib/playerTabs';
	import {
		browseRows,
		entityRows,
		mosRows,
		pageRows,
		playerRows,
		siRows,
		type EntityIndexRow
	} from '$lib/palette';

	/** Rows of the static half shown at once — a keyboard target, not a page. */
	const HITS = 7;
	/** Wait after the last keystroke before asking the database about players. */
	const DEBOUNCE_MS = 180;

	let dialog = $state<ReturnType<typeof SearchDialog> | null>(null);
	let q = $state('');
	let entities = $state<PaletteRow[]>([]);
	let players = $state<PaletteRow[]>([]);
	/** True from the keystroke until the answer lands — the debounce included. */
	let searching = $state(false);

	const staticRows = $derived<PaletteRow[]>([
		...pageRows([...navItems, ...extraDestinations]),
		...mosRows(
			mosList.map((m) => ({
				...m,
				vehicle: m.vehicle ? (mosById.get(m.vehicle) ?? null) : null
			}))
		),
		...siRows(skillIdentifiers),
		...entities
	]);

	/** With nothing typed, the palette offers the destinations. */
	const defaults = pageRows(navItems).slice(0, 6);

	const groups = $derived<RowGroup[]>(
		q.trim()
			? [
					{ rows: rankRows(staticRows, q, HITS) },
					{ label: 'Players', rows: players, busy: searching, pending: 'Searching…' },
					{ rows: browseRows(q) }
				]
			: [{ rows: defaults }]
	);

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
				// keep the profile tab the reader searched from, so comparing two
				// players' collections does not land on the second one's overview
				if (mine === seq) players = playerRows(body.players, tabSegment(page.route.id) ?? '');
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

	export function open() {
		dialog?.open();
	}
</script>

<SearchDialog
	bind:this={dialog}
	bind:query={q}
	{groups}
	placeholder="Search units, classes, players…"
	onopen={() => {
		players = [];
		searching = false;
		void ensureIndex();
	}}
	onselect={(row) => goto(row.href)}
/>
