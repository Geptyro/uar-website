<script lang="ts">
	import { rankFor, totalWins, totalXp, careerXp, type PlayerProfile } from '$lib/players';
	import anonPortrait from '$lib/assets/anon-portrait.svg';
	import Pager from '$lib/components/Pager.svelte';
	import { goto } from '$app/navigation';
	import { page as currentPage } from '$app/state';

	let { data } = $props();
	const players = $derived(data.players);

	type Col = { key: string; label: string; num?: boolean; hint?: string };

	const columns: Col[] = [
		{ key: 'name', label: 'Player' },
		{
			key: 'career',
			label: 'Career XP',
			num: true,
			hint: 'XP across the three tracks, plus 600,000 per prestige'
		},
		{ key: 'xpEn', label: 'Enlisted', num: true },
		{ key: 'xpWo', label: 'Warrant Officer', num: true },
		{ key: 'xpCo', label: 'Commissioned Officer', num: true },
		{ key: 'prestige', label: 'Prestige', num: true },
		{ key: 'games', label: 'Games', num: true },
		{ key: 'wins', label: 'Wins', num: true },
		{ key: 'revives', label: 'Revives', num: true },
		{ key: 'avg', label: 'Avg game', num: true }
	];

	// search as you type, once typing pauses — the surrounding <form> keeps
	// working when JavaScript does not
	let searchTimer: ReturnType<typeof setTimeout>;
	function searchInput(event: Event) {
		clearTimeout(searchTimer);
		const value = (event.currentTarget as HTMLInputElement).value;
		searchTimer = setTimeout(() => {
			const params = new URLSearchParams(currentPage.url.search);
			if (value.trim()) params.set('q', value.trim());
			else params.delete('q');
			params.delete('page'); // a new search starts from the first page
			const query = params.toString();
			goto(query ? `?${query}` : currentPage.url.pathname, {
				keepFocus: true,
				replaceState: true,
				noScroll: true
			});
		}, 300);
	}

	// sorting is a link, not local state: the server holds the whole
	// leaderboard and sends one page of it
	function sortHref(key: string): string {
		const flip = data.sort === key && data.dir === 'desc';
		const dir = flip ? 'asc' : key === 'name' && data.sort !== key ? 'asc' : 'desc';
		return `?sort=${key}&dir=${dir}`;
	}

	function fmtSize(bytes: number): string {
		return bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
	}

	function fmtMinutes(seconds: number): string {
		return seconds ? `${Math.round(seconds / 60)} min` : '—';
	}

	const latest = $derived(data.latest);
	const ingested = $derived(data.replayCount);
</script>

<svelte:head>
	<title>Players — UAR Unit Database</title>
</svelte:head>

<div class="playerspage">
<div class="ptools">
	<form class="psearch" method="GET" data-sveltekit-keepfocus>
		<input
			type="search"
			name="q"
			value={data.q}
			placeholder="Search player, clan or toon…"
			oninput={searchInput}
			aria-label="Search players"
		/>
		{#if data.sort !== 'career'}<input type="hidden" name="sort" value={data.sort} />{/if}
		{#if data.dir !== 'desc'}<input type="hidden" name="dir" value={data.dir} />{/if}
	</form>
	<Pager page={data.page} pages={data.pages} total={data.total} label="players" />
</div>

<div class="tablewrap rows">
	<table class="data" style="min-width: 860px">
		<thead>
			<tr>
				<th class="num">#</th>
				{#each columns as col (col.key)}
					<th class:num={col.num} class="sortable">
						<a href={sortHref(col.key)} data-sveltekit-noscroll title={col.hint}>
							{col.label}
							<span class="dir">
								{data.sort === col.key ? (data.dir === 'asc' ? '↑' : '↓') : ''}
							</span>
						</a>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each players as p, i (p.toon)}
				<tr>
					<td class="num rank-pos">{(data.page - 1) * 50 + i + 1}</td>
					<td class="namecell">
						<span class="playercell">
							<img
								class="portrait"
								src={data.avatars[p.toon] ?? anonPortrait}
								alt=""
								loading="lazy"
							/>
							<span class="nameblock">
								{#if p.clan}<a class="clan" href="/clans/{encodeURIComponent(p.clan)}"
										>&lt;{p.clan}&gt;</a
									>{/if}
								<a class="pname" href="/players/{p.toon}">{p.name}</a>
								<span class="toon mono">{p.toon}</span>
							</span>
						</span>
					</td>
					<td class="num career">{careerXp(p).toLocaleString('en')}</td>
					{#each [rankFor(1, p.xpEn), rankFor(2, p.xpWo), rankFor(3, p.xpCo)] as rank, t (t)}
						{@const xp = t === 0 ? p.xpEn : t === 1 ? p.xpWo : p.xpCo}
						<td class="num">
							<span class="rankcell">
								{#if rank?.icon}<img class="insignia" src={rank.icon} alt="" loading="lazy" />{/if}
								<span class="grade mono" title={rank?.name}>{rank?.prefix ?? ''}</span>
								<span class="xp">{xp.toLocaleString('en')}</span>
							</span>
						</td>
					{/each}
					<td class="num">{p.prestige || ''}</td>
					<td class="num">{p.gamesPlayed.toLocaleString('en')}</td>
					<td class="num">{totalWins(p).toLocaleString('en')}</td>
					<td class="num">{p.revives.toLocaleString('en')}</td>
					<td class="num">{fmtMinutes(p.avgGameTime)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
</div>

<style>
	/* only the rows scroll: the note, the pager and the header stay put,
	   and the table runs the full width of the content area */
	.ptools {
		display: flex;
		align-items: center;
		/* breathing room between the toolbar and the table header */
		margin-bottom: 12px;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}
	.ptools :global(.pager) {
		margin: 0;
	}
	.psearch input {
		min-width: 240px;
	}
	.playerspage {
		display: flex;
		flex-direction: column;
		/* fills what the shell leaves us, so the table owns the scroll and
		   reaches the bottom of the window instead of floating above it */
		--bottom-gap: 8px;
		height: calc(100dvh - var(--topbar-h) - var(--content-pad-top, 26px) - var(--bottom-gap));
		margin-bottom: calc(var(--bottom-gap) - var(--content-pad-bottom, 72px));
	}
	.rows {
		flex: 1;
		min-height: 0;
		overflow: auto;
		margin-inline: calc(-1 * var(--content-pad-x, 36px));
		border-inline: none;
		border-radius: 0;
	}
	.rows thead th {
		position: sticky;
		top: 0;
		z-index: 2;
		background: var(--surface-2);
	}

	.rank-pos {
		color: var(--ink-3);
	}
	.career {
		font-weight: 650;
	}
	.namecell {
		white-space: nowrap;
	}
	.playercell {
		display: flex;
		align-items: center;
		gap: 9px;
	}
	.portrait {
		width: 32px;
		height: 32px;
		border-radius: var(--r-sm);
		object-fit: cover;
		border: 1px solid var(--border);
		flex-shrink: 0;
	}
	.nameblock {
		min-width: 0;
	}
	.clan {
		color: var(--ink-3);
		font-size: 12px;
		margin-right: 4px;
	}
	.pname {
		font-weight: 650;
	}
	.toon {
		display: block;
		font-size: 10.5px;
		color: var(--ink-3);
	}
	.rankcell {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		white-space: nowrap;
	}
	.insignia {
		width: 20px;
		height: 20px;
		object-fit: contain;
	}
	.grade {
		font-weight: 650;
		font-size: 11px;
	}
	.xp {
		font-variant-numeric: tabular-nums;
	}
</style>
