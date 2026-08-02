<script lang="ts">
	import { rankFor, totalWins, careerXp } from '$lib/players';
	import Seo from '$lib/components/Seo.svelte';
	import { clanDescription } from '$lib/seo';
	import { Page } from 'sveltekit-commons';

	let { data } = $props();
	const clan = $derived(data.clan);
	const members = $derived(data.members);

	function fmtMinutes(seconds: number): string {
		return seconds ? `${Math.round(seconds / 60)} min` : '—';
	}
</script>

<Seo title="&lt;{clan.tag}&gt; — Clans" description={clanDescription(clan)} />
<Page>

	<p class="note">
		Players seen wearing the &lt;{clan.tag}&gt; tag in their newest ingested replay — snapshots of
		each member's save data, same as the <a href="/players">player leaderboard</a>.
	</p>

	<div class="tiles">
		<div class="tile"><b>{clan.members}</b><span>Members</span></div>
		<div class="tile"><b>{clan.careerXp.toLocaleString('en')}</b><span>Career XP</span></div>
		<div class="tile"><b>{clan.games.toLocaleString('en')}</b><span>Games</span></div>
		<div class="tile"><b>{clan.wins.toLocaleString('en')}</b><span>Wins</span></div>
		<div class="tile"><b>{clan.revives.toLocaleString('en')}</b><span>Revives</span></div>
		<div class="tile"><b>{clan.lastSeen.slice(0, 10)}</b><span>Last seen</span></div>
	</div>

	<h2 class="section">Members</h2>
	<div class="tablewrap">
		<table class="data" style="min-width: 860px">
			<thead>
				<tr>
					<th class="num">#</th>
					<th>Player</th>
					<th class="num">Career XP</th>
					<th class="num">Enlisted</th>
					<th class="num">Warrant Officer</th>
					<th class="num">Commissioned Officer</th>
					<th class="num">Prestige</th>
					<th class="num">Games</th>
					<th class="num">Wins</th>
					<th class="num">Revives</th>
					<th class="num">Avg game</th>
				</tr>
			</thead>
			<tbody>
				{#each members as p, i (p.toon)}
					<tr>
						<td class="num rank-pos">{i + 1}</td>
						<td class="namecell">
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
		<a href="/clans">← All clans</a>
	</p>
</Page>

<style>
	.rank-pos {
		color: var(--text-faint);
	}
	.career {
		font-weight: 650;
	}
	.namecell {
		white-space: nowrap;
	}
	.pname {
		font-weight: 650;
	}
	.toon {
		display: block;
		font-size: 10.5px;
		color: var(--text-faint);
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
