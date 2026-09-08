<script lang="ts">
	/**
	 * What each class costs to unlock: the rank — or the raw XP — it wants on
	 * every track that offers it, plus whatever it wants on top. The second of
	 * the two tables at /mos; see $lib/mosViews.ts.
	 *
	 * The same numbers a class page states in its rail, gathered into one place
	 * so the question a class page cannot answer — "what is cheapest from
	 * here?" — is a sort rather than twenty-four visits.
	 *
	 * A track's cell shows the rank when the threshold is exactly a rank's own,
	 * which is the usual case and the way the game words it. Four gates sit
	 * between two ranks (or past the last one), and those show the XP with the
	 * rank they land after — writing them as the rank below would be wrong by
	 * tens of thousands of XP.
	 */
	import { mosList, rankTracks } from '$lib/mos';
	import type { UnlockReq } from '$lib/mos';
	import { RANK_KEYS, RANK_KEY_OF_TRACK, type RankKey } from '$lib/ranks';

	type Cell = {
		/** XP the gate wants on this track; null when the track never offers the class. */
		xp: number | null;
		main: string;
		sub: string | null;
		rankIcon: string | null;
		title: string;
	};

	type Row = {
		id: string;
		name: string;
		role: string;
		icon: string | null;
		cells: Record<RankKey, Cell>;
		medals: number;
		/** Robot: the XP is wanted on all three tracks at once, not just one. */
		everyTrack: boolean;
		modes: string[] | null;
		charges: number;
	};

	const trackOf = (k: RankKey) =>
		rankTracks.find((t) => RANK_KEY_OF_TRACK[t.track] === k) ?? rankTracks[0];

	const xp = (v: number) => `${v.toLocaleString('en-US')} XP`;

	function cell(k: RankKey, req: UnlockReq | null | undefined): Cell {
		const track = trackOf(k);
		if (!req)
			return {
				xp: null,
				main: '—',
				sub: null,
				rankIcon: null,
				title: `Cannot be picked on the ${track.name} track`
			};

		const need = req.xp ?? 0;
		// the highest rank the gate's XP actually reaches on this track
		const reached = [...track.ranks].reverse().find((r) => r.xp <= need) ?? track.ranks[0];
		const exact = req.rank
			? (track.ranks.find((r) => r.prefix === req.rank) ?? reached)
			: reached.xp === need
				? reached
				: null;

		if (need === 0)
			return {
				xp: 0,
				main: 'Start',
				sub: exact?.prefix ?? null,
				rankIcon: exact?.icon ?? null,
				title: `Available from the start of the ${track.name} track`
			};

		return {
			xp: need,
			main: exact ? exact.prefix : xp(need),
			sub: exact ? xp(need) : `past ${reached.prefix}`,
			rankIcon: exact?.icon ?? reached.icon ?? null,
			title: exact
				? `${exact.name} — ${xp(need)} on the ${track.name} track`
				: `${xp(need)} on the ${track.name} track, between ${reached.prefix} and the next rank`
		};
	}

	/* Classes with no `unlock` are not in the hero dialog at all (the Sushi
	   transformations), so they have nothing to unlock and no row here. */
	const rows: Row[] = mosList
		.filter((m) => m.unlock)
		.map((m) => {
			const u = m.unlock!;
			return {
				id: m.id,
				name: m.name,
				role: m.role,
				icon: m.icon,
				cells: {
					en: cell('en', u.en),
					wo: cell('wo', u.wo),
					co: cell('co', u.co)
				},
				medals: u.medals ?? 0,
				everyTrack: Boolean(u.en?.everyTrack || u.wo?.everyTrack || u.co?.everyTrack),
				modes: u.modes ?? null,
				charges: u.charges
			};
		});

	type Col = {
		key: string;
		label: string;
		num?: boolean;
		value: (r: Row) => number | string | null;
	};
	const columns: Col[] = [
		{ key: 'name', label: 'Class', value: (r) => r.name },
		{ key: 'en', label: 'Enlisted', num: true, value: (r) => r.cells.en.xp },
		{ key: 'wo', label: 'Warrant Officer', num: true, value: (r) => r.cells.wo.xp },
		{ key: 'co', label: 'Commissioned', num: true, value: (r) => r.cells.co.xp },
		{ key: 'extra', label: 'Also needs', num: true, value: (r) => r.medals || null },
		{ key: 'charges', label: 'Max per game', num: true, value: (r) => r.charges }
	];

	let sortKey = $state('en');
	let sortDir = $state(1);

	function setSort(key: string) {
		if (sortKey === key) sortDir *= -1;
		// cheapest first is the useful end of every column here, the name included
		else {
			sortKey = key;
			sortDir = 1;
		}
	}

	const sorted = $derived.by(() => {
		const col = columns.find((c) => c.key === sortKey) ?? columns[0];
		const out = [...rows];
		out.sort((a, b) => {
			const x = col.value(a);
			const y = col.value(b);
			// a class the track never offers sorts last, whichever way the column points
			if (x === null && y === null) return a.name.localeCompare(b.name);
			if (x === null) return 1;
			if (y === null) return -1;
			const cmp = typeof x === 'number' ? x - (y as number) : String(x).localeCompare(String(y));
			return cmp * sortDir || a.name.localeCompare(b.name);
		});
		return out;
	});

	/* One scale per track, so bar length reads as XP within that column. The
	   ladder's own top rank is the floor of the scale — four gates ask for more
	   XP than the last rank costs, and those set their column's scale instead. */
	const max = $derived({
		en: scaleFor('en'),
		wo: scaleFor('wo'),
		co: scaleFor('co')
	});

	function scaleFor(k: RankKey): number {
		const track = trackOf(k);
		const top = track.ranks[track.ranks.length - 1]?.xp ?? 0;
		return Math.max(top, ...rows.map((r) => r.cells[k].xp ?? 0));
	}

	/** several classes carry a "role" that is just their name respaced — not worth showing twice */
	const sameAsName = (role: string, name: string) =>
		!role || role.replace(/\s+/g, '').toLowerCase() === name.replace(/\s+/g, '').toLowerCase();

	const pct = (v: number | null, m: number) => (v && m ? (100 * v) / m : 0);
