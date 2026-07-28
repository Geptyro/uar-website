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
	import { medals, camos, decals, type Camo, type Decal, type Medal } from '$lib/unlocks';
	import { skillIdentifiers, mosById, mosList, siXpLabel, type Si } from '$lib/mos';
	import anonPortrait from '$lib/assets/anon-portrait.svg';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import Pager from '$lib/components/Pager.svelte';
	import OutcomeMark from '$lib/components/OutcomeMark.svelte';
	import ModeMark from '$lib/components/ModeMark.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { playerDescription } from '$lib/seo';
	import { fmtDuration } from '$lib/outcome';

	let { data } = $props();

	// A long-standing player has hundreds of games, so the server sends one
	// page of history rather than all of it. What arrives is still oldest
	// first (that ordering is what makes the per-row deltas work) and is read
	// newest first: rows descend from the end of the slice. `historyRows`
	// excludes the extra newer sighting the slice carries so that the top row
	// still has a next game to diff against.
	const shownHistory = $derived.by(() =>
		Array.from({ length: data.historyRows }, (_, i) => data.historyRows - 1 - i)
	);
	const p = $derived(data.player);

	// Retention pins every player's latest replay (see lib/replayRetention.ts),
	// so this file is the one blob we guarantee is still downloadable — which
	// is what makes it usable as a progression backup. It comes from the server
	// because it is not on every page of the history.
	const latestReplay = $derived(data.latestFile);

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

	// `num` is the 1-based mode number the rest of the site keys off (see
	// lib/mode.ts) — winsByMode is aligned with modeNames, so it is the index
	// plus one, and it is what ModeMark and the --mode-* tokens both want
	const modes = $derived(
		modeNames
			.map((name, i) => ({ name, num: i + 1, wins: p.winsByMode[i] ?? 0 }))
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

	/* Unlock grids: every tile is a hover/tap card carrying what the game says
	   about the thing plus this player's standing on it, and a way through to
	   the page it lives on. The body is joined with newlines — .tt-text is
	   pre-line, so each fact gets its own row. A class is the only one of the
	   five with a page of its own; the rest send you to their section index,
	   which is where their detail is written. */
	const lines = (...bits: (string | false | null | undefined)[]) =>
		bits.filter(Boolean).join('\n');

	/** The class's own page carries the in-game prose; the card carries the gate.
	    A few classes are named after their MOS code (AMX S-880), so the code is
	    dropped rather than printed back at the heading it already is. */
	const classTip = (c: (typeof classRoster)[number]) =>
		lines(
			[c.m.mos && c.m.mos !== c.m.name && `MOS ${c.m.mos}`, c.m.role]
				.filter(Boolean)
				.join(' · '),
			c.unlocked ? 'Unlocked' : c.req ? `Locked — unlocks at ${c.req}` : 'Locked'
		);

	const medalTip = (m: Medal) =>
		lines(
			m.desc,
			m.xp.length > 0 && `Awards ${m.xp.map((x) => x.toLocaleString('en')).join(' / ')} XP.`,
			medalsUnlocked.has(m.num) ? 'Earned' : 'Not earned yet'
		);

	const siTip = (s: Si) =>
		lines(
			s.desc,
			siXpLabel(s) ? `Unlocks at ${siXpLabel(s)} XP` : s.special && 'Special achievement unlock',
			sisUnlocked.has(s.num) ? 'Unlocked' : 'Locked'
		);

	const camoTip = (c: Camo) =>
		lines(
			c.req,
			c.adaptive && 'Adaptive: cycles terrain textures instead of a fixed pattern.',
			c.walker && 'Also selectable on the FP500 Combat Walker.',
			p.camo === c.num ? 'Equipped' : camosUnlocked.has(c.num) ? 'Unlocked' : 'Locked'
		);

	const decalTip = (d: Decal) =>
		lines(
			d.req,
			p.decal === d.num ? 'Equipped' : decalsUnlocked.has(d.num) ? 'Unlocked' : 'Locked'
		);

	// Counted across every game the player has ever played, so it is tallied
	// when the profile is rebuilt rather than from the history on this page.
	const classesPlayed = $derived(
		Object.entries(data.classGames)
			.sort((a, b) => b[1] - a[1])
			.map(([id, games]) => ({ id, games, info: mosById.get(id) }))
	);

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

	function fmtPlaytime(seconds: number): string {
		if (seconds >= 3600) {
			const h = seconds / 3600;
			return `${h >= 10 ? Math.round(h) : h.toFixed(1)} h`;
		}
		return `${Math.max(1, Math.round(seconds / 60))} min`;
	}
</script>

<Seo
	title="{p.name} — Players"
	description={playerDescription({
		name: p.name,
		clan: p.clan,
		gamesPlayed: p.gamesPlayed,
		prestige: p.prestige,
		wins: totalWins(p)
	})}
/>

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

		<!-- Left column stacks the two things counted over a whole career; the
		     right one holds the classes those games were played as. -->
		<div class="duo boards">
			{#if modes.length || data.teammates.length}
				<div class="stack">
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
												<td><ModeMark mode={m.num} /></td>
												<td class="num">{m.wins.toLocaleString('en')}</td>
												<td class="barcell">
													<div
														class="modebar"
														style="width: {(m.wins / modes[0].wins) *
															100}%; --bar: var(--mode-{m.num})"
													></div>
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

					{#if data.teammates.length}
						<section>
							<h2 class="section">Played with</h2>
							<div class="tablewrap">
								<table class="data modes">
									<thead>
										<tr><th>Player</th><th class="num">Time</th><th></th></tr>
									</thead>
									<tbody>
										{#each data.teammates as t (t.toon || t.name)}
											<tr>
												<td>
													<img
														class="pportrait"
														src={t.avatarUrl || anonPortrait}
														alt=""
														loading="lazy"
													/>
													{#if t.clan}<span class="pclan">&lt;{t.clan}&gt;</span>{/if}
													{#if t.toon}
														<a class="pname" href="/players/{t.toon}">{t.name}</a>
													{:else}
														<span class="pname">{t.name}</span>
													{/if}
												</td>
												<td class="num" title="{t.games} game{t.games === 1 ? '' : 's'} together">
													{fmtPlaytime(t.seconds)}
												</td>
												<td class="barcell">
													<div
														class="modebar"
														style="width: {(100 * t.seconds) / data.teammates[0].seconds}%"
													></div>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
							<p class="top-note">
								Recorded time in games shared with {p.name}, across ingested replays. Hover a row for
								the game count.
							</p>
						</section>
					{/if}
				</div>
			{/if}

			{#if classesPlayed.length}
				<section>
					<h2 class="section">Classes played</h2>
					<div class="tablewrap">
						<table class="data modes">
							<thead>
								<tr><th>Class</th><th class="num">Games</th><th></th></tr>
							</thead>
							<tbody>
								{#each classesPlayed as c (c.id)}
									<tr>
										<td class="classcell">
											{#if c.info}
												<a class="classlink" href="/mos/{c.id}" title={c.info.name}>
													{#if c.info.icon}<img
															class="class-icon"
															src={c.info.icon}
															alt=""
															loading="lazy"
														/>{/if}
													<span class="class-name">{c.info.name}</span>
												</a>
											{:else}
												<span class="class-name">{c.id}</span>
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

		<!-- Two pairs that read across rather than down: what you may play beside
		     what you may play it with, then the two things you wear. One grid
		     shape and one tile size throughout, so a column break lands on the
		     same rhythm on both sides. -->
		<div class="duo">
			<section>
				<h2 class="section">
					Classes unlocked <span class="counthint">{unlockedClasses} / {classRoster.length}</span>
				</h2>
				<div class="ugrid">
					{#each classRoster as c (c.m.id)}
						<Tooltip
							label={c.m.name}
							text={classTip(c)}
							href="/mos/{c.m.id}"
							linkText="Class page"
							placement="entry"
						>
							<span class="utile" class:locked={!c.unlocked}>
								{#if c.m.icon}
									<img class="uimg" src={c.m.icon} alt="" loading="lazy" />
								{:else}
									<span class="uimg placeholder"></span>
								{/if}
								<span class="uname">{c.m.name}</span>
							</span>
						</Tooltip>
					{/each}
				</div>
				<p class="note"><a href="/mos">Compare all classes →</a></p>
			</section>

			<section>
				<h2 class="section">
					Skill Identifiers
					<span class="counthint">{p.unlocks.sis.length} / {sisSorted.length}</span>
				</h2>
				<div class="ugrid">
					{#each sisSorted as s (s.num)}
						<Tooltip
							label="{s.name} · {s.code}"
							text={siTip(s)}
							href="/si"
							linkText="All Skill Identifiers"
							placement="entry"
						>
							<span class="utile" class:locked={!sisUnlocked.has(s.num)}>
								{#if s.icon}
									<img class="uimg fit" src={s.icon} alt="" loading="lazy" />
								{:else}
									<span class="uimg placeholder"></span>
								{/if}
								<span class="uname">{s.name}</span>
								<span class="ucode mono">{s.code}</span>
							</span>
						</Tooltip>
					{/each}
				</div>
				<p class="note"><a href="/si">All Skill Identifiers →</a></p>
			</section>
		</div>

		<div class="duo">
			<section>
				<h2 class="section">
					Medals <span class="counthint">{p.unlocks.medals.length} / {medals.length}</span>
				</h2>
				<div class="ugrid">
					{#each medals as m (m.num)}
						<Tooltip
							label={m.name}
							text={medalTip(m)}
							href="/medals"
							linkText="All medals & decals"
							placement="entry"
						>
							<span class="utile" class:locked={!medalsUnlocked.has(m.num)}>
								{#if m.icon}
									<img class="uimg fit" src={m.icon} alt="" loading="lazy" />
								{:else}
									<span class="uimg placeholder star">★</span>
								{/if}
								<span class="uname">{m.name}</span>
							</span>
						</Tooltip>
					{/each}
				</div>
			</section>

			<section>
				<h2 class="section">
					Decals <span class="counthint">{decalsUnlocked.size} / {decals.length}</span>
				</h2>
				<div class="ugrid">
					{#each decals as d (d.num)}
						<Tooltip
							label={decalName(d.num)}
							text={decalTip(d)}
							href="/medals"
							linkText="All medals & decals"
							placement="entry"
						>
							<span
								class="utile"
								class:locked={!decalsUnlocked.has(d.num)}
								class:worn={p.decal === d.num}
							>
								{#if d.icon}
									<img class="uimg fit pad" src={d.icon} alt="" loading="lazy" />
								{:else}
									<span class="uimg placeholder"></span>
								{/if}
								<span class="uname">{decalName(d.num)}</span>
							</span>
						</Tooltip>
					{/each}
				</div>
			</section>
		</div>
		<!-- both halves above land on the same page, so they share one way out -->
		<p class="note"><a href="/medals">All medals & decals →</a></p>

		<h2 class="section">
			Camouflages <span class="counthint">{p.unlocks.camos.length} / {camos.length}</span>
		</h2>
		<div class="ugrid">
			{#each camos as c (c.num)}
				<Tooltip label={c.name} text={camoTip(c)} href="/camos" linkText="All camouflages">
					<span
						class="utile"
						class:locked={!camosUnlocked.has(c.num)}
						class:worn={p.camo === c.num}
					>
						{#if c.swatch}
							<img class="uimg swatch" src={c.swatch} alt="" loading="lazy" />
						{:else}
							<span class="uimg placeholder"></span>
						{/if}
						<span class="uname">{c.name}</span>
					</span>
				</Tooltip>
			{/each}
		</div>
		<p class="note"><a href="/camos">All camouflages →</a></p>
	</div>

	<!-- The rows are eleven columns wide, so they run the whole layout rather
	     than the content column: it sits below the aside, not beside it. -->
	<section class="history">
		<h2 class="section">Replay history</h2>
		<Pager
			page={data.historyPage}
			pages={data.historyPages}
			total={data.historyTotal}
			label="replays"
			param="h"
		/>
		<div class="tablewrap histrows">
			<table class="data">
				<thead>
					<tr>
						<th>Game date</th>
						<th title="Won, lost, or not known yet">Result</th>
						<th title="The mode the lobby voted at the start of the game">Mode</th>
						<th class="num">Length</th>
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
									colspan="5"
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
						{@const facts = data.replayFacts[h.file]}
						<tr>
							<td class="mono">
								<a href="/replays/{h.file.replace(/\.SC2Replay$/, '')}" title="View replay"
									>{fmtDate(h.playedAt)}</a
								>
							</td>
							<td class="histresult">
								{#if facts?.outcome}<OutcomeMark outcome={facts.outcome} />{:else}<span
										class="unknown"
										title="Not known yet — this game's recording stopped early and no later game has been uploaded"
										>·</span
									>{/if}
							</td>
							<td class="histmode">
								{#if facts?.mode}<ModeMark mode={facts.mode} />{:else}<span
										class="unknown"
										title="Not known yet — this game was lost, or its recording stopped before the vote closed"
										>·</span
									>{/if}
							</td>
							<td class="num mono">{facts ? fmtDuration(facts.durationLoops) : ''}</td>
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
	</section>

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

			{#if latestReplay}
				<a class="dl-latest" href="/replays/{latestReplay}" download rel="external">
					Download latest replay ⬇
				</a>
			{/if}
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
	/* The rows scroll inside the section, not the page: this table sits at
	   the foot of a profile, so it cannot take the viewport the way /players
	   does. Capped so a full page of rows never pushes the pager and the
	   rest of the profile out of reach. */
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

	/* Profile beside its aside, with the replay table on its own row under
	   both — placed explicitly so the table can run the full width while the
	   markup keeps reading main-then-aside. */
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 290px;
		gap: 0 28px;
		align-items: start;
	}
	.main {
		grid-area: 1 / 1;
		min-width: 0;
	}
	.infobox {
		grid-area: 1 / 2;
	}
	.history {
		grid-area: 2 / 1 / auto / -1;
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
		grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
		gap: 12px;
	}
	.rankcard {
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: var(--card-pad-y) var(--card-pad-x);
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

	/* ---------- wins by mode + played with + classes played ---------- */
	.duo {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr));
		gap: 0 24px;
		align-items: start;
	}
	/* one grid cell, two sections down it — the wrapper is what keeps them in
	   the same column instead of letting auto-fit reflow them side by side */
	.stack {
		min-width: 0;
	}
	/* three boards in two columns need the label to belong to what is under
	   it more plainly than a single run of sections does */
	.boards h2 {
		margin-top: 46px;
	}
	table.modes {
		width: 100%;
	}
	/* The label reads at its own width and the count at its own digits, so
	   everything left over goes to the bar — the part worth having long. Each
	   board's bars are read against its own top row and never across boards,
	   so the three not lining up column-for-column costs nothing. */
	table.modes th:first-child,
	table.modes td:first-child {
		width: 1%;
		white-space: nowrap;
	}
	table.modes .num {
		width: 1%;
	}
	.barcell {
		width: 100%;
		min-width: 90px;
	}
	.classcell a {
		font-weight: 600;
	}
	/* On a phone the class name gives way to its icon — the bar and the count
	   carry the row, and the tables stay inside the content column. A player
	   keeps their name: it is the row, and there is no icon that says it. */
	@media (max-width: 899.98px) {
		.classlink .class-name {
			display: none;
		}
	}
	/* One bar for the three boards. Wins by mode passes --bar so each row is
	   drawn in its own mode's colour, the same ramp the icons carry; the other
	   two boards set nothing and stay on the accent. */
	.modebar {
		height: 8px;
		border-radius: 2px;
		background: var(--bar, var(--accent));
		opacity: 0.55;
		min-width: 2px;
	}
	tr.total td {
		font-weight: 650;
		border-top: 1px solid var(--border);
	}

	/* ---------- played with ----------
	   Same three-column row as the two boards it sits with: who, how much,
	   and a bar read against the top row. The order is the ranking, so no
	   position number is printed. */
	.pportrait {
		width: 22px;
		height: 22px;
		border-radius: 3px;
		object-fit: cover;
		border: 1px solid var(--border);
		vertical-align: middle;
		margin-right: 4px;
	}
	.pclan {
		color: var(--ink-3);
		font-size: 11px;
		margin-right: 3px;
	}
	.pname {
		font-weight: 600;
	}
	.top-note {
		margin: 10px 0 0;
		font-size: 11px;
		line-height: 1.5;
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
	.histresult {
		width: 1%;
		white-space: nowrap;
	}
	.histresult .unknown {
		color: var(--ink-3);
		cursor: help;
	}
	/* the mode is unknown for a lost game nobody has a later save of, which is
	   why the column carries the same middle dot the Result column does */
	.histmode {
		width: 1%;
		white-space: nowrap;
	}
	.histmode .unknown {
		color: var(--ink-3);
		cursor: help;
	}

	/* ---------- unlock grids: classes, SIs, medals, camos, decals ----------
	   One shape for the five. They were three copies of the same rules before
	   medals and the SIs joined them, and more copies is not the way to add
	   one. What differs between them is the picture: cover for a portrait or a
	   swatch, contain for a medal, an SI or a decal that has to keep its own
	   shape. The one size is what lets the paired sections line up. */
	.ugrid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(86px, 1fr));
		gap: 10px;
		cursor: pointer;
	}
	/* the tile is wrapped by Tooltip's own anchor — it must fill that box
	   rather than sit in the middle of it */
	.ugrid :global(.tt) {
		width: 100%;
		align-items: stretch;
	}
	.utile {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		width: 100%;
		color: var(--ink-2);
	}
	.utile.locked {
		opacity: 0.3;
	}
	.utile.locked .uimg {
		filter: grayscale(1);
	}
	.utile.worn .uimg {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
	.uimg {
		width: 64px;
		height: 64px;
		object-fit: cover;
		border-radius: var(--r-sm);
		border: 1px solid var(--border);
	}
	/* a swatch is a flat texture: the dark bed keeps a light one readable */
	.uimg.swatch {
		background: #101010;
	}
	.uimg.fit {
		object-fit: contain;
	}
	.uimg.pad {
		box-sizing: border-box;
		padding: 7px;
	}
	.uimg.placeholder {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--surface-2);
		color: var(--ink-3);
	}
	.uimg.placeholder.star {
		font-size: 26px;
		line-height: 1;
	}
	.uname {
		font-size: 10.5px;
		text-align: center;
		line-height: 1.2;
	}
	/* an SI is known by its two letters as much as by its name */
	.ucode {
		font-size: 9.5px;
		color: var(--ink-3);
		text-align: center;
		margin-top: -1px;
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
	.dl-latest {
		display: block;
		margin: 10px 14px 0;
		padding: 7px 12px;
		border-radius: var(--r-sm);
		background: var(--accent);
		color: var(--on-accent);
		font-weight: 650;
		font-size: 12px;
		text-align: center;
		text-decoration: none;
	}
	.dl-latest:hover {
		background: var(--accent-hover);
	}
	.idhead {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 6px var(--card-pad-x) 4px;
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
		padding: 0 var(--card-pad-x);
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
		padding: 4px var(--card-pad-x) 2px;
	}

	.gear-head {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px var(--card-pad-x) 3px;
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
		padding: 2px var(--card-pad-x) 6px;
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
		/* stacked, the profile card leads: it is what you came to see, and it
		   should not sit under a screenful of rank cards */
		.infobox {
			grid-area: 1 / 1;
			margin: 0 0 18px;
		}
		.main {
			grid-area: 2 / 1;
		}
		.history {
			grid-area: 3 / 1;
		}
	}
</style>
