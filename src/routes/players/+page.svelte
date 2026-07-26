<script lang="ts">
	import { rankFor, totalWins, totalXp, careerXp, type PlayerProfile } from '$lib/players';
	import anonPortrait from '$lib/assets/anon-portrait.svg';
	import Pager from '$lib/components/Pager.svelte';

	let { data } = $props();
	const players = $derived(data.players);

	type Col = { key: string; label: string; num?: boolean };

	const columns: Col[] = [
		{ key: 'name', label: 'Player' },
		{ key: 'career', label: 'Career XP', num: true },
		{ key: 'xpEn', label: 'Enlisted', num: true },
		{ key: 'xpWo', label: 'Warrant Officer', num: true },
		{ key: 'xpCo', label: 'Commissioned Officer', num: true },
		{ key: 'prestige', label: 'Prestige', num: true },
		{ key: 'games', label: 'Games', num: true },
		{ key: 'wins', label: 'Wins', num: true },
		{ key: 'revives', label: 'Revives', num: true },
		{ key: 'avg', label: 'Avg game', num: true }
	];

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

<p class="note">
	Player profiles decoded from the save data that replays capture at game start — experience and
	rank in the three <a href="/ranks">rank tracks</a>, prestige, games played, wins and revives.
	Each profile is a snapshot from the newest ingested replay that player appears in ({ingested}
	replay{ingested === 1 ? '' : 's'} ingested, latest {latest}).
</p>

<div class="tablewrap">
	<table class="data" style="min-width: 860px">
		<thead>
			<tr>
				<th class="num">#</th>
				{#each columns as col (col.key)}
					<th class:num={col.num} class="sortable">
						<a href={sortHref(col.key)} data-sveltekit-noscroll>
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
<Pager page={data.page} pages={data.pages} total={data.total} label="players" />

<p class="note">
	Experience caps at 250,000 per track; Career XP adds 600,000 per prestige (prestiging requires
	all three tracks maxed and resets each to 50,000). Profiles appear once a player shows up in an
	ingested replay with existing save data — brand-new players are recorded from their second game
	on.
</p>

<p class="note">
	Data comes from {data.replayCount} ingested replays —
	<a href="/replays">browse, download or upload replays →</a>
</p>

<style>
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
