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
	import { medals, camos, decals } from '$lib/unlocks';
	import { skillIdentifiers, mosById, mosList } from '$lib/mos';
	import anonPortrait from '$lib/assets/anon-portrait.svg';
	import Pager from '$lib/components/Pager.svelte';
	import { PER_PAGE, pageNumber } from '$lib/paging';
	import { page as currentPage } from '$app/state';

	let { data } = $props();

	// A long-standing player has hundreds of games. History is stored
	// oldest first (that ordering is what makes the per-row deltas work),
	// but reads newest first: page one is the tail, walked backwards, and
	// rows within it descend too. Indices stay absolute — a row's delta
	// must compare against the real next game, not the row above it.
	const historyPages = $derived(Math.max(1, Math.ceil(data.player.history.length / PER_PAGE)));
	const historyPage = $derived(
		pageNumber(currentPage.url.searchParams.get('h'), historyPages)
	);
	const shownHistory = $derived.by(() => {
		const len = data.player.history.length;
		const end = Math.max(0, len - (historyPage - 1) * PER_PAGE);
		const start = Math.max(0, end - PER_PAGE);
		return Array.from({ length: end - start }, (_, i) => end - 1 - i);
	});
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
	// num 0 (rank insignia) is everyone's default decal, never bank-stored
	const decalsUnlocked = $derived(new Set([0, ...p.unlocks.decals]));
	const sisSorted = [...skillIdentifiers].sort((a, b) => a.num - b.num);

	const modes = $derived(
		modeNames
			.map((name, i) => ({ name, wins: p.winsByMode[i] ?? 0 }))
			.filter((m) => m.wins > 0)
			.sort((a, b) => b.wins - a.wins)
	);

	const playerGear = $derived(
		gearGroups.map((g) => ({
			...g,
			flags: p.unlocks[g.key] as boolean[],
			mosInfo: mosById.get(g.mosId)
		}))
	);

	function fmtXpShort(xp: number): string {
		return xp >= 1000
			? `${(xp / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}k`
			: String(xp);
	}

	// Which classes this player can pick, from their per-track XP, prestige and medals
	// (any prestige bypasses the rank requirements; Sushi transformations have no unlock).
	const classRoster = $derived.by(() => {
		const xp = [p.xpEn, p.xpWo, p.xpCo];
		const trackLabels = ['Enlisted', 'Warrant', 'Commissioned'];
		return mosList
			.filter((m) => m.unlock)
			.map((m) => {
				const u = m.unlock!;
				const reqs = [u.en, u.wo, u.co];
				const rankOk =
					p.prestige > 0 ||
					(u.en?.everyTrack
						? xp.every((x) => x >= (u.en?.xp ?? Infinity))
						: reqs.some((r, i) => r?.xp != null && xp[i] >= r.xp));
				const medalsOk = (u.medals ?? 0) <= p.unlocks.medals.length;
				const parts = u.en?.everyTrack
					? [`${fmtXpShort(u.en.xp ?? 0)} XP on all three tracks`]
					: reqs.flatMap((r, i) =>
							r?.xp ? [`${fmtXpShort(r.xp)} XP ${trackLabels[i]}`] : []
						);
				if (u.medals) parts.push(`${u.medals} medals`);
				return { m, unlocked: rankOk && medalsOk, req: parts.join(' · ') };
			});
	});
	const unlockedClasses = $derived(classRoster.filter((c) => c.unlocked).length);

	const classesPlayed = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const h of p.history) {
			for (const id of h.mos) counts.set(id, (counts.get(id) ?? 0) + 1);
		}
		return [...counts.entries()]
			.sort((a, b) => b[1] - a[1])
			.map(([id, games]) => ({ id, games, info: mosById.get(id) }));
	});

	// Sighting values are the save-file state at game start, so the progress
	// earned in game i only shows up in sighting i+1 — attribute it back to row i.
	function delta(h: Sighting[], i: number, key: keyof Sighting): number | null {
		if (i >= h.length - 1) return null;
		const d = (h[i + 1][key] as number) - (h[i][key] as number);
		return d > 0 ? d : null;
	}

	/** Games played between sighting i and the next one; >1 means the delta spans non-ingested games. */
	function gamesSpanned(h: Sighting[], i: number): number {
		if (i >= h.length - 1) return 0;
		return h[i + 1].gamesPlayed - h[i].gamesPlayed;
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
											{#if c.info}
												<a href="/mos/{c.id}">{c.info.name}</a>
											{:else}
												{c.id}
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

		<h2 class="section">
			Classes unlocked <span class="counthint">{unlockedClasses} / {classRoster.length}</span>
		</h2>
		<div class="mosgrid">
			{#each classRoster as c (c.m.id)}
				<a
					class="mosbox"
					class:locked={!c.unlocked}
					href="/mos/{c.m.id}"
					title={c.unlocked ? c.m.name : `${c.m.name} — unlocks at ${c.req}`}
				>
					{#if c.m.icon}<img class="mos-img" src={c.m.icon} alt="" loading="lazy" />{/if}
					<span class="mos-name">{c.m.name}</span>
				</a>
			{/each}
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

		<h2 class="section">
			Decals <span class="counthint">{decalsUnlocked.size} / {decals.length}</span>
		</h2>
		<div class="camogrid">
			{#each decals as d (d.num)}
				<a
					class="camo"
					class:locked={!decalsUnlocked.has(d.num)}
					class:worn={p.decal === d.num}
					href="/medals"
					title="{decalName(d.num)}{d.req ? ` — ${d.req}` : ''}{p.decal === d.num
						? ' (equipped)'
						: ''}"
				>
					{#if d.icon}
						<img class="camo-img decal-img" src={d.icon} alt="{d.name} decal" loading="lazy" />
					{:else}
						<span class="camo-img camo-placeholder"></span>
					{/if}
					<span class="camo-name">{decalName(d.num)}</span>
				</a>
			{/each}
		</div>

		<h2 class="section">Replay history</h2>
		<Pager
			page={historyPage}
			pages={historyPages}
			total={p.history.length}
			label="replays"
			param="h"
		/>
		<div class="tablewrap histrows">
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
					{#each shownHistory as i (p.history[i].file)}
						{@const h = p.history[i]}
						{@const span = gamesSpanned(p.history, i)}
						{#if span > 1}
							<tr class="gap">
								<td
									class="gapinfo"
									colspan="2"
									title="only the game below is a recorded replay; the rest weren't"
								>
									⋯ over {span} games
								</td>
								{#each ['xpEn', 'xpWo', 'xpCo', 'gamesPlayed', 'wins', 'revives'] as const as key (key)}
									{@const d = delta(p.history, i, key)}
									<td class="num">
										{#if d}<span class="delta">+{d.toLocaleString('en')}</span>{/if}
									</td>
								{/each}
							</tr>
						{/if}
						<tr>
							<td class="mono">
								<a href="/replays/{h.file.replace(/\.SC2Replay$/, '')}" title="View replay"
									>{fmtDate(h.playedAt)}</a
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
								{@const d = span === 1 ? delta(p.history, i, key) : null}
								<td class="num">
									{(h[key] as number).toLocaleString('en')}
									{#if d}<span class="delta" title="earned in this game"
											>+{d.toLocaleString('en')}</span
										>{/if}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="note">
			Values are the save-file state when each game started; green deltas are what that game
			earned. A ⋯ row covers games that were never uploaded, and the newest game's gains only
			appear once a later replay arrives.
		</p>
	</div>

	<aside class="infobox">
		<div class="card box">
			<div class="idhead">
				<img class="portrait-lg" src={data.avatarUrl ?? anonPortrait} alt="" />
				<div class="idtext">
					<div class="idname">
						{#if p.clan}<span class="idclan">&lt;{p.clan}&gt;</span>{/if}{p.name}
					</div>
					{#if data.verified}
						<div>
							<span class="tag t-mos" title="Linked via Battle.net login">
								✓ {data.verified.battletag}
							</span>
							{#if data.verified.isOwner}
								<a class="you" href="/account">you</a>
							{/if}
						</div>
					{/if}
				</div>
			</div>
			<dl class="facts">
				<dt>Battle.net ID</dt>
				<dd class="mono">{p.toon}</dd>
				{#if p.clan}
					<dt>Clan</dt>
					<dd><a href="/clans/{encodeURIComponent(p.clan)}">&lt;{p.clan}&gt;</a></dd>
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
				<dd><a href="/medals">{decalsUnlocked.size} / {decals.length}</a></dd>
				<dt>Last seen</dt>
				<dd class="mono">{fmtDate(p.lastSeen)}</dd>
			</dl>
		</div>

		{#if playerGear.length}
			<div class="card box">
				<div class="box-label">Gear unlocks</div>
				{#each playerGear as g (g.key)}
					<a class="gear-head" href="/mos/{g.mosId}">
						{#if g.mosInfo?.icon}
							<img class="gear-mos" src={g.mosInfo.icon} alt="" loading="lazy" />
						{/if}
						<span class="gear-title">{g.label}</span>
						<span class="gear-count mono">{g.flags.filter(Boolean).length}/{g.items.length}</span>
					</a>
					<ul class="gear">
						{#each g.items as item, i (item.name)}
							<li class:locked={!g.flags[i]} title={item.desc ?? undefined}>
								<span class="tick">{g.flags[i] ? '✓' : '·'}</span>{item.name}
							</li>
						{/each}
					</ul>
				{/each}
			</div>
		{/if}
		<a class="backlink" href="/players">← All players</a>
	</aside>
</div>

<style>
	/* The rows scroll inside the section, not the page: this table sits
	   under a profile and beside an aside, so it cannot take the viewport
	   the way /players does. Capped so a full page of rows never pushes
	   the rest of the profile out of reach. */
	.histrows {
		max-height: min(62vh, 620px);
		overflow: auto;
	}
	.histrows thead th {
		position: sticky;
		top: 0;
		z-index: 1;
		background: var(--surface, var(--bg));
		box-shadow: inset 0 -1px 0 var(--border);
	}

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

	/* ---------- class roster grid ---------- */
	.mosgrid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(86px, 1fr));
		gap: 10px;
	}
	.mosbox {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		text-decoration: none;
		color: var(--ink-2);
	}
	.mosbox.locked {
		opacity: 0.3;
	}
	.mosbox.locked .mos-img {
		filter: grayscale(1);
	}
	.mos-img {
		width: 64px;
		height: 64px;
		object-fit: cover;
		border-radius: var(--r-sm);
		border: 1px solid var(--border);
	}
	.mos-name {
		font-size: 10.5px;
		text-align: center;
		line-height: 1.2;
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
	.decal-img {
		object-fit: contain;
		box-sizing: border-box;
		padding: 7px;
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
	tr.gap td {
		padding-top: 3px;
		padding-bottom: 3px;
		background: var(--surface);
	}
	.gapinfo {
		font: 500 10.5px/1.6 var(--mono);
		color: var(--ink-3);
		white-space: nowrap;
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
	.idhead {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 6px 14px 4px;
	}
	.portrait-lg {
		width: 56px;
		height: 56px;
		border-radius: var(--r-sm);
		object-fit: cover;
		border: 1px solid var(--border-strong);
		flex-shrink: 0;
	}
	.idtext {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}
	.idname {
		font-size: 15px;
		font-weight: 650;
		letter-spacing: -0.01em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.idclan {
		color: var(--ink-3);
		font-size: 13px;
		font-weight: 500;
		margin-right: 5px;
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
	.idhead .you {
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--accent);
		text-decoration: none;
		margin-left: 4px;
	}
	.idhead .you:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.box-label {
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-3);
		padding: 4px 14px 2px;
	}
	.gear-head {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 14px 3px;
		text-decoration: none;
		color: inherit;
	}
	.gear + .gear-head {
		border-top: 1px solid var(--border);
		margin-top: 5px;
		padding-top: 10px;
	}
	.gear-head:hover .gear-title {
		color: var(--accent);
	}
	.gear-mos {
		width: 24px;
		height: 24px;
		object-fit: cover;
		border-radius: 4px;
		flex: none;
	}
	.gear-title {
		font-size: 12.5px;
		font-weight: 650;
		flex: 1;
		min-width: 0;
	}
	.gear-count {
		font-size: 10px;
		color: var(--ink-3);
	}
	.gear {
		padding: 2px 14px 6px;
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
