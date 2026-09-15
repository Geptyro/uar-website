<script lang="ts">
	/**
	 * How an effect is caught, as a flow: nodes joined by arrows, the chance of
	 * getting from one to the next written on the arrow. The first node holds the
	 * checks a hit must pass, a line each under who it is about (GateList). What
	 * the effect does when it runs out follows as more nodes. The chain reads
	 * left to right on a wide screen and turns downward on a phone.
	 *
	 * Every arrow and every per-hit figure has a card saying how its number is
	 * made, so the maths is one hover away and never in the way.
	 */
	import RollGlyph from './RollGlyph.svelte';
	import RefChip from './RefChip.svelte';
	import GateList from './GateList.svelte';
	import ModePick from './ModePick.svelte';
	import OutcomeText from './OutcomeText.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { modeName } from '$lib/players';
	import type { Effect } from '$lib/effects';
	import { every, list, pct, whenLabel, whenNote, type AilmentChain, type EffectOutcome } from '$lib/rolls';

	let {
		effect,
		chain,
		outcomes,
		mode = $bindable(2)
	}: { effect: Effect; chain: AilmentChain | null; outcomes: EffectOutcome[]; mode?: number } = $props();

	const target = $derived(chain?.order?.target);
	const position = $derived(chain?.order && target ? chain.order.rows.indexOf(target) + 1 : 0);
	const modeWord = $derived(modeName(mode));
	const otherVenoms = $derived(
		list((chain?.pick?.among ?? []).filter((r) => !r.self).map((r) => r.effect.name), 'or')
	);

	const orderText = $derived.by(() => {
		if (!chain?.order || !target) return '';
		const lead = 'The script rolls the ailments in order and applies the first one that lands.';
		if (position === 1) return `${lead} ${effect.name} is the first roll, so only its own 1 in ${target.n} counts: ${pct(chain.afterGlobal)}.`;
		return `${lead} ${effect.name} is reached when the ${position - 1} rolls before it all miss (${pct(target.reach)}), then its own 1 in ${target.n} has to land: ${pct(chain.afterGlobal)}.`;
	});
	function outcomeArrowText(o: EffectOutcome): string {
		const roll = o.chance < 1 ? `A ${pct(o.chance)} roll.` : '';
		return [o.when === 'tick' && o.period ? `Every ${o.period} s.` : '', roll, whenNote(o) ?? ''].filter(Boolean).join(' ');
	}
</script>

