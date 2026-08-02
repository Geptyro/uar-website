<script lang="ts">
	/**
	 * A profile's overview: how far this player has got, and who and what they
	 * played to get there. The collection and the games behind it are their own
	 * tabs — see $lib/playerTabs.ts for why.
	 */
	import { rankFor, nextRank, totalWins, modeNames, XP_CAP } from '$lib/players';
	import { mosById } from '$lib/mos';
	import anonPortrait from '$lib/assets/anon-portrait.svg';
	import ModeMark from '$lib/components/ModeMark.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { playerDescription } from '$lib/seo';

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

	// `num` is the 1-based mode number the rest of the site keys off (see
	// lib/mode.ts) — winsByMode is aligned with modeNames, so it is the index
	// plus one, and it is what ModeMark and the --mode-* tokens both want
	const modes = $derived(
		modeNames
			.map((name, i) => ({ name, num: i + 1, wins: p.winsByMode[i] ?? 0 }))
			.filter((m) => m.wins > 0)
			.sort((a, b) => b.wins - a.wins)
	);

	// Counted across every game the player has ever played, so it is tallied
	// when the profile is rebuilt rather than from a page of history.
	const classesPlayed = $derived(
		Object.entries(data.classGames)
			.sort((a, b) => b[1] - a[1])
			.map(([id, games]) => ({ id, games, info: mosById.get(id) }))
	);

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
						<table class="data board">
							<thead>
								<tr><th>Mode</th><th class="num">Wins</th><th class="barcell"></th></tr>
							</thead>
							<tbody>
								{#each modes as m (m.name)}
									<tr>
										<td><ModeMark mode={m.num} /></td>
										<td class="num">{m.wins.toLocaleString('en')}</td>
										<td class="barcell">
											<div
												class="boardbar"
												style="width: {(m.wins / modes[0].wins) * 100}%; --bar: var(--mode-{m.num})"
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
						<table class="data board">
							<thead>
								<tr>
									<th class="pos">#</th>
									<th>Player</th>
									<th class="num">Time</th>
									<th class="barcell"></th>
								</tr>
							</thead>
							<tbody>
								{#each data.teammates as t, i (t.toon || t.name)}
									<tr>
										<td class="pos">{i + 1}</td>
										<td class="figcell">
											<img class="figimg" src={t.avatarUrl || anonPortrait} alt="" loading="lazy" />
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
												class="boardbar"
												style="width: {(100 * t.seconds) / data.teammates[0].seconds}%"
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
	{/if}

	{#if classesPlayed.length}
		<section>
			<h2 class="section">Classes played</h2>
			<div class="tablewrap">
				<table class="data board">
					<thead>
						<tr>
							<th class="pos">#</th>
							<th>Class</th>
							<th class="num">Games</th>
							<th class="barcell"></th>
						</tr>
					</thead>
					<tbody>
						{#each classesPlayed as c, i (c.id)}
							<tr>
								<td class="pos">{i + 1}</td>
								<td class="figcell classcell">
									{#if c.info}
										<a class="classlink" href="/mos/{c.id}" title={c.info.name}>
											{#if c.info.icon}
												<img class="figimg" src={c.info.icon} alt="" loading="lazy" />
											{:else}
												<span class="figimg placeholder"></span>
											{/if}
											<span class="class-name">{c.info.name}</span>
										</a>
									{:else}
										<span class="figimg placeholder"></span>
										<span class="class-name">{c.id}</span>
									{/if}
								</td>
								<td class="num">{c.games}</td>
								<td class="barcell">
									<div
										class="boardbar"
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

<style>
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
		color: var(--text-faint);
	}
	.rc-rank {
		font-weight: 650;
		font-size: 13.5px;
	}
	.rc-prefix {
		color: var(--text-dim);
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
		color: var(--text-faint);
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
	/* the longest class name is 25 characters — under about this width the
	   picture, the name, the count and the bar stop fitting on one row */
	.duo.boards {
		grid-template-columns: repeat(auto-fit, minmax(min(360px, 100%), 1fr));
	}
	/* the board table itself is a global primitive (see the root +layout.svelte);
	   what is left here is only what these three boards say on top of it */
	.classcell a {
		font-weight: 600;
	}
	tr.total td {
		font-weight: 650;
		border-top: 1px solid var(--border);
	}

	/* ---------- played with ----------
	   Same three-column row as the two boards it sits with: who, how much,
	   and a bar read against the top row. */
	.pclan {
		color: var(--text-faint);
		font-size: 11px;
		margin-right: 3px;
	}
	.pname {
		font-weight: 600;
	}

	/* On a phone the class name gives way to its icon — the bar and the count
	   carry the row. A player keeps their name: it is the row, and there is no
	   icon that says it. */
	@media (max-width: 899.98px) {
		.classlink .class-name {
			display: none;
		}
	}
</style>
