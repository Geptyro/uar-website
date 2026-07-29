<script lang="ts">
	import { careerXp, modeName } from '$lib/players';
	import { mosById, mosName, mosPageId } from '$lib/mos';
	import { fmtDuration } from '$lib/outcome';
	import OutcomeMark from '$lib/components/OutcomeMark.svelte';
	import ModeMark from '$lib/components/ModeMark.svelte';
	import ModifierMark from '$lib/components/ModifierMark.svelte';
	import { orderModifiers } from '$lib/modifiers';
	import Seo from '$lib/components/Seo.svelte';

	let { data } = $props();
	const r = $derived(data.replay);

	const when = $derived(r.playedAt.slice(0, 16).replace('T', ' '));

	function fmtSize(bytes: number): string {
		return bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
	}

	const players = $derived([...r.players].sort((a, b) => careerXp(b) - careerXp(a)));
</script>

<!-- One page per game, and a new one after every upload. They are worth
     serving and worth linking, but a search index full of them would bury the
     wiki — and crawling them is the most expensive thing the database does. -->
<Seo
	title="{when} — Replays"
	description="An ingested Undead Assault Reborn game from {when} UTC: {r.players
		.length} player profiles, class picks, save data and the replay file."
	noindex
/>

<div class="tiles">
	<div class="tile"><b>{when}</b><span>game date · UTC</span></div>
	<div class="tile">
		<b class="mode">{#if r.mode}<ModeMark mode={r.mode} />{:else}—{/if}</b>
		<span>game mode</span>
	</div>
	<div class="tile mods">
		<b class="modlist">
			{#each orderModifiers(r.modifiers) as id (id)}<ModifierMark {id} />{:else}—{/each}
		</b>
		<span>modifiers</span>
	</div>
	<div class="tile"><b>{r.players.length}</b><span>profiles</span></div>
	<div class="tile"><b>{fmtDuration(r.durationLoops)}</b><span>recorded</span></div>
	<div class="tile">
		<b class="outcome">
			<OutcomeMark outcome={r.outcome} size="lg" />
			{r.outcome === 'win' ? 'Won' : r.outcome === 'loss' ? 'Lost' : '—'}
		</b>
		<span>result</span>
	</div>
	<div class="tile"><b>{fmtSize(r.size)}</b><span>file size</span></div>
</div>

<p class="note meta">
	<span class="mono">{r.title}</span> · base build <span class="mono">{r.baseBuild}</span> ·
	recording length is the uploader's client recording — a leaver's replay is shorter than the
	full game.
	{#if !r.outcome}
		The result is unknown for now: this recording stopped before the game ended, and none of its
		players has uploaded a later game yet.
	{/if}
	{#if !r.mode}
		The mode is unknown for now: it is voted after the lobby, so it is only readable from a
		recording that lasted past the vote — or, for a game that was won, from the players' own
		save files once one of them uploads a later game.
	{/if}
</p>

{#if r.blobPruned}
	<p class="note pruned">
		The replay file is no longer stored. Every player in this game has since recorded a more
		recent one, so this copy was released to save space — replay files are kept as a progression
		backup, and only your latest game is needed for that. Everything shown on this page comes
		from the game's stored record and stays.
	</p>
{:else}
	<a class="dl" href="/replays/{r.file}" download rel="external">Download {r.file} ⬇</a>
{/if}

<h2 class="section">Players in this game</h2>
<div class="tablewrap">
	<table class="data" style="max-width: 860px">
		<thead>
			<tr>
				<th>Player</th>
				<th>Class picked</th>
				<th class="num">Career XP</th>
				<th class="num">Prestige</th>
				<th class="num">Games</th>
				<th class="num">Revives</th>
			</tr>
		</thead>
		<tbody>
			{#each players as p (p.toon)}
				<tr>
					<td class="namecell">
						{#if p.clan}<a class="clan" href="/clans/{encodeURIComponent(p.clan)}"
								>&lt;{p.clan}&gt;</a
							>{/if}
						<a class="pname" href="/players/{p.toon}">{p.name}</a>
					</td>
					<td>
						<div class="classlist">
						{#each p.mos as id (id)}
							{@const info = mosById.get(id)}
							{@const pageId = mosPageId(id)}
							{#if pageId}
								<a class="tag t-mos" href="/mos/{pageId}">
									{#if info?.icon}<img class="class-icon" src={info.icon} alt="" loading="lazy" />{/if}
									{mosName(id)}
								</a>
							{:else}
								<span class="tag t-mos">{mosName(id)}</span>
							{/if}
						{:else}
							<span class="none">—</span>
						{/each}
						</div>
					</td>
					<td class="num">{careerXp(p).toLocaleString('en')}</td>
					<td class="num">{p.prestige || ''}</td>
					<td class="num">{p.gamesPlayed.toLocaleString('en')}</td>
					<td class="num">{p.revives.toLocaleString('en')}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
<p class="note">
	Values are each player's career save-file state as of game start — progress earned in this game
	shows up in their next sighting. Players are ordered by career XP.
</p>

<style>
	.meta {
		margin-top: 12px;
	}
	.outcome {
		display: flex;
		align-items: center;
		gap: 7px;
	}
	/* the mode tile carries the mark at the tile's own type size, so the icon
	   scales with it rather than being pinned to a pixel height */
	.mode {
		display: flex;
		align-items: center;
	}
	/* the modifier tile holds a variable number of chips, so it is the one
	   tile allowed to grow and wrap rather than sit on the tile grid's rhythm */
	.tile.mods {
		flex: 1 1 auto;
		min-width: 150px;
	}
	.modlist {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		font-size: 13px;
	}
	.dl {
		display: inline-block;
		padding: 7px 16px;
		border-radius: var(--radius-2);
		background: var(--accent);
		color: var(--accent-contrast);
		font-weight: 650;
		font-size: 13px;
		text-decoration: none;
	}
	.dl:hover {
		background: var(--accent-dim);
	}
	.pruned {
		max-width: 640px;
		border-left: 2px solid var(--border);
		padding-left: 12px;
	}
	.namecell .clan {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--text-faint);
		text-decoration: none;
		margin-right: 5px;
	}
	.namecell .clan:hover {
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.namecell .pname {
		font-weight: 550;
	}
	.classlist {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.classlist a.tag {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		text-decoration: none;
	}
	.classlist a.tag:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.class-icon {
		width: 15px;
		height: 15px;
		object-fit: cover;
		border-radius: 3px;
	}
	.none {
		color: var(--text-faint);
	}
</style>
