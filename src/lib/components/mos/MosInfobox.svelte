<script lang="ts">
	/**
	 * The rail beside a class — or a vehicle — on its overview: the identity
	 * card, then everything about it that is a fact rather than a table. What
	 * it does not have, it does not show: a vehicle has no skill trees, no rank
	 * gate and no Skill Identifiers, and its rail is simply shorter.
	 *
	 * The vehicle ladder (Predator chassis, walker floodlights…) is the one
	 * block that moves: it belongs to the vehicle, so a pilot's rail leaves it
	 * to the vehicle tab, while a vehicle that is its own class keeps it here.
	 */
	import {
		mosById,
		rankTracks,
		rankRewardsFor,
		type Mos,
		type Si,
		type UnlockReq
	} from '$lib/mos';
	import { gearGroups as accountGear } from '$lib/players';
	import FactsCard, { type Fact } from '$lib/components/FactsCard.svelte';
	import ModelCard from '$lib/components/ModelCard.svelte';
	import DescCard from '$lib/components/DescCard.svelte';
	import MechanicsGrid from '$lib/components/MechanicsGrid.svelte';
	import ClassPanel from '$lib/components/ClassPanel.svelte';
	import AbilityTiles from '$lib/components/AbilityTiles.svelte';
	import { mechanicsFor } from '$lib/mechanics';
	import { mosTabHref, vehicleSlug } from '$lib/mosTabs';
	import { modelVariants } from '$lib/models';

	let {
		mos,
		si,
		usableCount,
		abilities = true,
		handling = true
	}: {
		mos: Mos;
		si: Si[];
		/** How many items the class can use — the number on the card. */
		usableCount: number;
		/** Draw the standard abilities here. Off when the main column has them. */
		abilities?: boolean;
		/** Draw the handling cards here. Off when the main column has them. */
		handling?: boolean;
	} = $props();

	const modelUrl = $derived(modelVariants(mos.id)[0]?.src ?? null);
	const mechanics = $derived(mechanicsFor(mos.id));

	const facts = $derived([
		...(mos.role ? [{ icon: 'role', label: 'Role', value: mos.role } as Fact] : []),
		{ icon: 'type', label: 'Type', value: mos.unitType } as Fact,
		...(
			[
				['life', 'Life', mos.life],
				['armor', 'Armor', mos.armor],
				['speed', 'Speed', mos.speed],
				['energy', 'Energy', mos.energy]
			] as const
		)
			.filter(([, , v]) => v !== null)
			.map(([icon, label, value]) => ({ icon, label, value: value ?? '' }) as Fact),
		...(mos.inventory.slots
			? [{ icon: 'bag', label: 'Bag slots', value: mos.inventory.slots } as Fact]
			: []),
		...(mos.skills.length
			? [{ icon: 'trees', label: 'Skill trees', value: mos.skills.length } as Fact]
			: []),
		{ icon: 'items', label: 'Usable items', value: usableCount } as Fact
	]);

	// the other half of a pilot/vehicle pair, so each page can point at the other:
	// a pilot at its vehicle tab, a vehicle back at the class that brings it
	const counterpart = $derived.by(() => {
		const id = mos.vehicle ?? mos.pilotedBy;
		const other = id ? mosById.get(id) : null;
		if (!other) return null;
		return mos.vehicle
			? { mos: other, role: 'vehicle' as const, href: mosTabHref(mos.id, vehicleSlug(other.name)) }
			: { mos: other, role: 'pilot' as const, href: mosTabHref(other.id) };
	});

	// account-progression gear (vehicle upgrades / medical visor) owned by this class,
	// shown in pilot-rank order rather than bank-flag order. A piloted vehicle shares its
	// pilot's ladder — the gear is bolted onto the vehicle, but earned by playing the class —
	// and the ladder is shown on the vehicle, not beside the pilot.
	const progressionGear = $derived.by(() => {
		if (mos.vehicle) return null;
		const owner = mos.pilotedBy ?? mos.id;
		const g = accountGear.find((g) => g.mosId === owner);
		return g ? { ...g, items: [...g.items].sort((a, b) => a.rank - b.rank) } : null;
	});

	const unlock = $derived(mos.unlock ?? null);
	// Robot: one threshold across all three tracks instead of per-track ranks
	const everyTrackXp = $derived(unlock?.en?.everyTrack ? unlock.en.xp : null);

	function fmtXpShort(xp: number): string {
		return xp >= 1000
			? `${(xp / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}k`
			: String(xp);
	}

	function unlockTitle(req: UnlockReq | null, rank: { name: string } | null): string {
		if (!req) return 'Cannot be picked on this rank track';
		if (req.xp === 0) return 'Available from the start';
		const xp = `${(req.xp ?? 0).toLocaleString('en-US')} XP`;
		return rank ? `${rank.name} · ${xp}` : xp;
	}

	// what each track eventually hands this class — earned at its own rank, which is
	// almost never the rank that unlocked the class
	const trackRewards = $derived(rankRewardsFor(mos.id));

	const unlockCells = $derived(
		unlock
			? rankTracks.map((t, i) => {
					const req = unlock[(['en', 'wo', 'co'] as const)[t.track - 1]];
					const rank = req?.rank ? (t.ranks.find((r) => r.prefix === req.rank) ?? null) : null;
					return {
						short: ['Enlisted', 'Warrant', 'Commissioned'][i],
						wf: t.icon,
						off: !req,
						rankIcon: rank?.icon ?? null,
						main: !req
							? '—'
							: req.xp === 0
								? 'Start'
								: (req.rank ?? `${fmtXpShort(req.xp ?? 0)} XP`),
						sub: req && req.xp && req.rank ? `${fmtXpShort(req.xp)} XP` : null,
						title: unlockTitle(req, rank),
						rewards: trackRewards.filter((r) => r.track === t.track)
					};
				})
			: []
	);
