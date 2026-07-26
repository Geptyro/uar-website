<script lang="ts">
	import {
		allowedLabel,
		itemTypeLabels,
		itemTypeOrder,
		modsFor,
		rankTracks,
		type Item,
		type UnlockReq
	} from '$lib/mos';
	import { applyText } from '$lib/units';
	import { gearGroups as accountGear, type MosTopPlayer } from '$lib/players';
	import anonPortrait from '$lib/assets/anon-portrait.svg';
	import FactsCard, { type Fact } from '$lib/components/FactsCard.svelte';
	import ModelCard from '$lib/components/ModelCard.svelte';
	import DescCard from '$lib/components/DescCard.svelte';
	import MechanicsGrid from '$lib/components/MechanicsGrid.svelte';
	import ClassPanel from '$lib/components/ClassPanel.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { mechanicsFor } from '$lib/mechanics';
	import models from '$lib/data/models.json';

	let { data } = $props();

	const mos = $derived(data.mos);
	const modelUrl = $derived((models as Record<string, string>)[data.mos.id] ?? null);
	const mechanics = $derived(mechanicsFor(data.mos.id));

	// mission items (supply) are objective props, not class gear — keep them off class pages
	const usable = $derived(data.items.filter((i) => i.type !== 'supply'));
	const si = $derived(data.si);

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
		{ icon: 'trees', label: 'Skill trees', value: mos.skills.length } as Fact,
		{ icon: 'items', label: 'Usable items', value: usable.length } as Fact
	]);

	const weaponItems = $derived(usable.filter((i) => i.type === 'weapon'));
	const gearGroups = $derived(
		itemTypeOrder
			.filter((t) => t !== 'weapon' && t !== 'supply')
			.map((t) => ({ type: t, label: itemTypeLabels[t], items: usable.filter((i) => i.type === t) }))
			.filter((g) => g.items.length)
	);

	function dps(dmg: number | null, period: number | null): string {
		return dmg && period ? String(Math.round(dmg / period)) : '?';
	}

	/** stand-in tile art for the handful of abilities the map ships without an icon */
	function initials(name: string): string {
		return (name.match(/[A-Za-z0-9]+/g) ?? [])
			.slice(0, 2)
			.map((w) => w[0].toUpperCase())
			.join('');
	}

	function itemNote(item: Item): string {
		const parts = modsFor(item, mos.id);
		if (item.allowed !== null) {
			const label = allowedLabel(item);
			if (label && item.allowed.length > 1) parts.push(label);
		}
		return parts.join(' · ');
	}

	// prerendered page — the leaderboard comes from the live DB, client-side
	let topPlayers = $state<MosTopPlayer[]>([]);
	$effect(() => {
		const id = mos.id;
		let stale = false;
		topPlayers = [];
		fetch(`/api/mos-players/${id}`)
			.then((r) => (r.ok ? r.json() : null))
			.then((j) => {
				if (!stale && j) topPlayers = j.players ?? [];
			})
			.catch(() => {});
		return () => {
			stale = true;
		};
	});

	// account-progression gear (vehicle upgrades / medical visor) owned by this class,
	// shown in pilot-rank order rather than bank-flag order
	const progressionGear = $derived.by(() => {
		const g = accountGear.find((g) => g.mosId === mos.id);
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
								: (req.rank ?? `${fmtXpShort(req.xp ?? 0)} XP`),
						sub: req && req.xp && req.rank ? `${fmtXpShort(req.xp)} XP` : null,
						title: unlockTitle(req, rank)
					};
				})
			: []
	);

	function fmtPlaytime(seconds: number): string {
		if (seconds >= 3600) {
			const h = seconds / 3600;
			return `${h >= 10 ? Math.round(h) : h.toFixed(1)} h`;
		}
		return `${Math.max(1, Math.round(seconds / 60))} min`;
	}
</script>

<svelte:head>
	<title>{mos.name} — MOS — UAR Unit Database</title>
</svelte:head>

