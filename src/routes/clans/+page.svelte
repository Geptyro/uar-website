<script lang="ts">
	import Pager from '$lib/components/Pager.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { goto } from '$app/navigation';
	import { page as currentPage } from '$app/state';
	import { Page } from 'sveltekit-commons';

	let { data } = $props();
	const clans = $derived(data.clans);

	type Col = { key: string; label: string; num?: boolean; hint?: string };

	const columns: Col[] = [
		{
			key: 'tag',
			label: 'Clan',
			hint: 'The tag each member wore in their newest ingested replay. A player who left or switched clans counts toward that tag only.'
		},
		{ key: 'members', label: 'Members', num: true },
		{ key: 'career', label: 'Career XP', num: true, hint: 'Career XP of every member, summed' },
		{ key: 'games', label: 'Games', num: true },
		{ key: 'wins', label: 'Wins', num: true },
		{ key: 'revives', label: 'Revives', num: true },
		{ key: 'top', label: 'Top player', hint: 'The member with the most career XP' },
		{ key: 'seen', label: 'Last seen', hint: 'The newest replay any member was seen in' }
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

	// sorting is a link, not local state, same as /players: the server holds
	// the whole list and sends one page of it
	function sortHref(key: string): string {
		const flip = data.sort === key && data.dir === 'desc';
		const text = key === 'tag' || key === 'top';
		const dir = flip ? 'asc' : text && data.sort !== key ? 'asc' : 'desc';
		return `?sort=${key}&dir=${dir}`;
	}
</script>

<Page fill>
	<Seo
		title="Clans"
		description="Clans seen in ingested Undead Assault Reborn replays, with their combined career XP, games, wins and top player."
	/>

	<div class="datapage">
	<div class="dtools">
		<form method="GET" data-sveltekit-keepfocus>
			<input
				type="search"
				name="q"
				value={data.q}
				placeholder="Search clan or top player…"
				oninput={searchInput}
				aria-label="Search clans"
			/>
			{#if data.sort !== 'career'}<input type="hidden" name="sort" value={data.sort} />{/if}
			{#if data.dir !== 'desc'}<input type="hidden" name="dir" value={data.dir} />{/if}
		</form>
		<span class="rowcount">
			{data.inClans} of {data.playerCount} <a href="/players">players</a> wear a tag
		</span>
		<div class="right">
			<Pager page={data.page} pages={data.pages} total={data.total} label="clans" shortcuts />
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
				{#each clans as c, i (c.tag)}
					<tr>
						<td class="num rownum">{(data.page - 1) * data.perPage + i + 1}</td>
						<td class="namecell">
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
	</div>
</Page>

<style>
	/* the page shape — toolbar put, rows scrolling, full-bleed table — is
	   .datapage in the layout, shared with /players and /entities */
	.career {
		font-weight: 650;
	}
	.namecell,
	.topcell {
		white-space: nowrap;
	}
	.cname {
		font-weight: 650;
	}
	.rowcount a {
		color: inherit;
	}
</style>
