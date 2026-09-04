<script lang="ts">
	/**
	 * The effects catalog: every buff, debuff, status and ailment the site
	 * names, under its kind. One row each: the icon the game shows, the name,
	 * what it does, how long it lasts, what puts it on a unit and what takes it
	 * off, each linking to the card that does it. The ailments lead, with the
	 * roll the script makes for each.
	 */
	import { KIND_LABELS, KIND_ORDER, ailmentRule, effectHref, refHref, type Effect, type EffectKind } from '$lib/effects';
	import { modKind, sec } from '$lib/skillstats';
	import StatIcon from '$lib/components/StatIcon.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { Page } from 'sveltekit-commons';

	let { data } = $props();

	let query = $state('');
	let only = $state<EffectKind | null>(null);

	const shown = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return data.effects.filter(
			(e) =>
				(!only || e.kind === only) &&
				(!q ||
					e.name.toLowerCase().includes(q) ||
					e.effects.some((x) => x.toLowerCase().includes(q)) ||
					e.appliedBy.some((r) => r.abilityName.toLowerCase().includes(q) || r.ownerName.toLowerCase().includes(q)) ||
					e.curedBy.some((r) => r.abilityName.toLowerCase().includes(q) || r.ownerName.toLowerCase().includes(q)))
		);
	});
	const sections = $derived(
		KIND_ORDER.map((k) => ({ kind: k, ...KIND_LABELS[k], rows: shown.filter((e) => e.kind === k) })).filter(
			(s) => s.rows.length
		)
	);
	const counts = $derived(KIND_ORDER.map((k) => ({ kind: k, n: data.effects.filter((e) => e.kind === k).length })));

	function lasts(e: Effect): string {
		if (!e.dur) return '';
		return `${sec(e.dur)}${e.durSpread ? ` ± ${sec(e.durSpread)}` : ''}`;
	}
	/** The same ability on many classes (every class's Perform Self-Aid) reads once, with the count. */
	function grouped(refs: Effect['appliedBy']): { first: Effect['appliedBy'][number]; owners: string[]; level?: number }[] {
		const by = new Map<string, { first: Effect['appliedBy'][number]; owners: string[]; level?: number }>();
		for (const r of refs) {
			const key = `${r.kind}:${r.abilityName}`;
			const g = by.get(key);
			if (g) g.owners.push(r.ownerName);
			else by.set(key, { first: r, owners: [r.ownerName], level: r.level });
		}
		return [...by.values()];
	}
	function refLabel(g: { first: Effect['appliedBy'][number]; owners: string[] }): string {
		const r = g.first;
		if (g.owners.length > 2) return `${r.abilityName} · ${g.owners.length} ${r.kind === 'entity' ? 'units' : 'classes'}`;
		if (r.abilityName === r.ownerName) return r.abilityName;
		return `${r.abilityName} · ${g.owners.join(', ')}`;
	}
	function initials(name: string): string {
		return (name.match(/[A-Za-z0-9]+/g) ?? [])
			.slice(0, 2)
			.map((w) => w[0].toUpperCase())
			.join('');
	}
</script>

