<script lang="ts">
	import {
		rankFor,
		nextRank,
		totalWins,
		modeNames,
		gearGroups,
		camoName,
		decalName,
		careerXp,
		XP_CAP,
		type Sighting
	} from '$lib/players';
	import { medals, camos } from '$lib/unlocks';
	import { skillIdentifiers, mosById, mosList } from '$lib/mos';

	let { data } = $props();
	const p = $derived(data.player);

	const tracks = $derived(
		[
			{ n: 1, label: 'Enlisted', xp: p.xpEn },
			{ n: 2, label: 'Warrant Officer', xp: p.xpWo },
			{ n: 3, label: 'Commissioned Officer', xp: p.xpCo }
		].map((t) => {
			const rank = rankFor(t.n, t.xp);
			const next = nextRank(t.n, t.xp);
			const floor = rank?.xp ?? 0;
			const ceil = next?.xp ?? XP_CAP;
			return {
				...t,
				rank,
				next,
				pct: Math.min(100, ceil > floor ? ((t.xp - floor) / (ceil - floor)) * 100 : 100)
			};
		})
	);

	const sisUnlocked = $derived(new Set(p.unlocks.sis));
	const medalsUnlocked = $derived(new Set(p.unlocks.medals));
	const camosUnlocked = $derived(new Set(p.unlocks.camos));
	const sisSorted = [...skillIdentifiers].sort((a, b) => a.num - b.num);

	const modes = $derived(
		modeNames
			.map((name, i) => ({ name, wins: p.winsByMode[i] ?? 0 }))
			.filter((m) => m.wins > 0)
			.sort((a, b) => b.wins - a.wins)
	);

	const linkableMos = new Set(mosList.map((m) => m.id));
	const classesPlayed = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const h of p.history) {
			for (const id of h.mos) counts.set(id, (counts.get(id) ?? 0) + 1);
		}
		return [...counts.entries()]
			.sort((a, b) => b[1] - a[1])
			.map(([id, games]) => ({ id, games, info: mosById.get(id) }));
	});

	function delta(h: Sighting[], i: number, key: keyof Sighting): number | null {
		if (i === 0) return null;
		const d = (h[i][key] as number) - (h[i - 1][key] as number);
		return d > 0 ? d : null;
	}

	function fmtDate(iso: string): string {
		return iso.slice(0, 10);
	}
</script>

<svelte:head>
	<title>{p.name} — Players — UAR Unit Database</title>
</svelte:head>

