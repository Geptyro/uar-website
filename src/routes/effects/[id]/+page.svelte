<script lang="ts">
	/**
	 * One effect's page: its art and name, the game's text, what it does, how
	 * long it lasts, and every ability, weapon and item that puts it on a unit
	 * or takes it off — each linking to its card. An ailment leads with the
	 * roll the script makes for it.
	 */
	import { KIND_LABELS, ailmentRule, ownerHref, refHref, type Effect, type EffectRef } from '$lib/effects';
	import { mosById } from '$lib/mos';
	import { modKind, sec } from '$lib/skillstats';
	import StatIcon from '$lib/components/StatIcon.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { Page } from 'sveltekit-commons';

	let { data } = $props();

	const e = $derived(data.effect as Effect);

	function initials(name: string): string {
		return (name.match(/[A-Za-z0-9]+/g) ?? [])
			.slice(0, 2)
			.map((w) => w[0].toUpperCase())
			.join('');
	}
	const KIND_WORD: Record<Effect['kind'], string> = {
		ailment: 'ailment',
		debuff: 'debuff',
		buff: 'buff',
		status: 'status'
	};
	const SOURCE_WORD: Record<Effect['appliedBy'][number]['kind'], string> = {
		skill: 'skill tree',
		command: 'standard ability',
		entity: 'ability',
		weapon: 'weapon',
		item: 'item'
	};
	const lasts = $derived(e.dur ? `${sec(e.dur)}${e.durSpread ? ` ± ${sec(e.durSpread)}` : ''}` : null);
	const isClass = (id: string) => mosById.has(id);
	const onHref = (r: EffectRef) => ownerHref(r, isClass);
	const description = $derived(
		[e.tooltip.split('\n')[0], e.effects.length ? e.effects.join(', ') : '', lasts ? `Lasts ${lasts}.` : '']
			.filter(Boolean)
			.join(' ')
			.slice(0, 200)
	);
</script>

{#snippet refRows(refs: EffectRef[], withLevel: boolean)}
	<div class="tablewrap">
		<table class="data refs">
			<thead>
				<tr><th>Ability</th><th>On</th><th>As</th></tr>
			</thead>
			<tbody>
				{#each refs as r, i (i)}
					<tr>
						<td class="cell">
							{#if r.abilityIcon}<img class="ic" src={r.abilityIcon} alt="" loading="lazy" />{:else}<span class="ic ph">{initials(r.abilityName)}</span>{/if}
							{#if refHref(r)}<a href={refHref(r)}>{r.abilityName}</a>{:else}<span>{r.abilityName}</span>{/if}
							{#if withLevel && r.level}<span class="lv">lv {r.level}</span>{/if}
						</td>
						<td class="cell">
							{#if r.ownerIcon}<img class="ic" src={r.ownerIcon} alt="" loading="lazy" />{:else}<span class="ic ph">{initials(r.ownerName)}</span>{/if}
							{#if onHref(r)}<a href={onHref(r)}>{r.ownerName}</a>{:else}<span>{r.ownerName}</span>{/if}
						</td>
						<td class="mono">{SOURCE_WORD[r.kind]}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/snippet}

<Page>
	<Seo title="{e.name} — Effects" {description} />

	<header class="head">
		{#if e.icon}
			<img class="art" src={e.icon} alt="" />
		{:else}
			<span class="art fb">{initials(e.name)}</span>
		{/if}
		<div>
			<div class="kind">{KIND_LABELS[e.kind].label.replace(/es$|s$/, '')}</div>
			{#if e.tooltip}<p class="tip">{e.tooltip}</p>{/if}
		</div>
	</header>

	<div class="duo">
		<section>
			<h2 class="section">What it does</h2>
			{#if e.effects.length}
				<ul class="does">
					{#each e.effects as x, i (i)}
						<li><StatIcon name={modKind(x)[1]} size={15} />{x}</li>
					{/each}
				</ul>
			{:else}
				<p class="note">The behaviour changes no stat in the data: it is a state the script reads, or a marker.</p>
			{/if}
			<dl class="facts">
				<dt>Lasts</dt>
				<dd>{lasts ?? 'until removed'}</dd>
				{#if e.stacks}
					<dt>Stacks</dt>
					<dd>up to {e.stacks}</dd>
				{/if}
				<dt>Kind</dt>
				<dd>{KIND_WORD[e.kind]}</dd>
				{#if e.hidden && e.kind !== 'ailment'}
					<dt>Status bar</dt>
					<dd>not shown</dd>
				{/if}
			</dl>
			{#if e.ailment}
				<h2 class="section">How you catch it</h2>
				<p class="note rule">{ailmentRule(e)}</p>
			{/if}
		</section>

		<section>
			{#if e.appliedBy.length || !e.ailment}
				<h2 class="section">Applied by · {e.appliedBy.length}</h2>
			{/if}
			{#if e.appliedBy.length}
				{@render refRows(e.appliedBy, true)}
			{:else if !e.ailment}
				<p class="note">Nothing on the site applies it by name: the script puts it on, or it is a marker.</p>
			{/if}

			{#if e.curedBy.length}
				<h2 class="section">Cured by · {e.curedBy.length}</h2>
				{@render refRows(e.curedBy, false)}
			{/if}
		</section>
	</div>
</Page>

<style>
	.head {
		display: flex;
		gap: 16px;
		align-items: flex-start;
		margin: 4px 0 8px;
	}
	.art {
		width: 72px;
		height: 72px;
		border-radius: var(--radius-3);
		object-fit: cover;
		flex-shrink: 0;
		background: var(--surface-raised);
		border: 1px solid var(--border);
	}
	.art.fb {
		display: grid;
		place-items: center;
		font-family: var(--font-mono);
		font-size: 18px;
		color: var(--text-faint);
	}
	.kind {
		font-family: var(--font-mono);
		font-size: 10.5px;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--accent);
		margin: 4px 0 6px;
	}
	.tip {
		margin: 0;
		color: var(--text-dim);
		white-space: pre-line;
		max-width: 68ch;
	}
	.duo {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(360px, 100%), 1fr));
		gap: 0 28px;
		align-items: start;
	}
	.duo :global(h2.section) {
		margin-top: var(--section-gap);
	}
	.does {
		list-style: none;
		margin: 0 0 14px;
		padding: 0;
		font-family: var(--font-mono);
		font-size: 13px;
		display: grid;
		gap: 4px;
	}
	.does li {
		display: flex;
		align-items: center;
		gap: 7px;
	}
	.facts {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 4px 16px;
		margin: 0;
		font-size: 13px;
	}
	.facts dt {
		font-family: var(--font-mono);
		font-size: 10.5px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text-faint);
		padding-top: 2px;
	}
	.facts dd {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 12.5px;
	}
	.rule {
		max-width: 60ch;
	}
	.lv {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--text-faint);
		margin-left: 6px;
	}
	/* a small picture before each name: the ability's art, the class's or unit's */
	.refs .cell {
		white-space: nowrap;
	}
	.refs .ic {
		width: 22px;
		height: 22px;
		border-radius: 4px;
		object-fit: cover;
		vertical-align: middle;
		margin-right: 7px;
		background: var(--surface-raised);
	}
	.refs .ic.ph {
		display: inline-grid;
		place-items: center;
		font-family: var(--font-mono);
		font-size: 8px;
		color: var(--text-faint);
	}
	.refs a {
		text-decoration: none;
		font-weight: 550;
	}
	.refs a:hover {
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
</style>
