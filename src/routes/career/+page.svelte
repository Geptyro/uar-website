<script lang="ts">
	import { rankTracks, rankBonusAt, mosById, mosHref, mosName, mosPageId, type RankTrack } from '$lib/mos';
	import Seo from '$lib/components/Seo.svelte';
	import StatIcon from '$lib/components/StatIcon.svelte';
	import { Page } from 'sveltekit-commons';

	const trackNotes: Record<number, string> = {
		1: 'The starting track — 13 ranks from Private to Sergeant Major of the Army.',
		2: 'Technical specialist track, unlocked separately from Enlisted.',
		3: 'Officer track — leadership classes and officer equipment unlock here.'
	};

	const trim = (s: string) => s.replace(/\.?0+$/, '');
	const pct = (v: number) => `${trim((v * 100).toFixed(1))}%`;
	const speed = (v: number) => trim(v.toFixed(3));
	const plus = (s: string) => (s.startsWith('-') ? s.replace('-', '−') : `+${s}`);

	/** Stacks a hero of this track carries the moment they reach their first rank. */
	function startingStacks(track: RankTrack) {
		return rankBonusAt(track, track.ranks[0].idx)?.stacks ?? 0;
	}
</script>

<Page>
	<Seo
		title="Rank sets"
		description="The three rank tracks of Undead Assault Reborn — Enlisted, Warrant Officer, Commissioned Officer — with every rank, its XP threshold and its insignia."
	/>

	<p class="note">
		Account XP is tracked separately in three rank sets. Ranks gate class unlocks, equipment and
		Skill Identifiers; the insignia is shown as a decal on your hero. Thresholds below are the
		minimum XP in that track.
	</p>

	<div class="tracks">
		{#each rankTracks as track (track.track)}
			<section class="track">
				<h2 class="section">{track.name}</h2>
				{#if trackNotes[track.track]}<p class="note">{trackNotes[track.track]}</p>{/if}
				{#if track.bonus}
					<div class="bonus">
						<b class="bonus-head">Hidden buff, one stack per rank</b>
						<ul class="bonus-list">
							<li><StatIcon name="speed" size={14} /><b>{plus(speed(track.bonus.speed))}</b> move speed</li>
							<li>
								<StatIcon name="damage" size={14} /><b>{plus(pct(track.bonus.rangedDamage))}</b> ranged
								damage
							</li>
							<li><StatIcon name="life" size={14} /><b>{plus(String(track.bonus.life))}</b> max life</li>
						</ul>
						<p class="bonus-foot">
							{#if startingStacks(track) > 0}
								This track spawns already holding <b>{startingStacks(track)} stacks</b> at its first
								rank.
							{:else}
								A fresh {track.ranks[0].prefix} holds none — the first stack lands on promotion.
							{/if}
						</p>
					</div>
				{/if}
				<div class="tablewrap">
					<table class="data">
						<thead>
							<tr>
								<th></th>
								<th>Grade</th>
								<th>Rank</th>
								<th class="num">XP min</th>
								{#if track.bonus}<th title="Total rank buff carried at this rank">Rank buff</th>{/if}
							</tr>
						</thead>
						<tbody>
							{#each track.ranks as r (r.idx)}
								<tr class:has-reward={r.rewards?.length}>
									<td class="icon-cell">
										{#if r.icon}<img class="insignia" src={r.icon} alt="" loading="lazy" />{/if}
									</td>
									<td class="mono grade">{r.prefix}</td>
									<td>{r.name}</td>
									<td class="num">{r.xp?.toLocaleString('en') ?? ''}</td>
									{#if track.bonus}
										{@const b = rankBonusAt(track, r.idx)}
										<td class="buff">
											{#if !b || b.stacks === 0}
												<span class="buff-none">—</span>
											{:else}
												<span class="buff-line" title="Move speed">
													<StatIcon name="speed" size={13} />{plus(speed(b.speed))}
												</span>
												<span class="buff-line" title="Ranged damage dealt">
													<StatIcon name="damage" size={13} />{plus(pct(b.rangedDamage))}
												</span>
												<span class="buff-line" title="Max life">
													<StatIcon name="life" size={13} />{plus(String(b.life))}
												</span>
											{/if}
										</td>
									{/if}
								</tr>
								{#if r.rewards?.length}
									<tr class="reward-row">
										<td></td>
										<td colspan={track.bonus ? 4 : 3}>
											{#each r.rewards as rw (rw.mos + rw.id)}
												{@const page = mosPageId(rw.mos)}
												{@const mosIcon = mosById.get(rw.mos)?.icon ?? null}
												<span class="reward" title={rw.tooltip}>
													<span class="reward-icons">
														{#if rw.icon}
															<img class="reward-icon" src={rw.icon} alt="" loading="lazy" />
														{/if}
														{#if mosIcon}
															<img class="reward-icon" src={mosIcon} alt="" loading="lazy" />
														{/if}
													</span>
													<span class="reward-text">
														<b>{rw.name}</b>
														{#if rw.kind === 'unit'}<i class="reward-kind">free at spawn</i>{/if}
														<span class="reward-mos">
															{#if page}<a href={mosHref(page)}>{mosName(rw.mos)}</a>{:else}{mosName(
																	rw.mos
																)}{/if}
														</span>
													</span>
												</span>
											{/each}
										</td>
									</tr>
								{/if}
							{/each}
						</tbody>
					</table>
				</div>
			</section>
		{/each}
	</div>
</Page>

<style>
	.tracks {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
		gap: 0 24px;
		align-items: start;
	}
	.track :global(h2.section) {
		margin-top: 10px;
	}
	.icon-cell {
		width: 34px;
		padding-right: 0;
	}
	.insignia {
		width: 26px;
		height: 26px;
		object-fit: contain;
		vertical-align: middle;
	}
	.grade {
		font-weight: 650;
		white-space: nowrap;
	}
	.bonus {
		border: 1px solid var(--line);
		border-left: 3px solid var(--mos);
		padding: 10px 12px;
		margin: 0 0 14px;
	}
	.bonus-head {
		display: block;
		font-size: 13px;
	}
	.bonus-list {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
		list-style: none;
		margin: 6px 0 0;
		padding: 0;
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.bonus-list li {
		display: flex;
		align-items: center;
		gap: 5px;
	}
	.bonus-foot {
		margin: 8px 0 0;
		font-size: 12px;
		color: var(--ink-2);
	}
	.buff {
		white-space: nowrap;
		font-family: var(--font-mono);
		font-size: 11px;
		font-variant-numeric: tabular-nums;
		line-height: 1.35;
	}
	.buff-line {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.buff-none {
		color: var(--ink-2);
	}
	tr.has-reward > td {
		border-bottom: 0;
	}
	.reward-row > td {
		padding-top: 0;
	}
	.reward {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		margin: 2px 14px 2px 0;
		vertical-align: top;
	}
	/* what you get, then who gets it — same weight, so the pair reads as one unit */
	.reward-icons {
		display: inline-flex;
		gap: 4px;
		flex: none;
	}
	.reward-icon {
		width: 26px;
		height: 26px;
		object-fit: contain;
		flex: none;
	}
	.reward-text {
		display: flex;
		flex-direction: column;
		line-height: 1.25;
		font-size: 12px;
	}
	.reward-kind {
		color: var(--ink-2);
		font-style: normal;
	}
	.reward-mos {
		color: var(--ink-2);
	}
</style>