{#snippet arrow(top: string, bottom: string, label: string, text: string)}
	<Tooltip {label} {text} maxWidth={320}>
		<div class="arrow">
			<span class="t">{top}</span>
			<svg viewBox="0 0 60 12" preserveAspectRatio="none" aria-hidden="true"><path d="M0 6H54M48 1L55 6L48 11" /></svg>
			{#if bottom}<span class="b">{bottom}</span>{/if}
		</div>
	</Tooltip>
{/snippet}

{#snippet perHit(p: number, label: string, text: string)}
	<Tooltip {label} {text} maxWidth={300}>
		<span class="per">
			<span>{pct(p)} <small>per qualifying hit</small></span>
			<small class="every">{every(p)} hits</small>
		</span>
	</Tooltip>
{/snippet}

{#if chain}
	<div class="bar"><ModePick bind:mode /></div>
{/if}

<div class="flowwrap">
	<div class="flow">
		{#if chain}
			<div class="node wide">
				<div class="nh"><RollGlyph name="hit" size={15} /> A qualifying hit<span class="sub">every line must hold</span></div>
				<GateList gates={chain.gates} />
				{#if chain.pick}
					<!-- who the hit comes from decides the venom route, so it is part of the hit -->
					<div class="subhead">and from one of these</div>
					<GateList gates={chain.pick.any} grouped={false} />
				{/if}
			</div>
			{#if chain.global}
				{@render arrow(
					`1 in ${chain.global}`,
					pct(1 / chain.global),
					`Ailment roll, 1 in ${chain.global}`,
					`On ${modeWord}, a qualifying hit rolls 1 in ${chain.global} for an ailment. ${pct(1 / chain.global)} of them go on.`
				)}
				<div class="node">
					<div class="nh"><RollGlyph name="dice" size={15} /> Ailment roll</div>
				</div>
			{/if}
			{#if chain.route === 'pick' && chain.pick}
				{@render arrow(
					`1 of ${chain.pick.among.length}`,
					pct(chain.afterGlobal),
					`Venom pick, 1 of ${chain.pick.among.length}`,
					`Once the ailment roll passed, the script picks one of the ${chain.pick.among.length} venoms at random: ${pct(chain.afterGlobal)} each. The other one is ${otherVenoms}.`
				)}
			{:else if chain.order && target}
				{@render arrow(`roll ${position} of ${chain.order.rows.length}`, pct(chain.afterGlobal), `Roll ${position} of ${chain.order.rows.length}`, orderText)}
			{/if}
			<div class="node hit" class:wide={!!target?.need.length}>
				<div class="nh"><RefChip ref={effect} to="effect" />{#if target?.need.length}<span class="sub">only when</span>{/if}</div>
				{#if target?.need.length}<GateList gates={target.need} />{/if}
				{@render perHit(
					chain.perHit,
					`${pct(chain.perHit)} per qualifying hit`,
					`On ${modeWord}, ${every(chain.perHit)} qualifying hits gives ${effect.name}. A qualifying hit is one that passes every check before it.`
				)}
			</div>
		{/if}
		{#each outcomes as o, i (i)}
			{@render arrow(whenLabel(o).toLowerCase(), o.chance < 1 ? pct(o.chance) : '', whenLabel(o), outcomeArrowText(o))}
			<div class="node" class:dead={o.kills}>
				<OutcomeText outcome={o} />
				{#if chain && o.chance < 1}
					{@render perHit(
						chain.perHit * o.chance,
						`${pct(chain.perHit * o.chance)} per qualifying hit`,
						`${pct(o.chance)} of the ${pct(chain.perHit)}: on ${modeWord}, ${every(chain.perHit * o.chance)} qualifying hits ends this way, if it is never treated.`
					)}
				{/if}
			</div>
		{/each}
	</div>
</div>
{#each outcomes as o, i (i)}
	{#if whenNote(o)}<p class="foot">{whenNote(o)}</p>{/if}
{/each}

<style>
	.bar {
		margin: 0 0 12px;
	}
	.flowwrap {
		overflow-x: auto;
		padding-bottom: 4px;
	}
	.flow {
		display: flex;
		align-items: center;
		gap: 0;
		width: max-content;
		min-width: 100%;
	}
	.node {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: var(--radius-3);
		background: var(--surface-raised);
		box-shadow: var(--shadow-1);
		max-width: 260px;
	}
	.node.wide {
		max-width: 400px;
	}
	.subhead {
		font-size: 11px;
		color: var(--text-faint);
		padding-top: 6px;
		border-top: 1px dashed var(--border);
	}
	.sub {
		font-size: 11px;
		font-weight: 400;
		color: var(--text-faint);
		margin-left: 4px;
	}
	.node.hit {
		border-color: var(--accent);
		box-shadow: var(--shadow-1), 0 0 0 3px var(--accent-soft);
	}
	.node.dead {
		border-color: var(--hostile);
		box-shadow: var(--shadow-1), 0 0 0 3px var(--hostile-soft);
	}
	.nh {
		display: flex;
		align-items: center;
		gap: 6px;
		font-weight: 600;
		font-size: 13px;
		white-space: nowrap;
	}
	.per {
		cursor: help;
		display: flex;
		flex-direction: column;
		gap: 1px;
		font-family: var(--font-mono);
		font-size: 16px;
		font-weight: 650;
		color: var(--text);
	}
	.per .every {
		font-size: 11px;
		color: var(--text-dim);
	}
	.per small {
		font-size: 10.5px;
		font-weight: 400;
		color: var(--text-faint);
	}
	.arrow {
		cursor: help;
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 92px;
		padding: 0 4px;
		font-family: var(--font-mono);
		font-size: 11.5px;
		color: var(--text-dim);
	}
	.arrow svg {
		width: 100%;
		height: 12px;
		overflow: visible;
	}
	.arrow path {
		fill: none;
		stroke: var(--border-strong);
		stroke-width: 2;
		vector-effect: non-scaling-stroke;
	}
	.arrow .t {
		white-space: nowrap;
	}
	.arrow .b {
		color: var(--gold);
		font-weight: 600;
	}
	.foot {
		font-size: 12px;
		color: var(--text-faint);
		margin: 8px 0 0;
	}
	/* a phone: the chain turns downward, arrows pointing down */
	@media (max-width: 640px) {
		.flow {
			flex-direction: column;
			align-items: stretch;
			width: auto;
		}
		.node {
			max-width: none;
		}
		.arrow {
			flex-direction: row;
			justify-content: center;
			gap: 8px;
			min-width: 0;
			padding: 4px 0;
		}
		.arrow svg {
			width: 12px;
			height: 26px;
			transform: rotate(90deg);
		}
	}
</style>
