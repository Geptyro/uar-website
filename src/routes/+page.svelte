<script lang="ts">
	import { units, categories, categoryCount, weaponLabel } from '$lib/units';
	import StatIcon from '$lib/components/StatIcon.svelte';
	// the widget itself drops `minor` entries — "a player would not notice
	// unless told" is what that field means, not a call each site re-makes
	import { Page, WhatsNew } from 'sveltekit-commons';
	import { latestRelease } from '$lib/changelog-data';
	import DescCard from '$lib/components/DescCard.svelte';
	import ActivityChart from '$lib/components/ActivityChart.svelte';
	import RecentGames from '$lib/components/RecentGames.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import anonPortrait from '$lib/assets/anon-portrait.svg';

	let { data } = $props();

	const COMPANION_REPO = 'https://github.com/Geptyro/uar-companion';

	const unitById = new Map(units.map((u) => [u.id, u]));

	const mosUnits = units
		.filter(
			(u) =>
				u.category === 'MOS (player class)' &&
				u.id !== 'SiegeTankSieged' &&
				u.id !== 'TemplateMOS'
		)
		.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

	const bosses = units
		.filter((u) => u.category === 'undead / hostile' && (u.life ?? 0) >= 10000)
		.sort((a, b) => (b.life ?? 0) - (a.life ?? 0));
</script>