<Page>
	<Seo
		title="Effects"
		description="Every buff, debuff, status and ailment in Undead Assault Reborn: what it does, how long it lasts, what puts it on you and what cures it, read from the map data."
	/>

	<p class="note">
		The {data.effects.length} effects the map puts on units and the site names anywhere: the ailments a
		hero can catch, the debuffs hits leave, the buffs skills and items give, the states the script reads.
		What each does is read from the map's behaviour data; the ailments' odds from the trigger that rolls
		them. Names link to the card that applies or cures the effect.
	</p>

	<div class="filters">
		<input type="search" placeholder="Search an effect, an ability, a class…" bind:value={query} aria-label="Search effects" />
		<div class="kinds">
			<button type="button" class:on={only === null} onclick={() => (only = null)}>All</button>
			{#each counts as c (c.kind)}
				<button type="button" class:on={only === c.kind} onclick={() => (only = only === c.kind ? null : c.kind)}>
					{KIND_LABELS[c.kind].label} <span class="n">{c.n}</span>
				</button>
			{/each}
		</div>
	</div>

	{#each sections as s (s.kind)}
		<h2 class="section">{s.label} · {s.rows.length}</h2>
		<p class="note">{s.note}</p>
		<div class="tablewrap">
			<table class="data effects">
				<thead>
					<tr>
						<th>Effect</th>
						<th>What it does</th>
						<th class="num">Lasts</th>
						<th>{s.kind === 'ailment' ? 'How you catch it' : 'From'}</th>
						{#if s.kind === 'ailment' || s.rows.some((e) => e.curedBy.length)}<th>Cured by</th>{/if}
					</tr>
				</thead>
				<tbody>
					{#each s.rows as e (e.id)}
						<tr id="e-{e.id}">
							<td class="namecell">
								<div class="who">
									{#if e.icon}<img class="row-icon" src={e.icon} alt="" loading="lazy" />{:else}<span class="row-icon fb">{initials(e.name)}</span>{/if}
									<div>
										<div class="ename"><a href={effectHref(e.id)}>{e.name}</a>{#if e.hidden && e.kind !== 'ailment'}<span class="tag" title="The game does not show it on the status bar">hidden</span>{/if}{#if e.stacks}<span class="tag">up to {e.stacks} stacks</span>{/if}</div>
										{#if e.tooltip}<div class="tip">{e.tooltip}</div>{/if}
									</div>
								</div>
							</td>
							<td class="mono does">
								{#if e.effects.length}
									<ul class="stats">
										{#each e.effects as x, i (i)}
											<li><StatIcon name={modKind(x)[1]} size={13} />{x}</li>
										{/each}
									</ul>
								{:else}
									<span class="faint">no stat change in the data</span>
								{/if}
							</td>
							<td class="num">{lasts(e) || '–'}</td>
							<td class="from">
								{#if e.ailment}<div class="rule">{ailmentRule(e)}</div>{/if}
								{#if e.appliedBy.length}
									<ul>
										{#each grouped(e.appliedBy) as g, i (i)}
											<li>
												{#if g.first.abilityIcon}<img class="ic" src={g.first.abilityIcon} alt="" loading="lazy" />{/if}
												{#if refHref(g.first)}<a href={refHref(g.first)} title={g.owners.join(', ')}>{refLabel(g)}</a>{:else}{refLabel(g)}{/if}
												{#if g.level}<span class="faint">lv {g.level}</span>{/if}
											</li>
										{/each}
									</ul>
								{:else if !e.ailment}
									<span class="faint">–</span>
								{/if}
							</td>
							{#if s.kind === 'ailment' || s.rows.some((x) => x.curedBy.length)}
								<td class="from">
									{#if e.curedBy.length}
										<ul>
											{#each grouped(e.curedBy) as g, i (i)}
												<li>
													{#if g.first.abilityIcon}<img class="ic" src={g.first.abilityIcon} alt="" loading="lazy" />{/if}
													{#if refHref(g.first)}<a href={refHref(g.first)} title={g.owners.join(', ')}>{refLabel(g)}</a>{:else}{refLabel(g)}{/if}
												</li>
											{/each}
										</ul>
									{:else}
										<span class="faint">–</span>
									{/if}
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/each}
	{#if !sections.length}
		<p class="note">Nothing matches.</p>
	{/if}
</Page>

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 10px 16px;
		align-items: center;
		margin: 0 0 6px;
	}
	.filters input {
		flex: 1 1 260px;
		max-width: 420px;
		font: inherit;
		font-size: 13px;
		padding: 7px 10px;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-2);
		background: var(--surface);
		color: var(--text);
	}
	.kinds {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.kinds button {
		all: unset;
		cursor: pointer;
		font-family: var(--font-mono);
		font-size: 11px;
		padding: 4px 10px;
		border-radius: 99px;
		border: 1px solid var(--border);
		color: var(--text-dim);
	}
	.kinds button.on {
		color: var(--accent);
		background: var(--accent-soft);
		border-color: transparent;
	}
	.kinds .n {
		color: var(--text-faint);
		margin-left: 4px;
	}
	.kinds button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	table.effects {
		min-width: 900px;
	}
	.namecell {
		min-width: 220px;
	}
	/* the flex lives on a wrapper, not the td: a flex td stops being a table
	   cell, so its border sits under its own text instead of the row's bottom */
	.who {
		display: flex;
		gap: 10px;
		align-items: flex-start;
	}
	.row-icon {
		width: 36px;
		height: 36px;
		border-radius: var(--radius-2);
		object-fit: cover;
		flex-shrink: 0;
		background: var(--surface-raised);
	}
	.row-icon.fb {
		display: grid;
		place-items: center;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--text-faint);
	}
	.ename a {
		text-decoration: none;
	}
	.ename a:hover {
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.ename {
		font-weight: 600;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
	}
	.tag {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 500;
		color: var(--text-faint);
		border: 1px solid var(--border);
		border-radius: 99px;
		padding: 1px 7px;
	}
	.tip {
		font-size: 12px;
		color: var(--text-dim);
		white-space: pre-line;
		max-width: 44ch;
	}
	.does ul,
	.from ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.does {
		color: var(--text);
		min-width: 220px;
	}
	.stats li {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.from li {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 2px 0;
	}
	.from .ic {
		width: 18px;
		height: 18px;
		border-radius: 3px;
		object-fit: cover;
		flex-shrink: 0;
		background: var(--surface-raised);
	}
	.from {
		font-size: 12.5px;
		min-width: 200px;
	}
	.from a {
		text-decoration: none;
		font-weight: 550;
	}
	.from a:hover {
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.rule {
		color: var(--text-dim);
		max-width: 40ch;
		margin: 0 0 4px;
	}
	.faint {
		color: var(--text-faint);
	}
	.from .faint {
		font-family: var(--font-mono);
		font-size: 10.5px;
		margin-left: 4px;
	}
	/* an anchored row lights up so the link from a class card lands on it */
	tr:target td {
		background: var(--accent-soft);
	}
</style>
