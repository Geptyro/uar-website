<script lang="ts">
	import { allowedLabel, itemTypeLabels, itemTypeOrder, type Item } from '$lib/mos';

	let { data } = $props();

	const mos = $derived(data.mos);
	// mission items (supply) are objective props, not class gear — keep them off class pages
	const usable = $derived(data.items.filter((i) => i.type !== 'supply'));
	const si = $derived(data.si);

	// 24px-viewBox stroke paths for the infobox stat icons
	const STAT_ICONS: Record<string, string> = {
		role: 'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',
		type: 'M12 3a4 4 0 100 8 4 4 0 000-8zM5 21c0-3.9 3.1-7 7-7s7 3.1 7 7',
		life: 'M12 20.5C7 16.5 3.5 13.2 3.5 9.4 3.5 6.7 5.6 4.5 8.2 4.5c1.6 0 3 .8 3.8 2 .8-1.2 2.2-2 3.8-2 2.6 0 4.7 2.2 4.7 4.9 0 3.8-3.5 7.1-8.5 11.1z',
		armor: 'M12 3l7.5 3v5.5c0 4.8-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.7-7.5-9.5V6z',
		speed: 'M4 17.5a8.5 8.5 0 1116 0M12 15l4.5-5.5M10.5 15a1.8 1.8 0 103.6 0 1.8 1.8 0 00-3.6 0z',
		energy: 'M13 2.5L4.5 13.5H11l-1 8L18.5 10.5H12z',
		bag: 'M7 8V6.5a5 5 0 0110 0V8m-13 0h16l-1 12.5H5z',
		trees: 'M6 3.5a2 2 0 100 4 2 2 0 000-4zm12 0a2 2 0 100 4 2 2 0 000-4zM6 16.5a2 2 0 100 4 2 2 0 000-4zm0-9v9m12-9c0 5-4 5.5-8 6.5-2 .5-4 1-4 2.5',
		items: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 3v9m8-4.5L12 12 4 7.5'
	};

	const stats = $derived(
		(
			[
				['life', 'Life', mos.life],
				['armor', 'Armor', mos.armor],
				['speed', 'Speed', mos.speed],
				['energy', 'Energy', mos.energy]
			] as const
		).filter(([, , v]) => v !== null)
	);

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

	function itemNote(item: Item): string {
		const parts = [...item.mods];
		if (item.allowed !== null) {
			const label = allowedLabel(item);
			if (label && item.allowed.length > 1) parts.push(label);
		}
		return parts.join(' · ');
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
							<td></td>
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
									<td class="mono notes">{itemNote(item)}</td>
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
								<td class="mono effect">{item.mods.join(', ')}</td>
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

		{#if mos.common.length}
			<h2 class="section">Standard abilities</h2>
			<div class="abil-list">
				{#each mos.common as a (a.id)}
					{#if a.tooltip}
						<details>
							<summary>
								{#if a.icon}
									<img class="abil-icon" src={a.icon} alt="" loading="lazy" />
								{:else}
									<span class="abil-icon placeholder"></span>
								{/if}
								{a.name}
							</summary>
							<p>{a.tooltip}</p>
						</details>
					{:else}
						<span class="abil-plain">
							{#if a.icon}
								<img class="abil-icon" src={a.icon} alt="" loading="lazy" />
							{:else}
								<span class="abil-icon placeholder"></span>
							{/if}
							{a.name}
						</span>
					{/if}
				{/each}
			</div>
		{/if}
	</div>

	<aside class="infobox">
		<div class="card box">
			{#if mos.icon}
				<img class="portrait" src={mos.icon} alt="{mos.name} portrait" />
			{/if}
			<div class="box-title">
				<b>{mos.name}</b>
				{#if mos.mos}<span>MOS {mos.mos}</span>{/if}
			</div>
			{#snippet statIcon(key: string)}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d={STAT_ICONS[key]} />
				</svg>
			{/snippet}
			<dl class="facts">
				{#if mos.role}
					<dt>{@render statIcon('role')}Role</dt>
					<dd>{mos.role}</dd>
				{/if}
				<dt>{@render statIcon('type')}Type</dt>
				<dd>{mos.unitType}</dd>
				{#each stats as [key, label, value] (key)}
					<dt>{@render statIcon(key)}{label}</dt>
					<dd>{value}</dd>
				{/each}
				{#if mos.inventory.slots}
					<dt>{@render statIcon('bag')}Bag slots</dt>
					<dd>{mos.inventory.slots}</dd>
				{/if}
				<dt>{@render statIcon('trees')}Skill trees</dt>
				<dd>{mos.skills.length}</dd>
				<dt>{@render statIcon('items')}Usable items</dt>
				<dd>{usable.length}</dd>
			</dl>
			<a class="unit-link" href="/entities/{mos.id}">Unit data →</a>
		</div>
		{#if mos.tooltip}
			<div class="card box desc">
				<div class="box-label">In-game description</div>
				<p>{mos.tooltip}</p>
			</div>
		{/if}
		{#if si.length}
			<div class="card box desc">
				<div class="box-label">Skill Identifiers</div>
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
			</div>
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
	.box {
		padding: 0;
		overflow: hidden;
	}
	.portrait {
		display: block;
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
	}
	.box-title {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
		padding: 12px 14px 4px;
	}
	.box-title b {
		font-size: 15px;
		font-weight: 650;
		letter-spacing: -0.01em;
	}
	.box-title span {
		font-family: var(--mono);
		font-size: 10px;
		color: var(--mos);
		letter-spacing: 0.06em;
	}
	.facts {
		margin: 8px 0 0;
		padding: 0 14px;
	}
	.facts dt {
		float: left;
		clear: left;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-3);
		line-height: 2.1;
	}
	.facts dt svg {
		width: 13px;
		height: 13px;
		flex-shrink: 0;
	}
	.facts dd {
		margin: 0;
		text-align: right;
		font-variant-numeric: tabular-nums;
		font-size: 13px;
		font-weight: 550;
		line-height: 2.1;
		border-bottom: 1px solid var(--border);
	}
	.facts dd:last-of-type {
		border-bottom: none;
	}
	.unit-link {
		display: block;
		text-align: center;
		font-family: var(--mono);
		font-size: 11px;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		text-decoration: none;
		color: var(--ink-2);
		border-top: 1px solid var(--border);
		padding: 10px 12px;
		margin-top: 10px;
		transition: all 120ms ease;
	}
	.unit-link:hover {
		color: var(--accent);
		background: var(--surface-2);
	}
	.box.desc {
		padding: 12px 14px;
	}
	.box-label {
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--ink-3);
		margin-bottom: 6px;
	}
	.box.desc p {
		margin: 0;
		font-size: 12.5px;
		line-height: 1.6;
		color: var(--ink-2);
		white-space: pre-line;
	}

	@media (max-width: 1080px) {
		.layout {
			display: block;
		}
		.infobox {
			position: static;
			max-height: none;
			margin: 16px 0 4px;
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
			align-items: start;
		}
		.portrait {
			aspect-ratio: auto;
			max-height: 220px;
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

	.abil-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-width: 78ch;
	}
	details,
	.abil-plain {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		box-shadow: var(--shadow-1);
	}
	summary {
		cursor: pointer;
		padding: 8px 14px;
		font-size: 13px;
		font-weight: 550;
		list-style: none;
		display: flex;
		align-items: center;
		gap: 8px;
		transition: color 120ms ease;
	}
	summary::before {
		content: '';
		width: 5px;
		height: 5px;
		border-right: 1.5px solid var(--ink-3);
		border-bottom: 1.5px solid var(--ink-3);
		transform: rotate(-45deg);
		transition: transform 140ms ease;
		flex-shrink: 0;
	}
	details[open] summary::before {
		transform: rotate(45deg);
	}
	summary:hover {
		color: var(--accent);
	}
	details p {
		margin: 0;
		padding: 0 14px 12px 27px;
		font-size: 12.5px;
		color: var(--ink-2);
		white-space: pre-line;
	}
	.abil-plain {
		padding: 8px 14px;
		font-size: 13px;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.abil-icon {
		width: 22px;
		height: 22px;
		object-fit: cover;
		border-radius: 4px;
		flex-shrink: 0;
	}
	.abil-icon.placeholder {
		display: inline-block;
		background: var(--surface-2);
	}
	details p {
		padding-left: 44px;
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
