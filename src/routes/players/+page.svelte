<script lang="ts">
	import {
		players,
		replays,
		rankFor,
		totalWins,
		totalXp,
		careerXp,
		type PlayerProfile
	} from '$lib/players';

	type Col = {
		key: string;
		label: string;
		num?: boolean;
		value: (p: PlayerProfile) => number | string;
	};

	const columns: Col[] = [
		{ key: 'name', label: 'Player', value: (p) => p.name.toLowerCase() },
		{ key: 'career', label: 'Career XP', num: true, value: (p) => careerXp(p) },
		{ key: 'xpEn', label: 'Enlisted', num: true, value: (p) => p.xpEn },
		{ key: 'xpWo', label: 'Warrant Officer', num: true, value: (p) => p.xpWo },
		{ key: 'xpCo', label: 'Commissioned Officer', num: true, value: (p) => p.xpCo },
		{ key: 'prestige', label: 'Prestige', num: true, value: (p) => p.prestige },
		{ key: 'games', label: 'Games', num: true, value: (p) => p.gamesPlayed },
		{ key: 'wins', label: 'Wins', num: true, value: (p) => totalWins(p) },
		{ key: 'revives', label: 'Revives', num: true, value: (p) => p.revives },
		{ key: 'avg', label: 'Avg game', num: true, value: (p) => p.avgGameTime }
	];

	let sortKey = $state('career');
	let sortDir = $state(-1);

	function setSort(key: string) {
		if (sortKey === key) sortDir *= -1;
		else {
			sortKey = key;
			// numbers feel right descending-first, names ascending-first
			sortDir = key === 'name' ? 1 : -1;
		}
	}

	const sorted = $derived.by(() => {
		const col = columns.find((c) => c.key === sortKey);
		const value = col?.value ?? careerXp;
		const out = [...players];
		out.sort((a, b) => {
			const x = value(a);
			const y = value(b);
			const cmp = typeof x === 'number' ? x - (y as number) : String(x).localeCompare(String(y));
			return cmp * sortDir || careerXp(b) - careerXp(a);
		});
		return out;
	});

	function fmtSize(bytes: number): string {
		return bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
	}

	function fmtMinutes(seconds: number): string {
		return seconds ? `${Math.round(seconds / 60)} min` : '—';
	}

	const latest = replays.at(-1)?.playedAt?.slice(0, 10) ?? '';
	const ingested = replays.filter((r) => r.players > 0).length;
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
					<th class:num={col.num} class="sortable" onclick={() => setSort(col.key)}>
						{col.label}
						<span class="dir">{sortKey === col.key ? (sortDir > 0 ? '↑' : '↓') : ''}</span>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each sorted as p, i (p.toon)}
				<tr>
					<td class="num rank-pos">{i + 1}</td>
					<td class="namecell">
						{#if p.clan}<span class="clan">&lt;{p.clan}&gt;</span>{/if}
						<a class="pname" href="/players/{p.toon}">{p.name}</a>
						<span class="toon mono">{p.toon}</span>
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

<p class="note">
	Experience caps at 250,000 per track; Career XP adds 600,000 per prestige (prestiging requires
	all three tracks maxed and resets each to 50,000). Profiles appear once a player shows up in an
	ingested replay with existing save data — brand-new players are recorded from their second game
	on.
</p>

<h2 class="section">Ingested replays</h2>
<div class="tablewrap">
	<table class="data" style="max-width: 560px">
		<thead>
			<tr>
				<th>Game date</th>
				<th class="num">Profiles</th>
				<th class="num">Size</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each [...replays].reverse() as r (r.file)}
				<tr>
					<td class="mono">{r.playedAt.slice(0, 16).replace('T', ' ')} UTC</td>
					<td class="num">{r.players}</td>
					<td class="num">{fmtSize(r.size)}</td>
					<td><a href="/replays/{r.file}" download rel="external">Download ⬇</a></td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

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
