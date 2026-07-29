<script lang="ts">
	import type { ClanSummary } from '$lib/clans';
	import Seo from '$lib/components/Seo.svelte';

	let { data } = $props();
	const clans = $derived(data.clans);
	const inClans = $derived(clans.reduce((sum, c) => sum + c.members, 0));

	type Col = {
		key: string;
		label: string;
		num?: boolean;
		value: (c: ClanSummary) => number | string;
	};

	const columns: Col[] = [
		{ key: 'tag', label: 'Clan', value: (c) => c.tag.toLowerCase() },
		{ key: 'members', label: 'Members', num: true, value: (c) => c.members },
		{ key: 'career', label: 'Career XP', num: true, value: (c) => c.careerXp },
		{ key: 'games', label: 'Games', num: true, value: (c) => c.games },
		{ key: 'wins', label: 'Wins', num: true, value: (c) => c.wins },
		{ key: 'revives', label: 'Revives', num: true, value: (c) => c.revives },
		{ key: 'top', label: 'Top player', value: (c) => c.top.name.toLowerCase() },
		{ key: 'seen', label: 'Last seen', value: (c) => c.lastSeen }
	];

	let sortKey = $state('career');
	let sortDir = $state(-1);

	function setSort(key: string) {
		if (sortKey === key) sortDir *= -1;
		else {
			sortKey = key;
			sortDir = key === 'tag' || key === 'top' ? 1 : -1;
		}
	}

	const sorted = $derived.by(() => {
		const col = columns.find((c) => c.key === sortKey);
		const value = col?.value ?? ((c: ClanSummary) => c.careerXp);
		const out = [...clans];
		out.sort((a, b) => {
			const x = value(a);
			const y = value(b);
			const cmp = typeof x === 'number' ? x - (y as number) : String(x).localeCompare(String(y));
			return cmp * sortDir || b.careerXp - a.careerXp;
		});
		return out;
	});
</script>

<Seo
	title="Clans"
	description="Clans seen in ingested Undead Assault Reborn replays, with their combined career XP, games, wins and top player."
/>

<p class="note">
	Clans seen in ingested replays, grouped by the clan tag each player carried in their newest
	sighting. {inClans} of {data.playerCount} known <a href="/players">players</a> wear a clan tag.
</p>

<div class="tablewrap">
	<table class="data" style="min-width: 720px">
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
			{#each sorted as c, i (c.tag)}
				<tr>
					<td class="num rank-pos">{i + 1}</td>
					<td>
						<a class="cname" href="/clans/{encodeURIComponent(c.tag)}">&lt;{c.tag}&gt;</a>
					</td>
					<td class="num">{c.members}</td>
					<td class="num career">{c.careerXp.toLocaleString('en')}</td>
					<td class="num">{c.games.toLocaleString('en')}</td>
					<td class="num">{c.wins.toLocaleString('en')}</td>
					<td class="num">{c.revives.toLocaleString('en')}</td>
					<td class="topcell">
						<a href="/players/{c.top.toon}">{c.top.name}</a>
					</td>
					<td class="mono">{c.lastSeen.slice(0, 10)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<p class="note">
	Clan membership is whatever the game lobby reported when the replay was recorded — a player who
	left or switched clans counts toward their most recently seen tag only.
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
	.rank-pos {
		color: var(--text-faint);
	}
	.career {
		font-weight: 650;
	}
	.cname {
		font-weight: 650;
		white-space: nowrap;
	}
	.topcell {
		white-space: nowrap;
	}
</style>
