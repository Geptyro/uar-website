<script lang="ts">
	/**
	 * One effect's page: its art and name, the game's text, what it does, how
	 * long it lasts, and every ability, weapon and item that puts it on a unit
	 * or takes it off, one row per ability with every class and unit that has
	 * it. An ailment's roll, and anything that rolls, kills or spawns when an
	 * effect ticks or runs out, follows as a flow (lib/rolls).
	 */
	import { KIND_LABELS, groupRefs, ownerHref, refHref, type Effect, type EffectRef, type RefGroup } from '$lib/effects';
	import { ailmentChain } from '$lib/rolls';
	import { setRolls } from '$lib/components/rolls/context';
	import RollFlow from '$lib/components/rolls/RollFlow.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { mosById } from '$lib/mos';
	import { modKind, sec } from '$lib/skillstats';
	import StatIcon from '$lib/components/StatIcon.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { Page } from 'sveltekit-commons';
	import { holdData } from '$lib/heldData';

	let { data } = $props();
	// the next route's data can reach this before it unmounts: read the last own one ($lib/heldData)
	const hold = holdData((d: typeof data) => !!d.effect);
	const view = $derived(hold(data));

	const e = $derived(view.effect as Effect);
	setRolls({
		get tips() {
			return view.tips;
		},
		get rules() {
			return view.rules;
		}
	});

	/** The mode the rolls are worked out for; Normal until a reader picks one. */
	let mode = $state(2);
	const chain = $derived(ailmentChain(e, view.rules, view.ailments, mode));
	const outcomes = $derived(e.outcomes ?? []);
	const hasRolls = $derived(!!chain || outcomes.length > 0);

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
	const applied = $derived(groupRefs(e.appliedBy, isClass));
	const cured = $derived(groupRefs(e.curedBy, isClass));

	/** Owners past this many fold behind a "+N" until asked for. */
	const FACES = 12;
	/** Up to this many owners in a row keep their names beside their art. */
	const NAMED = 3;
	let expanded = $state<Record<string, boolean>>({});
	const description = $derived(
		[e.tooltip.split('\n')[0], e.effects.length ? e.effects.join(', ') : '', lasts ? `Lasts ${lasts}.` : '']
			.filter(Boolean)
			.join(' ')
			.slice(0, 200)
	);
</script>

{#snippet owner(r: EffectRef, named: boolean)}
	<Tooltip label={r.ownerName} icon={r.ownerIcon ?? null} href={onHref(r) ?? ''} linkText={isClass(r.owner) ? 'Class page' : 'Unit page'}>
		<span class="face" class:named>
			{#if r.ownerIcon}<img src={r.ownerIcon} alt={named ? '' : r.ownerName} loading="lazy" />{:else}<span class="ph">{initials(r.ownerName)}</span>{/if}
			{#if named}<span class="nm">{r.ownerName}</span>{/if}
		</span>
	</Tooltip>
{/snippet}

{#snippet side(list: EffectRef[], label: string, key: string, named: boolean)}
	{@const open = !!expanded[key]}
	<div class="side">
		<span class="sidelabel">{label} · {list.length}</span>
		<span class="faces">
			{#each open ? list : list.slice(0, FACES) as r (r.owner)}{@render owner(r, named)}{/each}
			{#if list.length > FACES}
				<button type="button" class="more" aria-expanded={open} onclick={() => (expanded[key] = !open)}>
					{open ? 'fewer' : `+${list.length - FACES}`}
				</button>
			{/if}
		</span>
	</div>
{/snippet}

{#snippet refRows(groups: RefGroup[], field: string)}
	<div class="tablewrap">
		<table class="data refs">
			<thead>
				<tr><th>Ability</th><th>On</th></tr>
			</thead>
			<tbody>
				{#each groups as g (g.key)}
					{@const named = g.classes.length + g.units.length <= NAMED}
					<tr>
						<td class="ability">
							<div class="an">
								{#if g.icon}<img class="ic" src={g.icon} alt="" loading="lazy" />{:else}<span class="ic ph">{initials(g.name)}</span>{/if}
								{#if refHref(g.first)}<a href={refHref(g.first)}>{g.name}</a>{:else}<span>{g.name}</span>{/if}
							</div>
							<div class="as">
								{g.kinds.map((k) => SOURCE_WORD[k]).join(' · ')}{#if g.levels.length}<span class="lv">lv {g.levels.join(', ')}</span>{/if}
							</div>
						</td>
						<td class="on">
							{#if named}
								<span class="faces">
									{#each [...g.classes, ...g.units] as r (r.owner)}{@render owner(r, true)}{/each}
								</span>
							{:else}
								{#if g.classes.length}{@render side(g.classes, 'Classes', `${field}:${g.key}:c`, false)}{/if}
								{#if g.units.length}{@render side(g.units, 'Units', `${field}:${g.key}:u`, false)}{/if}
							{/if}
						</td>
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
		</section>

		<section>
			{#if e.appliedBy.length || !e.ailment}
				<h2 class="section">Applied by · {applied.length}</h2>
			{/if}
			{#if e.appliedBy.length}
				{@render refRows(applied, 'applied')}
			{:else if !e.ailment}
				<p class="note">Nothing on the site applies it by name: the script puts it on, or it is a marker.</p>
			{/if}

			{#if e.curedBy.length}
				<h2 class="section">Cured by · {cured.length}</h2>
				{@render refRows(cured, 'cured')}
			{/if}
		</section>
	</div>

	{#if hasRolls}
		<section class="rolls">
			<h2 class="section">{chain ? 'How you catch it' : 'What it rolls'}</h2>
			<RollFlow effect={e} {chain} {outcomes} bind:mode />
		</section>
	{/if}
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
	.rolls {
		margin-top: var(--section-gap);
	}
	.lv {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--text-faint);
		margin-left: 6px;
	}
	.refs td {
		vertical-align: top;
	}
	.refs .ability {
		white-space: nowrap;
	}
	.an {
		display: flex;
		align-items: center;
		gap: 7px;
	}
	/* how it comes, under the name, so the table keeps two columns */
	.as {
		font-family: var(--font-mono);
		font-size: 10.5px;
		color: var(--text-faint);
		margin: 2px 0 0 29px;
	}
	.refs .ic {
		width: 22px;
		height: 22px;
		border-radius: 4px;
		object-fit: cover;
		flex-shrink: 0;
		background: var(--surface-raised);
	}
	.refs .ic.ph,
	.face .ph {
		display: inline-grid;
		place-items: center;
		font-family: var(--font-mono);
		font-size: 8px;
		color: var(--text-faint);
		background: var(--surface-raised);
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
	.refs .on {
		min-width: 200px;
	}
	.side + .side {
		margin-top: 6px;
	}
	.sidelabel {
		display: block;
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-faint);
		margin-bottom: 3px;
	}
	/* the classes and units that have it, as their art: the name is in the card */
	.faces {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 3px;
		max-width: 340px;
	}
	.face {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.face img,
	.face .ph {
		width: 24px;
		height: 24px;
		border-radius: 4px;
		object-fit: cover;
		border: 1px solid var(--border);
	}
	.face:hover img {
		border-color: var(--accent);
	}
	.face.named {
		margin-right: 10px;
	}
	.face .nm {
		font-weight: 550;
		white-space: nowrap;
	}
	.face.named:hover .nm {
		color: var(--accent);
	}
	.more {
		height: 24px;
		padding: 0 8px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: none;
		color: var(--text-dim);
		font-family: var(--font-mono);
		font-size: 11px;
		cursor: pointer;
	}
	.more:hover {
		border-color: var(--border-strong);
		color: var(--text);
	}
</style>
