<script lang="ts">
	import { totalWins, careerXp, fmtPlaytime, type PlayerProfile } from '$lib/players';
	import anonPortrait from '$lib/assets/anon-portrait.svg';
	import { portraitFallback } from '$lib/portrait';
	import Pager from '$lib/components/Pager.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { goto } from '$app/navigation';
	import { page as currentPage } from '$app/state';
	import { Page } from 'sveltekit-commons';

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
		{ key: 'prestige', label: 'Prestige', num: true },
		{ key: 'games', label: 'Games', num: true },
		{ key: 'wins', label: 'Wins', num: true },
		{ key: 'revives', label: 'Revives', num: true },
		{
			key: 'time',
			label: 'Time on record',
			num: true,
			// "on record" and not "played": Games beside it is the map's own
			// career count, this is only the games somebody uploaded
			hint: 'Time in recorded games, each counted for as long as the player was in it — not the map\'s career total'
		},
		{
			key: 'avg',
			label: 'Avg game',
			num: true,
			hint: 'The map\'s own figure: a running average of game length it updates only after a loss'
		}
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

<Page fill>
	<Seo
		title="Players"
		description="Every player seen in an ingested Undead Assault Reborn replay, ranked by career XP: rank tracks, prestige, games played, wins and revives."
	/>

	<div class="datapage">
	<div class="dtools">
		<form method="GET" data-sveltekit-keepfocus>
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
		<div class="right">
			<Pager page={data.page} pages={data.pages} total={data.total} label="players" shortcuts />
		</div>
	</div>

	<div class="tablewrap rows">
		<table class="data" style="min-width: 720px">
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
						<td class="num rownum">{(data.page - 1) * 50 + i + 1}</td>
						<td class="namecell">
							<span class="playercell">
								<img
									class="portrait"
									src={data.avatars[p.toon] ?? anonPortrait}
									alt=""
									loading="lazy"
									use:portraitFallback={anonPortrait}
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
						<td class="num">{p.prestige || ''}</td>
						<td class="num">{p.gamesPlayed.toLocaleString('en')}</td>
						<td class="num">{totalWins(p).toLocaleString('en')}</td>
						<td class="num">{p.revives.toLocaleString('en')}</td>
						<!-- absent until the profile has been rebuilt since the field was added -->
						<td class="num">{p.playSeconds === undefined ? '—' : fmtPlaytime(p.playSeconds)}</td>
						<td class="num">{fmtMinutes(p.avgGameTime)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	</div>
</Page>

<style>
	/* the page shape — toolbar put, rows scrolling, full-bleed table — is
	   .datapage in the layout, shared with /entities */
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
		border-radius: var(--radius-2);
		object-fit: cover;
		border: 1px solid var(--border);
		flex-shrink: 0;
	}
	.nameblock {
		min-width: 0;
	}
	.clan {
		color: var(--text-faint);
		font-size: 12px;
		margin-right: 4px;
	}
	.pname {
		font-weight: 650;
	}
	.toon {
		display: block;
		font-size: 10.5px;
		color: var(--text-faint);
	}
</style>