</script>

<aside class="infobox">
	<FactsCard
		portrait={mos.icon}
		title={mos.name}
		chip={mos.mos ? `MOS ${mos.mos}` : null}
		{facts}
		link={{ href: `/entities/${mos.id}`, label: 'Unit data →' }}
	/>
	{#if counterpart}
		<DescCard label={counterpart.role === 'vehicle' ? counterpart.mos.name : 'Pilot'}>
			<a class="pair" href={counterpart.href}>
				{#if counterpart.mos.icon}
					<img class="pair-icon" src={counterpart.mos.icon} alt="" loading="lazy" />
				{/if}
				<span class="pair-text">
					<b>{counterpart.mos.name}</b>
					<span class="pair-sub">
						{counterpart.role === 'vehicle'
							? `Brought along by the ${mos.name} — its own stats, weapons and gear, on its own tab.`
							: `Piloted by the ${counterpart.mos.name}, who enters and leaves it in play.`}
					</span>
				</span>
			</a>
		</DescCard>
	{/if}
	{#if abilities && mos.common.length}
		<DescCard label="Standard abilities · {mos.common.length}">
			<AbilityTiles abilities={mos.common} dense placement="left" />
			<p class="unlock-note">
				Commands this class has by default. Hover — or focus — an icon for what it does.
			</p>
		</DescCard>
	{/if}
	{#if unlock}
		<DescCard label="Rank tracks">
			<div class="unlock-grid">
				{#each unlockCells as c (c.short)}
					<div class="unlock-cell" class:off={c.off} title={c.title}>
						{#if c.wf}
							<span class="unlock-wf" style="--wf: url('{c.wf}')"></span>
						{/if}
						<span class="unlock-tracklabel">{c.short}</span>
						<span class="unlock-rankslot">
							{#if c.rankIcon}
								<img class="unlock-rank" src={c.rankIcon} alt="" loading="lazy" />
							{/if}
						</span>
						<b class="unlock-main">{c.main}</b>
						<span class="unlock-sub">{c.sub ?? ' '}</span>
						{#each c.rewards as rw (rw.id)}
							<span class="unlock-reward" title={rw.tooltip || rw.name}>
								{#if rw.icon}
									<img class="unlock-reward-icon" src={rw.icon} alt="" loading="lazy" />
								{/if}
								<b class="unlock-reward-name">{rw.name}</b>
								<span class="unlock-reward-at">
									{rw.kind === 'unit' ? 'free at' : 'at'}
									{rw.rankPrefix}
								</span>
							</span>
						{/each}
					</div>
				{/each}
			</div>
			{#if everyTrackXp}
				<p class="unlock-note">Needs the XP on all three rank tracks at once.</p>
			{/if}
			{#if unlock.medals}
				<p class="unlock-alt">…and earn <a href="/career/medals">{unlock.medals} medals</a></p>
			{/if}
			{#if unlock.modes}
				<p class="unlock-note">Only in {unlock.modes.join(', ')}</p>
			{/if}
			<p class="unlock-note">
				Max picks per game: {unlock.charges}. Any prestige unlocks all rank requirements.
			</p>
			<a class="si-all" href="/career">All ranks and track bonuses →</a>
		</DescCard>
	{/if}
	{#if progressionGear}
		<DescCard label="{progressionGear.label} · {progressionGear.items.length} unlocks">
			{#each progressionGear.items as item, i (item.name)}
				<div class="pg-item">
					<div class="pg-head">
						{#if progressionGear.ordered}<span class="pg-rank">{i + 1}</span>{/if}
						<b class="pg-name">{item.name}</b>
					</div>
					{#if item.desc}<p class="pg-desc">{item.desc}</p>{/if}
					{#if item.req}
						<p class="pg-req"><span class="pg-req-k">unlock</span>{item.req}</p>
					{/if}
				</div>
			{/each}
			{#if progressionGear.ordered}
				<p class="unlock-note">
					Earned in order — each piece needs the previous ones plus its own challenge.
				</p>
			{/if}
			<p class="unlock-note">
				Account unlocks earned by playing — each <a href="/players">player profile</a> shows which
				ones they own.
			</p>
		</DescCard>
	{/if}
	{#if modelUrl}
		<ModelCard src={modelUrl} alt="3D model of {mos.name}" />
	{/if}
	{#if mos.tooltip}
		<DescCard label="In-game description" text={mos.tooltip} />
	{/if}
	{#if si.length}
		<DescCard label="Skill Identifiers">
			{#each si as s (s.num)}
				<div class="si-row">
					{#if s.icon}
						<img class="si-icon" src={s.icon} alt="" loading="lazy" />
					{:else}
						<span class="si-code">{s.code}</span>
					{/if}
					<b>{s.name}</b>
				</div>
				{#if s.desc}<p class="si-desc">{s.desc}</p>{/if}
			{/each}
			<a class="si-all" href="/career/si">All Skill Identifiers →</a>
		</DescCard>
	{/if}
	<!-- Handling reads as a rail block: its cards already carry their own
	     frame and label, so the group only needs a heading over them. One
	     element, because below 1080px every child of the rail becomes a
	     cell of its own grid. -->
	{#if handling && mechanics?.panel.length}
		<section class="handling">
			<h2 class="section">Class panel · {mechanics.panel.length} buttons</h2>
			<p class="note">Extra actions on the class's mini-panel, with the hotkey that triggers each one.</p>
			<ClassPanel keys={mechanics.panel} />
		</section>
	{/if}
	{#if handling && mechanics}
		<section class="handling">
			<h2 class="section">Handling</h2>
			<p class="note">
				Ammunition, jamming and shared-class behaviour, read from the map's trigger script rather
				than the unit data.
			</p>
			<MechanicsGrid mosId={mos.id} />
		</section>
	{/if}
</aside>

<style>
	.infobox {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	/* In the rail the gap between blocks is the spacing, so the heading does
	   not also carry the 34px a main-column section would, and the note reads
	   at the size the rail's other notes do. */
	.handling {
		min-width: 0;
	}
	.handling h2 {
		margin-top: 6px;
	}
	.handling .note {
		font-size: 11.5px;
		line-height: 1.5;
		color: var(--text-faint);
		margin-bottom: 10px;
	}
	.unlock-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 6px;
		margin-top: 4px;
	}
	.unlock-cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		padding: 8px 2px 6px;
		border: 1px solid var(--border);
		border-radius: var(--radius-2);
		text-align: center;
		min-width: 0;
	}
	.unlock-cell.off {
		opacity: 0.35;
		border-style: dashed;
	}
	.unlock-wf {
		width: 30px;
		height: 30px;
		background: var(--text-dim);
		-webkit-mask: var(--wf) center / contain no-repeat;
		mask: var(--wf) center / contain no-repeat;
	}
	.unlock-tracklabel {
		font-family: var(--font-mono);
		font-size: 8.5px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-faint);
		white-space: nowrap;
	}
	.unlock-rankslot {
		height: 22px;
		display: flex;
		align-items: center;
	}
	.unlock-rank {
		width: 22px;
		height: 22px;
		object-fit: contain;
	}
	.unlock-main {
		font-size: 12.5px;
		font-weight: 600;
		line-height: 1.2;
	}
	.unlock-sub {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--text-dim);
		min-height: 12px;
		white-space: pre;
	}
	/* what the track hands you later — earned at its own rank, not the unlock rank */
	.unlock-reward {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		margin-top: 6px;
		padding-top: 6px;
		border-top: 1px dashed var(--line);
		width: 100%;
	}
	.unlock-reward-icon {
		width: 22px;
		height: 22px;
		object-fit: contain;
	}
	.unlock-reward-name {
		font-size: 11px;
		line-height: 1.2;
		text-align: center;
	}
	.unlock-reward-at {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--text-dim);
	}
	.unlock-alt {
		margin: 8px 0 0;
		font-size: 12.5px;
		color: var(--text-dim);
	}
	.unlock-note {
		margin: 8px 0 0;
		font-size: 11.5px;
		line-height: 1.5;
		color: var(--text-faint);
	}

	.pg-item {
		margin-top: 10px;
	}
	.pg-item:first-of-type {
		margin-top: 4px;
	}
	.pg-head {
		display: flex;
		align-items: baseline;
		gap: 7px;
	}
	.pg-rank {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--text-faint);
		flex: none;
	}
	.pg-name {
		font-size: 13px;
		font-weight: 600;
	}
	.pg-desc {
		margin: 2px 0 0;
		font-size: 11.5px;
		line-height: 1.5;
		color: var(--text-dim);
	}
	.pg-req {
		margin: 2px 0 0;
		font-size: 11px;
		line-height: 1.5;
		color: var(--text-faint);
	}
	.pg-req-k {
		font-family: var(--font-mono);
		font-size: 9px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--accent);
		margin-right: 6px;
	}

	.si-row {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 8px;
	}
	.si-row b {
		font-size: 13px;
		font-weight: 600;
	}
	.si-icon {
		width: 26px;
		height: 26px;
		object-fit: cover;
		border-radius: var(--radius-2);
		flex-shrink: 0;
	}
	.si-code {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 650;
		color: var(--accent);
		background: var(--accent-soft);
		border-radius: 99px;
		padding: 3px 8px;
		flex-shrink: 0;
	}
	.pair {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 4px;
		text-decoration: none;
		color: inherit;
	}
	.pair-icon {
		width: 38px;
		height: 38px;
		object-fit: cover;
		border-radius: var(--radius-2);
		flex-shrink: 0;
	}
	.pair-text b {
		font-size: 13px;
		font-weight: 600;
		color: var(--accent);
	}
	.pair:hover .pair-text b {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.pair-sub {
		display: block;
		margin-top: 2px;
		font-size: 11.5px;
		line-height: 1.5;
		color: var(--text-dim);
	}
	.si-desc {
		margin: 4px 0 0;
		font-size: 12px;
		line-height: 1.55;
		color: var(--text-dim);
		white-space: pre-line;
	}
	.si-all {
		display: inline-block;
		margin-top: 10px;
		font-family: var(--font-mono);
		font-size: 10.5px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		text-decoration: none;
		color: var(--accent);
	}
	.si-all:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	/* Below the two-column width the rail becomes a grid of its own cards
	   under (or, on a phone, above) the main column — see the class layout,
	   which owns the ordering. */
	@media (max-width: 1080px) {
		.infobox {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr));
			align-items: start;
		}
	}
</style>
