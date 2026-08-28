<script lang="ts">
	/**
	 * The structured head of a guide: which modes it is for and the order the
	 * skill points go in. Both come from pickers over the class's own data, so
	 * they are drawn from it too, icons included, and a guide whose author
	 * filled neither in shows nothing here rather than two empty boxes.
	 *
	 * The order is a grid, one row per skill and one column per level, the
	 * way build sites have always drawn it: a reader finds "what do I take at
	 * 7" by running a finger down a column, and sees a skill's whole ladder
	 * along its row. The mark is the rank that point reaches.
	 */
	import { skillIdentifiers, siXpLabel, type Mos } from '$lib/mos';
	import type { SiPick } from '$lib/builds';
	import { modeNames } from '$lib/players';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import RankMark from '$lib/components/RankMark.svelte';
	import type { RankKey } from '$lib/ranks';
	import { levelOfPoint, skillCounts } from '$lib/builds';
	import { rules } from '$lib/mechanics';
	import ModeMark from '$lib/components/ModeMark.svelte';

	let {
		mos,
		modes,
		ranks = [],
		skills,
		sis = []
	}: { mos: Mos; modes: string[]; ranks?: RankKey[]; skills: string[]; sis?: SiPick[] } = $props();

	const siByNum = new Map(skillIdentifiers.map((s) => [s.num, s]));
	const taken = $derived(
		sis
			.map((p) => {
				const si = siByNum.get(p.num);
				return si ? { si, choice: si.choices?.find((c) => c.key === p.choice) ?? null } : null;
			})
			.filter((t) => t !== null)
	);

	const skillById = $derived(new Map(mos.skills.map((s) => [s.id, s])));
	const order = $derived(skills.map((id) => skillById.get(id)).filter((s) => s !== undefined));
	const levels = Array.from({ length: rules.levels.max }, (_, i) => i + 1);
	/** level → the points spent at it, each with the rank it brings its skill to */
	const atLevel = $derived.by(() => {
		const map = new Map<number, { id: string; rank: number }[]>();
		const ranks = new Map<string, number>();
		skills.forEach((id, i) => {
			const lv = levelOfPoint(i, rules.levels.pointsPerLevel);
			const rank = (ranks.get(id) ?? 0) + 1;
			ranks.set(id, rank);
			map.set(lv, [...(map.get(lv) ?? []), { id, rank }]);
		});
		return map;
	});
	const totals = $derived(
		skillCounts(skills)
			.map((c) => ({ ...c, skill: skillById.get(c.id) }))
			.filter((c) => c.skill)
	);
	const any = $derived(modes.length > 0 || ranks.length > 0 || order.length > 0 || taken.length > 0);
</script>