<Page>
	<!-- the one page whose title is the brand rather than its subject -->
	<Seo
		description="Undead Assault Reborn, the StarCraft II arcade map: every player class, undead, item and weapon, plus player profiles, clans, replays and a companion app."
	/>

	<div class="layout">
	<div class="main">
	{#if data.weekly.xp.length || data.weekly.classPicks.length}
		<h2 class="section">This week · last 7 days</h2>
		<div class="boards">
			{#if data.weekly.xp.length}
				<div class="tablewrap">
					<table class="data board">
						<thead>
							<tr>
								<th class="pos">#</th>
								<th>Player</th>
								<th class="num">XP gained</th>
								<th class="barcell"></th>
							</tr>
						</thead>
						<tbody>
							{#each data.weekly.xp as p, i (p.toon || p.name)}
								<tr>
									<td class="pos">{i + 1}</td>
									<td class="figcell">
										<img
											class="figimg"
											src={(p.toon && data.avatars[p.toon]) || anonPortrait}
											alt=""
											loading="lazy"
										/>
										{#if p.clan}<span class="pclan">&lt;{p.clan}&gt;</span>{/if}
										{#if p.toon}
											<a class="pname" href="/players/{p.toon}">{p.name}</a>
										{:else}
											<span class="pname">{p.name}</span>
										{/if}
									</td>
									<td class="num" title="{p.games} game{p.games === 1 ? '' : 's'} this week">
										+{p.xpGained.toLocaleString('en')}
									</td>
									<td class="barcell">
										<div
											class="boardbar"
											style="width: {(100 * p.xpGained) / data.weekly.xp[0].xpGained}%"
										></div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
			{#if data.weekly.classPicks.length}
				<div class="tablewrap">
					<table class="data board">
						<thead>
							<tr>
								<th class="pos">#</th>
								<th>Class</th>
								<th class="num">Picks</th>
								<th class="barcell"></th>
							</tr>
						</thead>
						<tbody>
							{#each data.weekly.classPicks as c, i (c.mos)}
								{@const u = unitById.get(c.mos)}
								<tr>
									<td class="pos">{i + 1}</td>
									<td class="figcell">
										{#if u?.icon}
											<img class="figimg" src={u.icon} alt="" loading="lazy" />
										{:else}
											<span class="figimg placeholder"></span>
										{/if}
										<a class="pname" href="/mos/{c.mos}">{u?.name || c.mos}</a>
									</td>
									<td class="num" title="times picked in ingested games this week">{c.picks}</td>
									<td class="barcell">
										<div
											class="boardbar"
											style="width: {(100 * c.picks) / data.weekly.classPicks[0].picks}%"
										></div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}

	{#if data.activity.values.some((v) => v > 0)}
		<h2 class="section">Activity · last 7 days</h2>
		<DescCard label="Players in game">
			<ActivityChart timeline={data.activity} />
		</DescCard>
		<p class="top-note">
			Average players in game per half hour, from ingested replays · times shown in your local
			timezone.
		</p>
	{/if}

	<h2 class="section">MOS · Player classes</h2>
	<div class="cards">
		{#each mosUnits as u (u.id)}
			<a class="card mos-card" href="/mos/{u.id}">
				{#if u.icon}
					<img class="card-icon" src={u.icon} alt="" loading="lazy" />
				{:else}
					<span class="card-icon placeholder"></span>
				{/if}
				<div class="card-body">
					<h3>{u.name || u.id}</h3>
					<div class="code">{u.mos ? `MOS ${u.mos}` : u.id}{u.role ? ` · ${u.role}` : ''}</div>
					<div class="kv">
						<span><StatIcon name="life" size={12} /><b>{u.life ?? '–'}</b></span>
						<span><StatIcon name="armor" size={12} /><b>{u.armor ?? '–'}</b></span>
						<span><StatIcon name="speed" size={12} /><b>{u.speed ?? '–'}</b></span>
					</div>
				</div>
			</a>
		{/each}
	</div>

	<h2 class="section">Heavy hostiles · 10,000+ HP</h2>
	<div class="tablewrap">
		<table class="data" style="min-width: 640px">
			<thead>
				<tr>
					<th>Name</th>
					<th class="num">Life</th>
					<th class="num">Armor</th>
					<th class="num">Speed</th>
					<th>Weapons</th>
				</tr>
			</thead>
			<tbody>
				{#each bosses as u (u.id)}
					<tr>
						<td><a href="/entities/{u.id}">{u.name || u.id}</a></td>
						<td class="num">{u.life?.toLocaleString('en')}</td>
						<td class="num">{u.armor ?? ''}</td>
						<td class="num">{u.speed ?? ''}</td>
						<td class="mono">{u.weapons.map(weaponLabel).join('; ')}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	</div>

	<aside class="infobox">
		<!-- Signed out, the boards above are a list of other people: your own row is
		     in them somewhere and nothing says so. That is the first thing to fix,
		     so this heads the column and the companion card follows it — blue, the
		     tone the account chip already owns in the top bar, so the two asks read
		     as two different things rather than one shouted twice. -->
		{#if data.showConnect}
			<div class="promo connect">
				<a class="promo-main" href="/auth/bnet">
					<span class="promo-label">
						<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<path
								d="M18.94 8.296C15.9 6.892 11.534 6 7.426 6.332c.206-1.36.714-2.308 1.548-2.508 1.148-.275 2.4.48 3.594 1.854.782.102 1.71.28 2.355.429C12.747 2.013 9.828-.282 7.607.565c-1.688.644-2.553 2.97-2.448 6.094-2.2.468-3.915 1.3-5.013 2.495-.056.065-.181.227-.137.305.034.058.146-.008.194-.04 1.274-.89 2.904-1.373 5.027-1.676.303 3.333 1.713 7.56 4.055 10.952-1.28.502-2.356.536-2.946-.087-.812-.856-.784-2.318-.19-4.04a26.764 26.764 0 0 1-.807-2.254c-2.459 3.934-2.986 7.61-1.143 9.11 1.402 1.14 3.847.725 6.502-.926 1.505 1.672 3.083 2.74 4.667 3.094.084.015.287.043.332-.034.034-.06-.08-.124-.131-.149-1.408-.657-2.64-1.828-3.964-3.515 2.735-1.929 5.691-5.263 7.457-8.988 1.076.86 1.64 1.773 1.398 2.595-.336 1.131-1.615 1.84-3.403 2.185a27.697 27.697 0 0 1-1.548 1.826c4.634.16 8.08-1.22 8.458-3.565.286-1.786-1.295-3.696-4.053-5.17.696-2.139.832-4.04.346-5.588-.029-.08-.106-.27-.196-.27-.068 0-.067.13-.063.187.135 1.547-.263 3.2-1.062 5.19zm-8.533 9.869c-1.96-3.145-3.09-6.849-3.082-10.594 3.702-.124 7.474.748 10.714 2.627-1.743 3.269-4.385 6.1-7.633 7.966h.001z"
							/>
						</svg>
						Your profile
					</span>
					<!-- the boards on this page already count them, so the ask is to claim
					     a page that exists rather than to make an account. "Your stats are
					     here" would be the louder line and a lie to anyone who has not
					     played yet — this one is true either way. -->
					<strong class="promo-title">Claim your player page.</strong>
					<span class="promo-text">
						Signing in with <b>Battle.net</b>:
					</span>
					<!-- same rule as the card below: one line each, verb first, near
					     enough the same length -->
					<ul class="promo-list">
						<li>links your StarCraft&nbsp;II profile</li>
						<li>keeps your page one click away</li>
						<li>flags you ready for the next game</li>
					</ul>
					<span class="promo-cta">Connect with Battle.net →</span>
				</a>
				<!-- the doubt about a login is what it hands over, so the answer sits
				     under the button — and it goes to /account, which spells the whole
				     of it out rather than asking for that much trust in one line -->
				<a class="promo-foot" href="/account">
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path
							fill-rule="evenodd"
							d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5Zm3 8H9V6a3 3 0 1 1 6 0v3Z"
						/>
					</svg>
					Battletag only — no password
				</a>
			</div>
		{/if}

		<!-- Every board on this page is only as good as the replays we get, so the
		     one thing a visitor can *do* about that heads the column — green and
		     filled, the only call to action on the page. -->
		<div class="promo">
			<a class="promo-main" href="/companion">
				<span class="promo-label">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
						stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<rect x="2" y="3" width="20" height="14" rx="2" />
						<line x1="8" y1="21" x2="16" y2="21" />
						<line x1="12" y1="17" x2="12" y2="21" />
					</svg>
					Help the stats
				</span>
				<!-- short enough to hold one line in a 290px column: at 13.5px the box
				     fits ~36 characters, and a headline that wraps to a two-word second
				     line is the loudest ragged edge on the card -->
				<strong class="promo-title">Every game counts — once uploaded.</strong>
				<span class="promo-text">
					<b>UAR Companion</b> is a tray app that:
				</span>
				<!-- one line each, verb first, near enough the same length: in a 290px
				     column a bullet that wraps leaves a short second line, and three of
				     those read as six ragged lines rather than three points -->
				<ul class="promo-list">
					<li>pings you when a lobby opens</li>
					<li>uploads your replays for you</li>
					<li>flags you ready in one click</li>
				</ul>
				<span class="promo-cta">Get the app — Windows, Linux, macOS →</span>
			</a>
			<!-- the app asks to run on their machine and watch their replay folder, so
			     the reassurance sits under the button where the doubt lands — and it
			     goes straight to the repo, so it can be checked rather than believed.
			     A real link, hence its own <a> beside (not inside) the card link. -->
			<a class="promo-foot" href={COMPANION_REPO} target="_blank" rel="noopener">
				<svg viewBox="0 0 16 16" aria-hidden="true">
					<path
						fill-rule="evenodd"
						d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
					/>
				</svg>
				Free &amp; open source on GitHub ↗
			</a>
		</div>

		<!-- Prestige is the rarest thing a player does, so it heads the boards,
		     then the games those boards were aggregated from, and what shipped
		     under them. Same 7-day window as the weekly boards. -->
		{#if data.weekly.prestiged.length}
			<section class="prestige">
				<div class="pr-label">
					<span class="pr-star" aria-hidden="true">★</span> Prestiged
					<span class="pr-when">· last 7 days</span>
				</div>
				<ul class="pr-list">
					{#each data.weekly.prestiged as p (p.toon || p.name)}
						<li class="pr-item">
							<img
								class="pr-portrait"
								src={(p.toon && data.avatars[p.toon]) || anonPortrait}
								alt=""
								loading="lazy"
							/>
							<span class="pr-who">
								{#if p.clan}<span class="pclan">&lt;{p.clan}&gt;</span>{/if}
								{#if p.toon}
									<a class="pname" href="/players/{p.toon}">{p.name}</a>
								{:else}
									<span class="pname">{p.name}</span>
								{/if}
							</span>
							<span class="pr-jump">P{p.from} <span class="pr-arrow">→</span></span>
							<b class="pr-level">P{p.to}</b>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if data.recent.length}
			<RecentGames games={data.recent} />
		{/if}

		<WhatsNew release={latestRelease} />

		<!-- the roster by category: a way in to /entities, not a headline -->
		<div class="tiles">
			{#each categories as cat (cat)}
				<a class="tile" href="/entities?cat={encodeURIComponent(cat)}">
					<b>{categoryCount(cat)}</b>
					<span>{cat}</span>
				</a>
			{/each}
		</div>
	</aside>
	</div>
</Page>

<style>
	/* the right column, the shape /mos and a player profile already use: a
	   fixed rail beside the page, and on a phone it comes first — what
	   happened this week is why you opened the site, and it should not sit
	   under the whole roster */
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 290px;
		gap: 0 28px;
		align-items: start;
	}
	.main {
		min-width: 0;
	}
	/* the column now opens on a section heading, and its 34px of top margin
	   is spacing between sections, not a gap under the top bar */
	.main :global(h2.section:first-child) {
		margin-top: 4px;
	}
	.infobox {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	/* in the column the counts line up in a grid rather than running on as a
	   wrapped row, so the last one is not left hanging half a tile wide */
	.infobox .tiles {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(125px, 100%), 1fr));
		gap: 10px;
	}
	/* Below this the rail would starve the tables, so the page stacks — and
	   stacked, the column leads. Its two widgets sit side by side while there
	   is room for them, one under the other on a phone. */
	@media (max-width: 1080px) {
		/* one column, still a grid: a column flex box would take align-items
		   from the rule above and size each half to its widest child instead
		   of the page, which is how the tables dragged a scrollbar onto the
		   whole page */
		.layout {
			grid-template-columns: minmax(0, 1fr);
		}
		.infobox {
			order: -1;
			margin: 0 0 18px;
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
			gap: 12px;
			align-items: start;
		}
	}

	/* The two asks in the column share one shape — a tinted card with a
	   coloured edge and a filled bar at its foot, so each reads as a button
	   and not another read-only widget. Only the tint tells them apart, and
	   it is the one thing a variant sets: green for the app, blue for the
	   account (the tone the top-bar chip already uses for it). */
	.promo {
		--tint: var(--accent);
		--tint-soft: var(--accent-soft);
		--tint-hover: var(--accent-dim);
		background:
			linear-gradient(150deg, color-mix(in srgb, var(--tint) 16%, transparent), transparent 65%),
			var(--tint-soft);
		border: 1px solid color-mix(in srgb, var(--tint) 45%, transparent);
		border-radius: var(--radius-3);
		padding: 10px var(--card-pad-x) 11px;
		/* the foot row bleeds to the card's edges — clip it to the radius */
		overflow: hidden;
	}
	.promo.connect {
		--tint: var(--mos);
		--tint-soft: var(--mos-soft);
		--tint-hover: var(--mos-hover);
	}
	/* the card itself never reacts: it holds two destinations now, so lifting the
	   whole thing under either one says "you are about to click this card" when
	   what you are about to click is one row of it */
	.promo-main {
		display: block;
		text-decoration: none;
		color: inherit;
	}
	.promo-label {
		display: flex;
		align-items: center;
		gap: 5px;
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 650;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--tint);
	}
	.promo-label svg {
		width: 13px;
		height: 13px;
		flex-shrink: 0;
	}
	/* two tight lines rather than a full line and one orphaned word — the card
	   is 290px and the headline is the only thing set at this size */
	.promo-title {
		display: block;
		margin: 6px 0 5px;
		font-size: 13.5px;
		font-weight: 650;
		line-height: 1.3;
		letter-spacing: -0.01em;
		color: var(--text);
		text-wrap: balance;
	}
	/* the lead-in and the bullets are one block of copy, so they share a size
	   and a leading — anything else reads as a jump between them */
	.promo-text {
		display: block;
		font-size: 12.5px;
		line-height: 1.45;
		color: var(--text-dim);
	}
	.promo-text b {
		color: var(--text);
		font-weight: 600;
	}
	.promo-list {
		list-style: none;
		margin: 7px 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 12.5px;
		line-height: 1.45;
		color: var(--text-dim);
	}
	/* the tick is a flex item aligned on the text's own baseline — hanging it
	   with position/top lands it wherever the glyph's box happens to start,
	   which is what left every mark sitting slightly high */
	.promo-list li {
		display: flex;
		align-items: baseline;
		gap: 7px;
		text-wrap: pretty;
	}
	.promo-list li::before {
		content: '✓';
		flex: none;
		width: 9px;
		font-size: 11px;
		font-weight: 700;
		color: var(--tint);
	}
	.promo-cta {
		display: block;
		margin-top: 10px;
		border-radius: var(--radius-2);
		background: var(--tint);
		color: var(--accent-contrast);
		padding: 7px 9px;
		font-size: 12px;
		font-weight: 600;
		text-align: center;
	}
	.promo-main:hover .promo-cta {
		background: var(--tint-hover);
	}
	/* a second, quieter destination under the button: hairline off the CTA so it
	   reads as part of the card, not a stray link under it */
	/* bled out to the card's edges so its hover is a band across the foot of the
	   card — an underline or a colour shift alone is too quiet to read as the
	   second clickable thing sitting under a filled button */
	.promo-foot {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		margin: 9px calc(-1 * var(--card-pad-x)) -11px;
		padding: 9px var(--card-pad-x) 11px;
		border-top: 1px solid color-mix(in srgb, var(--tint) 22%, transparent);
		border-radius: 0 0 calc(var(--radius-3) - 1px) calc(var(--radius-3) - 1px);
		font-size: 12.5px;
		font-weight: 550;
		line-height: 1.3;
		color: var(--text-dim);
		text-decoration: none;
		transition:
			background 140ms ease,
			color 140ms ease;
	}
	.promo-foot:hover {
		background: color-mix(in srgb, var(--tint) 20%, transparent);
		color: var(--tint);
	}
	.promo-foot svg {
		width: 14px;
		height: 14px;
		fill: currentColor;
		flex-shrink: 0;
	}

	/* the one place the site goes gold, with a sheen across it. In the column
	   it reads as a roll of honour: no box around anyone, just a hairline
	   between them and the new level as the one filled thing. */
	.prestige {
		background:
			linear-gradient(150deg, color-mix(in srgb, var(--gold) 10%, transparent), transparent 60%),
			var(--gold-soft);
		border: 1px solid var(--gold-line);
		border-radius: var(--radius-3);
		padding: 10px var(--card-pad-x) 11px;
	}
	.pr-label {
		display: inline-flex;
		align-items: baseline;
		gap: 5px;
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 650;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--gold);
		white-space: nowrap;
		margin-bottom: 4px;
	}
	.pr-star {
		font-size: 15px;
		line-height: 1;
		color: var(--gold);
	}
	.pr-when {
		font-weight: 400;
		color: var(--text-faint);
	}
	.pr-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
	}
	.pr-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 7px 0;
		font-size: 12.5px;
		min-width: 0;
	}
	.pr-item + .pr-item {
		border-top: 1px solid var(--gold-line);
	}
	.pr-who {
		display: flex;
		align-items: baseline;
		gap: 5px;
		min-width: 0;
		overflow: hidden;
	}
	/* name left, the jump right, whatever the column width */
	.pr-jump {
		margin-left: auto;
	}
	.pr-portrait {
		width: 24px;
		height: 24px;
		border-radius: var(--radius-2);
		object-fit: cover;
		/* a ring rather than a border: it cannot eat into the portrait */
		box-shadow: 0 0 0 1px var(--gold-line);
		flex-shrink: 0;
	}
	/* the name carries no underline until you go for it — this is a list of
	   people, and only one of them is the loud part */
	.pr-item .pname {
		color: inherit;
		text-decoration: none;
		font-weight: 600;
	}
	.pr-item .pname:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.pr-jump {
		font-family: var(--font-mono);
		font-size: 10.5px;
		color: var(--text-faint);
		white-space: nowrap;
	}
	.pr-arrow {
		opacity: 0.6;
	}
	.pr-level {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.02em;
		background: var(--gold);
		color: var(--bg);
		border-radius: var(--radius-2);
		padding: 2px 7px;
		white-space: nowrap;
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(250px, 100%), 1fr));
		gap: 12px;
	}
	.mos-card {
		display: flex;
		align-items: stretch;
		padding: 0;
		overflow: hidden;
	}
	.card-icon {
		width: 84px;
		align-self: stretch;
		object-fit: cover;
		flex-shrink: 0;
	}
	.card-icon.placeholder {
		background: var(--surface-raised);
	}
	.card-body {
		min-width: 0;
		padding: 12px 14px;
	}
	.mos-card h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		letter-spacing: -0.01em;
	}
	.code {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--mos);
		letter-spacing: 0.04em;
		margin: 1px 0 7px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.kv {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
		font-family: var(--font-mono);
		font-size: 10.5px;
		color: var(--text-faint);
		font-variant-numeric: tabular-nums;
	}
	.kv span {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.kv b {
		font-weight: 600;
		color: var(--text-dim);
	}
	.boards {
		display: grid;
		/* a row is a picture, a name, a count and a bar — the longest class name
		   is 25 characters, and under about this width the four stop fitting */
		grid-template-columns: repeat(auto-fit, minmax(min(360px, 100%), 1fr));
		gap: 12px;
		align-items: start;
	}
	/* The two boards are the board table from +layout.svelte — the same row a
	   player page draws for played-with and classes-played, and a class page
	   for its top players. */
	.figcell .pclan {
		margin-right: 3px;
	}
	.pclan {
		color: var(--text-faint);
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
	.top-note {
		margin: 10px 0 0;
		font-size: 11px;
		color: var(--text-faint);
	}
</style>