</script>

<p class="note">
	Every account runs three rank tracks at once, and a class names its own price on each. A class you
	cannot field as an Enlisted may already be yours as a Warrant Officer.
</p>

<div class="tablewrap">
	<table class="data" style="min-width: 860px">
		<thead>
			<tr>
				{#each columns as col (col.key)}
					<th class:num={col.num} class="sortable" onclick={() => setSort(col.key)}>
						{col.label}
						<span class="dir">{sortKey === col.key ? (sortDir > 0 ? '↑' : '↓') : ''}</span>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each sorted as r (r.id)}
				<tr>
					<td class="namecell">
						<span class="nameline">
							{#if r.icon}<img class="row-icon" src={r.icon} alt="" loading="lazy" />{/if}
							<a href="/mos/{r.id}">{r.name}</a>
							{#if !sameAsName(r.role, r.name)}<span class="role">{r.role}</span>{/if}
						</span>
						{#if r.modes}
							<span class="modes">Only in {r.modes.join(', ')}</span>
						{/if}
					</td>

					{#each RANK_KEYS as k (k)}
						{@const c = r.cells[k]}
						<td class="num gate" class:off={c.xp === null} title={c.title}>
							<span class="gateline">
								{#if c.rankIcon}
									<img class="rank" src={c.rankIcon} alt="" loading="lazy" />
								{/if}
								<b class="main">{c.main}</b>
							</span>
							<span class="sub">{c.sub ?? ' '}</span>
							{#if c.xp !== null}
								<span class="bar"
									><span class="fill" style="width: {pct(c.xp, max[k])}%"></span></span
								>
							{/if}
						</td>
					{/each}

					<td class="num extra">
						{#if r.medals}
							<a class="need" href="/career/medals">{r.medals} medals</a>
						{/if}
						{#if r.everyTrack}
							<span class="need" title="The XP has to be on all three tracks at the same time"
								>all 3 tracks</span
							>
						{/if}
						{#if !r.medals && !r.everyTrack}<span class="none">—</span>{/if}
					</td>

					<td class="num">{r.charges}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<p class="note foot">
	XP is counted per track, so the three columns are three separate ladders rather than one total.
	Prestiging clears every rank requirement on this page at once. See
	<a href="/career">ranks and track bonuses</a> for what each ladder pays out along the way.
</p>

<style>
	th.sortable {
		cursor: pointer;
		user-select: none;
	}
	th.sortable:hover {
		color: var(--text);
	}
	.dir {
		color: var(--accent);
		font-size: 11px;
	}
	.nameline {
		display: block;
		white-space: nowrap;
	}
	.row-icon {
		width: 20px;
		height: 20px;
		object-fit: cover;
		border-radius: 4px;
		vertical-align: -5px;
		margin-right: 7px;
	}
	.role {
		margin-left: 8px;
		font-size: 11px;
		color: var(--text-faint);
	}
	.modes {
		display: block;
		margin-top: 2px;
		font-size: 11px;
		color: var(--text-faint);
	}
	td.gate {
		min-width: 128px;
	}
	.gateline {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 6px;
		white-space: nowrap;
	}
	.rank {
		width: 18px;
		height: 18px;
		object-fit: contain;
		flex: none;
	}
	.main {
		font-variant-numeric: tabular-nums;
	}
	.sub {
		display: block;
		margin-top: 1px;
		font-size: 11px;
		color: var(--text-faint);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	td.gate.off .main {
		color: var(--text-faint);
		font-weight: 400;
	}
	.bar {
		display: block;
		margin-top: 3px;
		height: 3px;
		border-radius: 99px;
		background: var(--surface-raised);
		overflow: hidden;
	}
	.fill {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--accent);
	}
	td.extra {
		white-space: nowrap;
	}
	.need {
		display: block;
		font-size: 11px;
	}
	.none {
		color: var(--text-faint);
	}
	.foot {
		max-width: 78ch;
	}
</style>