{#if any}
	<div class="head card">
		{#if modes.length}
			<div class="row">
				<span class="k">Modes</span>
				<span class="v tags">
					<!-- the same glyph and colour a game's mode gets everywhere else;
					     modes are stored by name, ModeMark wants the 1..12 number -->
					{#each modes as m (m)}<ModeMark mode={modeNames.indexOf(m) + 1} />{/each}
				</span>
			</div>
		{/if}
		{#if ranks.length}
			<div class="row">
				<span class="k">Rank</span>
				<span class="v tags">
					{#each ranks as r (r)}<RankMark rank={r} />{/each}
				</span>
			</div>
		{/if}
		{#if taken.length}
			<div class="row">
				<span class="k">Skill IDs</span>
				<span class="v tags">
					{#each taken as { si, choice } (si.num)}
						<Tooltip label={si.name} text={si.desc} icon={si.icon} href="/career/si#si-{si.num}" linkText="Skill IDs" focusable={false}>
							<span class="si">
								{#if si.icon}<img src={si.icon} alt="" loading="lazy" />{/if}
								{si.name}{#if choice}: {choice.name}{/if}
								<b>{si.code}</b>
								{#if siXpLabel(si)}<small>{siXpLabel(si)}</small>{/if}
							</span>
						</Tooltip>
					{/each}
				</span>
			</div>
		{/if}
		{#if order.length}
			<div class="row">
				<span class="k">Skill order</span>
				<span class="v">
					<div class="tablewrap grid">
						<table class="data skills">
							<thead>
								<tr>
									<th class="sk">Skill</th>
									{#each levels as lv (lv)}
										<th class="lv" class:used={atLevel.has(lv)}>{lv}</th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each mos.skills as s (s.id)}
									<tr>
										<td class="sk">
											{#if s.icon}<img src={s.icon} alt="" loading="lazy" />{:else}<span class="ph"
												></span>{/if}
											<span>{s.name}</span>
										</td>
										{#each levels as lv (lv)}
											{@const hit = atLevel.get(lv)?.find((x) => x.id === s.id)}
											<td class="c" class:on={hit} title={hit ? `Level ${lv}: ${s.name} ${hit.rank}` : null}
												>{hit ? hit.rank : ''}</td
											>
										{/each}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					<span class="totals">
						{#each totals as t, i (t.id)}{#if i}{', '}{/if}{t.skill?.name}
							<b>×{t.points}</b>{/each}
						<span class="lv">· the mark is the rank the point brings the skill to</span>
					</span>
				</span>
			</div>
		{/if}
	</div>
{/if}

<style>
	.head {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin: 0 0 22px;
	}
	.row {
		display: grid;
		grid-template-columns: 92px minmax(0, 1fr);
		gap: 12px;
		align-items: start;
	}
	@media (max-width: 520px) {
		.row {
			grid-template-columns: 1fr;
			gap: 4px;
		}
	}
	.k {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-faint);
		padding-top: 4px;
	}
	.v {
		min-width: 0;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: center;
		font-size: 12.5px;
	}
	.si {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 2px 9px 2px 3px;
		border-radius: 99px;
		background: var(--accent-soft);
		color: var(--accent);
		font-size: 12px;
		font-weight: 550;
	}
	.si img {
		width: 20px;
		height: 20px;
		object-fit: cover;
		border-radius: 5px;
	}
	.si b {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 600;
		opacity: 0.8;
	}
	.si small {
		font-family: var(--font-mono);
		font-size: 9.5px;
		color: var(--text-faint);
	}
	/* the frame hugs the grid: as wide as its columns, no wider than the row */
	.grid {
		width: fit-content;
		max-width: 100%;
		box-shadow: none;
	}
	.skills {
		width: auto;
		font-size: 12px;
	}
	.skills th {
		position: static;
		padding: 6px 4px;
	}
	.skills th.lv {
		text-align: center;
		min-width: 24px;
		font-size: 9.5px;
	}
	.skills th.lv.used {
		color: var(--text-dim);
	}
	.skills td {
		padding: 3px 4px;
		vertical-align: middle;
	}
	.skills td.sk,
	.skills th.sk {
		padding-left: 10px;
		padding-right: 12px;
		white-space: nowrap;
	}
	.skills td.sk {
		display: flex;
		align-items: center;
		gap: 7px;
		font-weight: 550;
	}
	.skills img,
	.skills .ph {
		width: 22px;
		height: 22px;
		object-fit: cover;
		border-radius: 5px;
		display: block;
		background: var(--surface-raised);
	}
	.skills td.c {
		width: 24px;
		height: 24px;
		text-align: center;
		font-family: var(--font-mono);
		font-size: 10.5px;
		color: transparent;
		border-left: 1px solid var(--border);
	}
	.skills td.c.on {
		background: var(--accent-soft);
		color: var(--accent);
		font-weight: 650;
	}
	.skills tbody tr:hover {
		background: none;
	}
	.totals {
		display: block;
		margin-top: 6px;
		font-size: 12px;
		color: var(--text-dim);
	}
	.totals b {
		font-weight: 650;
		color: var(--text);
	}
	.totals .lv {
		color: var(--text-faint);
		font-size: 11px;
	}
</style>