<div class="layout">
	<div class="main">
		{#if mos.skills.length}
			<h2 class="section">Skills · {mos.skills.length} trees</h2>
			<div class="cards">
				{#each mos.skills as s (s.id)}
					<article class="card">
						<h3>
							{#if s.icon}
								<img class="skill-icon" src={s.icon} alt="" loading="lazy" />
							{:else}
								<span class="skill-icon placeholder"></span>
							{/if}
							<span class="skill-name">{s.name}</span>
							{#if s.levels}<span class="lv">{s.levels} lv</span>{/if}
						</h3>
						{#if s.tooltip}<p class="card-tip">{s.tooltip}</p>{/if}
					</article>
				{/each}
			</div>
		{/if}

		<!-- vehicles arm themselves through panel abilities, so they have no weapon rows -->
		{#if mos.weapons.length || weaponItems.length}
			<h2 class="section">Armament</h2>
			<p class="note">
				Standard-issue weapons plus every weapon item this class can pick up and use. Buff-type
				weapons (no separate stats) modify the equipped weapon instead.
			</p>
			<div class="tablewrap">
				<table class="data" style="min-width: 660px">
					<thead>
						<tr>
							<th>Weapon</th>
							<th>Source</th>
							<th class="num">Damage</th>
							<th class="num">Range</th>
							<th class="num">Period (s)</th>
							<th class="num">DPS</th>
							<th>Notes</th>
						</tr>
					</thead>
					<tbody>
						{#each mos.weapons as w (w.id)}
							<tr>
								<td class="wname">{w.id}</td>
								<td><span class="tag">standard issue</span></td>
								<td class="num">{w.dmg ?? '?'}</td>
								<td class="num">{w.range ?? '?'}</td>
								<td class="num">{w.period ?? '?'}</td>
								<td class="num">{dps(w.dmg, w.period)}</td>
								<td class="mono notes">{(w.applies ?? []).map(applyText).join(' · ')}</td>
							</tr>
						{/each}
						{#each weaponItems as item (item.id)}
							{#if item.grants.length}
								{#each item.grants as g (g.id)}
									<tr>
										<td class="wname namecell">
											{#if item.icon}<img class="row-icon" src={item.icon} alt="" loading="lazy" />{/if}
											<a href="/items#{item.id}">{item.name}</a>
										</td>
										<td><span class="tag t-item">item</span></td>
										<td class="num">{g.dmg ?? '?'}</td>
										<td class="num">{g.range ?? '?'}</td>
										<td class="num">{g.period ?? '?'}</td>
										<td class="num">{dps(g.dmg, g.period)}</td>
										<td class="mono notes"
											>{[itemNote(item), ...(g.applies ?? []).map(applyText)]
												.filter(Boolean)
												.join(' · ')}</td
										>
									</tr>
								{/each}
							{:else}
								<tr>
									<td class="wname namecell">
										{#if item.icon}<img class="row-icon" src={item.icon} alt="" loading="lazy" />{/if}
										<a href="/items#{item.id}">{item.name}</a>
									</td>
									<td><span class="tag t-item">weapon buff</span></td>
									<td class="num" colspan="4"></td>
									<td class="mono notes">{itemNote(item)}</td>
								</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>
		{/if}

		{#if mechanics}
			<h2 class="section">Handling</h2>
			<p class="note">
				Ammunition, jamming and shared-class behaviour, read from the map's trigger script rather
				than the unit data.
			</p>
			<MechanicsGrid mosId={mos.id} />
		{/if}

		{#if mechanics?.panel.length}
			<h2 class="section">Class panel · {mechanics.panel.length} buttons</h2>
			<p class="note">
				Extra actions on this class's mini-panel, with the hotkey that triggers each one.
			</p>
			<ClassPanel keys={mechanics.panel} />
		{/if}

		{#each gearGroups as group (group.type)}
			<h2 class="section">{group.label} · {group.items.length}</h2>
			<div class="tablewrap">
				<table class="data" style="min-width: 640px">
					<thead>
						<tr>
							<th>Item</th>
							<th class="num">Charges</th>
							<th>Effect</th>
							<th>Who can use it</th>
							<th>Conflicts</th>
						</tr>
					</thead>
					<tbody>
						{#each group.items as item (item.id)}
							<tr>
								<td class="namecell">
									{#if item.icon}<img class="row-icon" src={item.icon} alt="" loading="lazy" />{/if}
									<a href="/items#{item.id}">{item.name}</a>
								</td>
								<td class="num"
									>{item.charges ? `${item.charges.start ?? '?'}/${item.charges.max}` : ''}</td
								>
								<td class="mono effect">{modsFor(item, mos.id).join(', ')}</td>
								<td>
									{#if item.allowed !== null}
										<span class="tag t-mos">{allowedLabel(item)}</span>
									{:else}
										<span class="tag">everyone</span>
									{/if}
								</td>
								<td class="mono effect">{item.conflicts.join(' · ')}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/each}

	</div>

	<aside class="infobox">
		<FactsCard
			portrait={mos.icon}
			title={mos.name}
			chip={mos.mos ? `MOS ${mos.mos}` : null}
			{facts}
			link={{ href: `/entities/${mos.id}`, label: 'Unit data →' }}
		/>
		{#if mos.common.length}
			<DescCard label="Standard abilities · {mos.common.length}">
				<ul class="abil-grid">
					{#each mos.common as a (a.id)}
						<li>
							<Tooltip label={a.name} text={a.tooltip} placement="left">
								<span class="abil-tile">
									{#if a.icon}
										<img src={a.icon} alt={a.name} loading="lazy" />
									{:else}
										<span class="abil-fallback" aria-label={a.name}>{initials(a.name)}</span>
									{/if}
								</span>
							</Tooltip>
						</li>
					{/each}
				</ul>
				<p class="unlock-note">
					Commands this class has by default. Hover — or focus — an icon for what it does.
				</p>
			</DescCard>
		{/if}
		{#if unlock}
			<DescCard label="Unlock requirements">
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
							<span class="unlock-sub">{c.sub ?? ' '}</span>
						</div>
					{/each}
				</div>
				{#if everyTrackXp}
					<p class="unlock-note">Needs the XP on all three rank tracks at once.</p>
				{/if}
				{#if unlock.medals}
					<p class="unlock-alt">…and earn <a href="/medals">{unlock.medals} medals</a></p>
				{/if}
				{#if unlock.modes}
					<p class="unlock-note">Only in {unlock.modes.join(', ')}</p>
				{/if}
				<p class="unlock-note">
					Max picks per game: {unlock.charges}. Any prestige unlocks all rank requirements.
				</p>
				<a class="si-all" href="/ranks">Rank tracks →</a>
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
				<a class="si-all" href="/si">All Skill Identifiers →</a>
			</DescCard>
		{/if}
		{#if topPlayers.length}
			<DescCard label="Top players">
				<ol class="top-list">
					{#each topPlayers as p, i (p.toon || p.name)}
						<li>
							<div class="prow">
								<span class="pos">{i + 1}</span>
								<img class="pportrait" src={p.avatarUrl || anonPortrait} alt="" loading="lazy" />
								{#if p.clan}<span class="pclan">&lt;{p.clan}&gt;</span>{/if}
								{#if p.toon}
									<a class="pname" href="/players/{p.toon}">{p.name}</a>
								{:else}
									<span class="pname">{p.name}</span>
								{/if}
								<span class="ptime" title="{p.games} game{p.games === 1 ? '' : 's'}"
									>{fmtPlaytime(p.seconds)}</span
								>
							</div>
							<div class="pbar">
								{#if p.seconds > 0}
									<div
										class="pbar-fill"
										style="width: {(100 * p.seconds) / topPlayers[0].seconds}%"
									></div>
								{/if}
							</div>
						</li>
					{/each}
				</ol>
				<p class="top-note">Time played on this class across ingested replays.</p>
				<a class="si-all" href="/players">All players →</a>
			</DescCard>
		{/if}
	</aside>
</div>

<style>
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 290px;
		gap: 0 28px;
		align-items: start;
	}
	.main {
		min-width: 0;
	}

	.main :global(h2.section:first-child) {
		margin-top: 4px;
	}

	/* ---------- right infobox ---------- */
	.infobox {
		display: flex;
		flex-direction: column;
		gap: 14px;
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
		border-radius: var(--r-sm);
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
		background: var(--ink-2);
		-webkit-mask: var(--wf) center / contain no-repeat;
		mask: var(--wf) center / contain no-repeat;
	}
	.unlock-tracklabel {
		font-family: var(--mono);
		font-size: 8.5px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink-3);
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
		font-family: var(--mono);
		font-size: 10px;
		color: var(--ink-2);
		min-height: 12px;
		white-space: pre;
	}
	.unlock-alt {
		margin: 8px 0 0;
		font-size: 12.5px;
		color: var(--ink-2);
	}
	.unlock-note {
		margin: 8px 0 0;
		font-size: 11.5px;
		line-height: 1.5;
		color: var(--ink-3);
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
		font-family: var(--mono);
		font-size: 10px;
		color: var(--ink-3);
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
		color: var(--ink-2);
	}
	.pg-req {
		margin: 2px 0 0;
		font-size: 11px;
		line-height: 1.5;
		color: var(--ink-3);
	}
	.pg-req-k {
		font-family: var(--mono);
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
		border-radius: var(--r-sm);
		flex-shrink: 0;
	}
	.si-desc {
		margin: 4px 0 0;
		font-size: 12px;
		line-height: 1.55;
		color: var(--ink-2);
		white-space: pre-line;
	}
	.si-all {
		display: inline-block;
		margin-top: 10px;
		font-family: var(--mono);
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
	.top-list {
		list-style: none;
		margin: 2px 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 7px;
	}
	.top-list li {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}
	.prow {
		display: flex;
		align-items: baseline;
		gap: 6px;
		font-size: 12.5px;
		min-width: 0;
	}
	.pportrait {
		width: 22px;
		height: 22px;
		border-radius: var(--r-sm);
		object-fit: cover;
		border: 1px solid var(--border);
		align-self: center;
		flex-shrink: 0;
	}
	/* time played relative to the #1 player, zero-based */
	.pbar {
		/* aligned under the name: pos 14 + portrait 22 + 2 gaps */
		margin-left: 48px;
		height: 3px;
		border-radius: 99px;
		background: var(--surface-2);
		overflow: hidden;
	}
	.pbar-fill {
		height: 100%;
		min-width: 2px;
		border-radius: inherit;
		background: var(--accent);
	}
	.pos {
		font-family: var(--mono);
		font-size: 10px;
		color: var(--ink-3);
		min-width: 14px;
		text-align: right;
		flex-shrink: 0;
	}
	.pclan {
		color: var(--ink-3);
		font-size: 11px;
		flex-shrink: 0;
	}
	.pname {
		font-weight: 550;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.ptime {
		margin-left: auto;
		font-family: var(--mono);
		font-size: 11px;
		color: var(--ink-2);
		white-space: nowrap;
		flex-shrink: 0;
	}
	.top-note {
		margin: 10px 0 0;
		font-size: 11px;
		line-height: 1.5;
		color: var(--ink-3);
	}

	@media (max-width: 1080px) {
		.layout {
			display: block;
		}
		.infobox {
			margin: 16px 0 4px;
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
			align-items: start;
		}
	}

	/* ---------- main column ---------- */
	.wname {
		font-weight: 550;
	}
	td.notes {
		max-width: 240px;
		overflow-wrap: anywhere;
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 12px;
	}
	.card h3 {
		margin: 0 0 8px;
		font-size: 14px;
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 9px;
	}
	.skill-icon {
		width: 28px;
		height: 28px;
		object-fit: cover;
		border-radius: var(--r-sm);
		flex-shrink: 0;
	}
	.skill-icon.placeholder {
		display: inline-block;
		background: var(--surface-2);
	}
	.skill-name {
		flex: 1;
	}
	.si-code {
		font-family: var(--mono);
		font-size: 10px;
		font-weight: 650;
		color: var(--accent);
		background: var(--accent-soft);
		border-radius: 99px;
		padding: 3px 8px;
		flex-shrink: 0;
	}
	.lv {
		font-family: var(--mono);
		font-size: 10px;
		font-weight: 550;
		color: var(--accent);
		background: var(--accent-soft);
		border-radius: 99px;
		padding: 2px 8px;
		white-space: nowrap;
	}
	.card-tip {
		margin: 0;
		font-size: 12.5px;
		color: var(--ink-2);
		white-space: pre-line;
	}

	/* command-card style grid: square tiles filling the infobox width */
	.abil-grid {
		list-style: none;
		margin: 2px 0 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
		gap: 6px;
	}
	.abil-tile {
		width: 100%;
		aspect-ratio: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		/* dark slot in both themes: the icon art is drawn for SC2's dark command
		   card, and white line-art ones vanish on the light surface */
		background: var(--sidebar);
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		box-shadow: var(--shadow-1);
		cursor: help;
		transition:
			border-color 140ms ease,
			transform 140ms ease,
			box-shadow 140ms ease;
	}
	.abil-tile img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.abil-grid :global(.tt) {
		width: 100%;
	}
	.abil-fallback {
		font-family: var(--mono);
		font-size: 12px;
		font-weight: 650;
		color: var(--sidebar-ink-2);
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.abil-grid li:hover .abil-tile,
	.abil-grid li:focus-within .abil-tile {
		border-color: var(--border-strong);
		transform: translateY(-1px);
		box-shadow: var(--shadow-2);
	}

	td.namecell {
		white-space: nowrap;
	}
	.row-icon {
		width: 20px;
		height: 20px;
		object-fit: cover;
		border-radius: 4px;
		vertical-align: -5px;
		margin-right: 7px;
	}
	td.effect {
		overflow-wrap: anywhere;
		min-width: 140px;
	}
</style>
