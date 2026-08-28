<script lang="ts">
	/**
	 * Every trigger group, as a table under its type: missions first, then
	 * the mechanics, the timed events and the world's own triggers. One row
	 * per group; the name links to its page.
	 */
	import { GROUP_TYPES, groups, groupById, groupHref, groupXp, type GroupType } from '$lib/groups';
	import { fmtTime } from '$lib/flow';
	import Seo from '$lib/components/Seo.svelte';
	import { Page } from 'sveltekit-commons';

	let { data } = $props();

	let query = $state('');
	let only = $state<GroupType | null>(null);

	const shown = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return groups.filter(
			(g) =>
				(!only || g.type === only) &&
				(!q ||
					g.name.toLowerCase().includes(q) ||
					g.outcomes.some((o) => o.name.toLowerCase().includes(q)) ||
					g.armedBy.some((a) => a.name.toLowerCase().includes(q)))
		);
	});
	const sections = $derived(
		GROUP_TYPES.map((t) => ({ ...t, rows: shown.filter((g) => g.type === t.type) })).filter(
			(s) => s.rows.length
		)
	);
	const counts = GROUP_TYPES.map((t) => ({ ...t, n: groups.filter((g) => g.type === t.type).length }));
	const triggerCount = groups.reduce((n, g) => n + g.triggers.length, 0);
</script>

<Page>
	<Seo
		title="Triggers"
		description="The triggers of Undead Assault Reborn's map script, grouped into what a player meets as one thing: the missions, the mechanics, the timed events. One page each, with the map and the chain that runs it."
	/>

	<p class="note">
		The {triggerCount} triggers of the map script that put something in front of the player, in
		{groups.length} groups: a group is the triggers that arm each other or work on the same unit, region or
		flag, and it is typed by what it does. Each page shows where it happens on AO Thalim beside the chain
		of triggers that runs it. Every named region of the AO is on the <a href="/map">Map</a>, with the groups
		that use it.
	</p>

	<h2 class="section">Scheduled at fixed game time</h2>
	<div class="timeline card">
		{#each data.scheduled as s (s.id)}
			<div class="tl-row">
				<span class="tl-time">{fmtTime(s.at)}</span>
				<a href="{groupHref(s.group!)}#{s.id}">{s.name}</a>
				<span class="tl-group">{groupById.get(s.group!)?.name}</span>
			</div>
		{/each}
	</div>

	<h2 class="section">Groups</h2>

	<div class="controls">
		<button class="chip" aria-pressed={only === null} onclick={() => (only = null)}>all · {groups.length}</button>
		{#each counts as t (t.type)}
			<button
				class="chip k-{t.type}"
				aria-pressed={only === t.type}
				title={t.blurb}
				onclick={() => (only = only === t.type ? null : t.type)}>{t.plural} · {t.n}</button
			>
		{/each}
		<input type="search" placeholder="Find a group, an outcome, a trigger…" aria-label="Find a group" bind:value={query} />
	</div>

	<div class="tablewrap">
		<table class="data">
			<thead>
				<tr>
					<th>Group</th>
					<th class="num">Triggers</th>
					<th>Outcomes</th>
					<th class="num">XP</th>
					<th>Armed by</th>
				</tr>
			</thead>
			{#each sections as s (s.type)}
				<tbody>
					<tr class="head k-{s.type}">
						<th colspan="5"><span class="kind">{s.plural}</span> <span class="blurb">{s.blurb}</span></th>
					</tr>
					{#each s.rows as g (g.id)}
						{@const xp = groupXp(g)}
						<tr>
							<td><a href={groupHref(g.id)}>{g.name}</a></td>
							<td class="num">{g.triggers.length}</td>
							<td class="outs">
								{#each g.outcomes.slice(0, 4) as o (o.id)}
									<span class:gain={o.xp !== null} class:loss={o.fail !== null}>{o.name}</span>
								{/each}
								{#if g.outcomes.length > 4}<span class="more">+{g.outcomes.length - 4}</span>{/if}
							</td>
							<td class="num gain">{xp ? `+${xp}` : ''}</td>
							<td class="armed">{g.armedBy.map((a) => a.name).join(', ')}</td>
						</tr>
					{/each}
				</tbody>
			{:else}
				<tbody><tr><td colspan="5" class="empty">No group matched.</td></tr></tbody>
			{/each}
		</table>
	</div>
</Page>

<style>
	.timeline {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr));
		gap: 6px 28px;
		margin-bottom: 22px;
	}
	.tl-row {
		display: flex;
		align-items: baseline;
		gap: 10px;
		font-size: 13px;
		min-width: 0;
	}
	.tl-time {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 650;
		color: var(--accent);
		min-width: 44px;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.tl-row a {
		color: var(--text);
		text-decoration: none;
	}
	.tl-row a:hover {
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.tl-group {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--text-faint);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 7px;
		margin-bottom: 12px;
	}
	.controls input {
		margin-left: auto;
		width: min(320px, 100%);
	}
	.k-mission {
		--tone: var(--accent);
	}
	.k-mechanic {
		--tone: var(--mos);
	}
	.k-event {
		--tone: var(--gold);
	}
	.k-world {
		--tone: var(--item);
	}
	/* a typed chip pressed shows in its type's tone; "all" keeps the site's own pressed look */
	.chip[class*='k-'][aria-pressed='true'] {
		background: color-mix(in srgb, var(--tone) 18%, transparent);
		border-color: var(--tone);
		color: var(--tone);
	}
	tr.head th {
		padding-top: 14px;
		background: none;
		border-bottom: 1px solid var(--tone, var(--border));
	}
	.kind {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--tone, var(--text));
	}
	.blurb {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 400;
		color: var(--text-faint);
		margin-left: 8px;
	}
	.outs {
		display: flex;
		flex-wrap: wrap;
		gap: 2px 10px;
		font-size: 12px;
		color: var(--text-dim);
	}
	.gain {
		color: var(--accent);
	}
	.loss {
		color: var(--hostile);
	}
	.more {
		color: var(--text-faint);
	}
	.armed {
		font-size: 12px;
		color: var(--text-dim);
	}
	.empty {
		color: var(--text-faint);
		text-align: center;
		padding: 20px;
	}
</style>