<div class="layout">
	<div class="main">
		<h2 class="section">Ranks</h2>
		<div class="rankcards">
			{#each tracks as t (t.n)}
				<div class="rankcard">
					<div class="rc-head">
						{#if t.rank?.icon}<img class="rc-insignia" src={t.rank.icon} alt="" />{/if}
						<div>
							<div class="rc-track">{t.label}</div>
							<div class="rc-rank">
								<span class="mono rc-prefix">{t.rank?.prefix}</span>
								{t.rank?.name}
							</div>
						</div>
					</div>
					<div class="rc-bar">
						<div class="rc-fill" style="width: {t.pct}%"></div>
					</div>
					<div class="rc-xp mono">
						{t.xp.toLocaleString('en')} XP
						{#if t.next}
							<span class="rc-next">{(t.next.xp - t.xp).toLocaleString('en')} to {t.next.prefix}</span>
						{:else}
							<span class="rc-next">max rank</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>

		<div class="duo">
			{#if modes.length}
				<section>
					<h2 class="section">Wins by mode</h2>
					<div class="tablewrap">
						<table class="data modes">
							<thead>
								<tr><th>Mode</th><th class="num">Wins</th><th></th></tr>
							</thead>
							<tbody>
								{#each modes as m (m.name)}
									<tr>
										<td>{m.name}</td>
										<td class="num">{m.wins.toLocaleString('en')}</td>
										<td class="barcell">
											<div class="modebar" style="width: {(m.wins / modes[0].wins) * 100}%"></div>
										</td>
									</tr>
								{/each}
								<tr class="total">
									<td>Total</td>
									<td class="num">{totalWins(p).toLocaleString('en')}</td>
									<td></td>
								</tr>
							</tbody>
						</table>
					</div>
				</section>
			{/if}

			{#if classesPlayed.length}
				<section>
					<h2 class="section">
						Classes played <span class="counthint">in ingested replays</span>
					</h2>
					<div class="tablewrap">
						<table class="data modes">
							<thead>
								<tr><th>Class</th><th class="num">Games</th><th></th></tr>
							</thead>
							<tbody>
								{#each classesPlayed as c (c.id)}
									<tr>
										<td class="classcell">
											{#if c.info?.icon}<img
													class="class-icon"
													src={c.info.icon}
													alt=""
													loading="lazy"
												/>{/if}
											{#if c.info && linkableMos.has(c.id)}
												<a href="/mos/{c.id}">{c.info.name}</a>
											{:else}
												{c.info?.name ?? c.id}
											{/if}
										</td>
										<td class="num">{c.games}</td>
										<td class="barcell">
											<div
												class="modebar"
												style="width: {(c.games / classesPlayed[0].games) * 100}%"
											></div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</section>
			{/if}
		</div>

		<h2 class="section">Medals <span class="counthint">{p.unlocks.medals.length} / {medals.length}</span></h2>
		<div class="medals">
			{#each medals as m (m.num)}
				<div class="medal" class:locked={!medalsUnlocked.has(m.num)} title={m.desc}>
					{#if m.icon}
						<img class="medal-icon" src={m.icon} alt="" loading="lazy" />
					{:else}
						<span class="medal-icon placeholder">★</span>
					{/if}
					<div>
						<div class="medal-name">{m.name}</div>
						<div class="medal-desc">{m.desc}</div>
					</div>
				</div>
			{/each}
		</div>
		<p class="note"><a href="/medals">All medals & decals →</a></p>

		<h2 class="section">
			Skill Identifiers <span class="counthint">{p.unlocks.sis.length} / {sisSorted.length}</span>
		</h2>
		<div class="sigrid">
			{#each sisSorted as s (s.num)}
				<a
					class="si"
					class:locked={!sisUnlocked.has(s.num)}
					href="/si"
					title="{s.name} — {s.desc}"
				>
					{#if s.icon}<img class="si-img" src={s.icon} alt="" loading="lazy" />{/if}
					<span class="mono si-code">{s.code}</span>
				</a>
			{/each}
		</div>

		<h2 class="section">
			Camouflages <span class="counthint">{p.unlocks.camos.length} / {camos.length}</span>
		</h2>
		<div class="camogrid">
			{#each camos as c (c.num)}
				<a
					class="camo"
					class:locked={!camosUnlocked.has(c.num)}
					class:worn={p.camo === c.num}
					href="/camos"
					title="{c.name}{c.req ? ` — ${c.req}` : ''}{p.camo === c.num ? ' (equipped)' : ''}"
				>
					{#if c.swatch}
						<img class="camo-img" src={c.swatch} alt="{c.name} camo" loading="lazy" />
					{:else}
						<span class="camo-img camo-placeholder"></span>
					{/if}
					<span class="camo-name">{c.name}</span>
				</a>
			{/each}
		</div>

		<h2 class="section">Replay history</h2>
		<div class="tablewrap">
			<table class="data">
				<thead>
					<tr>
						<th>Game date</th>
						<th>Class</th>
						<th class="num">Enlisted</th>
						<th class="num">Warrant</th>
						<th class="num">Commissioned</th>
						<th class="num">Games</th>
						<th class="num">Wins</th>
						<th class="num">Revives</th>
					</tr>
				</thead>
				<tbody>
					{#each p.history as h, i (h.file)}
						<tr>
							<td class="mono">
								<a href="/replays/{h.file}" download rel="external" title="Download replay"
									>{fmtDate(h.playedAt)} ⬇</a
								>
							</td>
							<td class="histclass">
								{#each h.mos as id (id)}
									{@const chip = mosById.get(id)}
									{#if chip?.icon}<img
											class="class-icon"
											src={chip.icon}
											alt={chip.name}
											title={chip.name}
											loading="lazy"
										/>{:else}{chip?.name ?? id}{/if}
								{/each}
							</td>
							{#each ['xpEn', 'xpWo', 'xpCo', 'gamesPlayed', 'wins', 'revives'] as const as key (key)}
								{@const d = delta(p.history, i, key)}
								<td class="num">
									{(h[key] as number).toLocaleString('en')}
									{#if d}<span class="delta">+{d.toLocaleString('en')}</span>{/if}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="note">
			One row per ingested replay this player appears in; green deltas show progress between
			sightings. Values are the save-file state when each game started.
		</p>
	</div>

	<aside class="infobox">
		<div class="card box">
			<dl class="facts">
				<dt>Battle.net ID</dt>
				<dd class="mono">{p.toon}</dd>
				{#if p.clan}
					<dt>Clan</dt>
					<dd>&lt;{p.clan}&gt;</dd>
				{/if}
				<dt>Prestige</dt>
				<dd>{p.prestige}</dd>
				<dt>Career XP</dt>
				<dd>{careerXp(p).toLocaleString('en')}</dd>
				<dt>Games played</dt>
				<dd>{p.gamesPlayed.toLocaleString('en')}</dd>
				<dt>Wins</dt>
				<dd>{totalWins(p).toLocaleString('en')}</dd>
				<dt>Revives</dt>
				<dd>{p.revives.toLocaleString('en')}</dd>
				<dt>Avg game</dt>
				<dd>{p.avgGameTime ? `${Math.round(p.avgGameTime / 60)} min` : '—'}</dd>
				<dt>Camo</dt>
				<dd>{camoName(p.camo)}</dd>
				<dt>Decal</dt>
				<dd>{decalName(p.decal)}</dd>
				<dt>Camos</dt>
				<dd><a href="/camos">{p.unlocks.camos.length} / 25</a></dd>
				<dt>Decals</dt>
				<dd><a href="/medals">{p.unlocks.decals.length}</a></dd>
				<dt>Last seen</dt>
				<dd class="mono">{fmtDate(p.lastSeen)}</dd>
			</dl>
		</div>

		{#each gearGroups as g (g.key)}
			{@const flags = p.unlocks[g.key] as boolean[]}
			{#if flags.some(Boolean)}
				<div class="card box">
					<div class="box-label">{g.label}</div>
					<ul class="gear">
						{#each g.items as item, i (item)}
							<li class:locked={!flags[i]}>
								<span class="tick">{flags[i] ? '✓' : '·'}</span>{item}
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		{/each}
		<a class="backlink" href="/players">← All players</a>
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
	.counthint {
		font-family: var(--mono);
		font-size: 11.5px;
		font-weight: 400;
		color: var(--ink-3);
		margin-left: 6px;
	}

	/* ---------- rank cards ---------- */
	.rankcards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 12px;
	}
	.rankcard {
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 12px 14px;
		background: var(--surface);
	}
	.rc-head {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 10px;
	}
	.rc-insignia {
		width: 34px;
		height: 34px;
		object-fit: contain;
	}
	.rc-track {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ink-3);
	}
	.rc-rank {
		font-weight: 650;
		font-size: 13.5px;
	}
	.rc-prefix {
		color: var(--ink-2);
		font-size: 11px;
		margin-right: 2px;
	}
	.rc-bar {
		height: 5px;
		border-radius: 3px;
		background: var(--border);
		overflow: hidden;
	}
	.rc-fill {
		height: 100%;
		border-radius: 3px;
		background: var(--accent);
	}
	.rc-xp {
		margin-top: 7px;
		font-size: 11.5px;
		display: flex;
		justify-content: space-between;
		font-variant-numeric: tabular-nums;
	}
	.rc-next {
		color: var(--ink-3);
	}

	/* ---------- wins by mode + classes played ---------- */
	.duo {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 0 24px;
		align-items: start;
	}
	table.modes {
		width: 100%;
	}
	.classcell {
		white-space: nowrap;
	}
	.classcell a {
		font-weight: 600;
	}
	.barcell {
		width: 160px;
	}
	.modebar {
		height: 8px;
		border-radius: 2px;
		background: var(--accent);
		opacity: 0.55;
		min-width: 2px;
	}
	tr.total td {
		font-weight: 650;
		border-top: 1px solid var(--border);
	}

	/* ---------- medals ---------- */
	.medals {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 8px 16px;
	}
	.medal {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		padding: 8px 10px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
	}
	.medal.locked {
		opacity: 0.4;
	}
	.medal.locked .medal-icon {
		filter: grayscale(1);
	}
	.medal-icon {
		width: 34px;
		height: 34px;
		object-fit: contain;
		flex: none;
	}
	.medal-icon.placeholder {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--ink-3);
		font-size: 20px;
	}
	.medal-name {
		font-weight: 650;
		font-size: 12.5px;
	}
	.medal-desc {
		font-size: 11.5px;
		color: var(--ink-3);
		line-height: 1.35;
	}

	/* ---------- SI grid ---------- */
	.sigrid {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.si {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		width: 52px;
		text-decoration: none;
	}
	.si.locked {
		opacity: 0.3;
	}
	.si.locked .si-img {
		filter: grayscale(1);
	}
	.si-img {
		width: 40px;
		height: 40px;
		object-fit: contain;
		border: 1px solid var(--border);
		border-radius: 6px;
	}
	.si-code {
		font-size: 10px;
		color: var(--ink-3);
	}

	/* ---------- class icons ---------- */
	.class-icon {
		width: 22px;
		height: 22px;
		object-fit: cover;
		border-radius: 3px;
		vertical-align: middle;
		margin-right: 4px;
	}
	.histclass .class-icon {
		margin-right: 3px;
	}

	/* ---------- camo grid ---------- */
	.camogrid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(86px, 1fr));
		gap: 10px;
	}
	.camo {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		text-decoration: none;
		color: var(--ink-2);
	}
	.camo.locked {
		opacity: 0.3;
	}
	.camo.locked .camo-img {
		filter: grayscale(1);
	}
	.camo.worn .camo-img {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
	.camo-img {
		width: 64px;
		height: 64px;
		object-fit: cover;
		border-radius: var(--r-sm);
		border: 1px solid var(--border);
		background: #101010;
	}
	.camo-placeholder {
		display: inline-block;
		background: var(--surface-2);
	}
	.camo-name {
		font-size: 10.5px;
		text-align: center;
		line-height: 1.2;
	}

	/* ---------- history ---------- */
	.delta {
		color: var(--accent);
		font-size: 10.5px;
		margin-left: 4px;
	}

	/* ---------- infobox ---------- */
	.infobox {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.box {
		padding: 8px 0;
	}
	.facts {
		margin: 8px 0 0;
		padding: 0 14px;
	}
	.facts dt {
		float: left;
		clear: left;
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-3);
		line-height: 2.1;
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
	.box-label {
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-3);
		padding: 4px 14px 2px;
	}
	.gear {
		padding: 2px 14px 6px;
	}
	.gear {
		list-style: none;
		margin: 0;
		font-size: 12.5px;
	}
	.gear li {
		display: flex;
		gap: 7px;
		padding: 2px 0;
	}
	.gear li.locked {
		color: var(--ink-3);
		opacity: 0.6;
	}
	.tick {
		font-family: var(--mono);
		color: var(--accent);
		width: 12px;
		flex: none;
	}
	.gear li.locked .tick {
		color: var(--ink-3);
	}
	.backlink {
		font-size: 12.5px;
	}

	@media (max-width: 900px) {
		.layout {
			grid-template-columns: 1fr;
		}
		.infobox {
			margin-top: 18px;
		}
	}
</style>
