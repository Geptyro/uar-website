<script lang="ts">
	/**
	 * Everything this player has unlocked: the classes they may pick, the
	 * Skill Identifiers, the medals, what they wear, and the vehicle gear
	 * ladders.
	 *
	 * All six read the same two things — the unlock sets on the profile, and the
	 * reference data every one of them is measured against — so they sit on one
	 * tab together. It is also the heaviest thing a profile draws: 108 tiles
	 * with their pictures, most of them locked, which is exactly what should not
	 * be on the canonical URL of someone who came to look at a rank.
	 */
	import { gearGroups, decalName } from '$lib/players';
	import { medals, camos, decals, type Camo, type Decal, type Medal } from '$lib/unlocks';
	import { skillIdentifiers, mosById, mosList, siXpLabel, type Si } from '$lib/mos';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { Page } from 'sveltekit-commons';

	let { data } = $props();

	const p = $derived(data.player);

	const sisUnlocked = $derived(new Set(p.unlocks.sis));
	const medalsUnlocked = $derived(new Set(p.unlocks.medals));
	const camosUnlocked = $derived(new Set(p.unlocks.camos));
	// num 0 (rank insignia) is everyone's default decal, never bank-stored
	const decalsUnlocked = $derived(new Set([0, ...p.unlocks.decals]));
	const sisSorted = [...skillIdentifiers].sort((a, b) => a.num - b.num);

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
					: reqs.flatMap((r, i) => (r?.xp ? [`${fmtXpShort(r.xp)} XP ${trackLabels[i]}`] : []));
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
	const lines = (...bits: (string | false | null | undefined)[]) => bits.filter(Boolean).join('\n');

	/** The class's own page carries the in-game prose; the card carries the gate.
	    A few classes are named after their MOS code (AMX S-880), so the code is
	    dropped rather than printed back at the heading it already is. */
	const classTip = (c: (typeof classRoster)[number]) =>
		lines(
			[c.m.mos && c.m.mos !== c.m.name && `MOS ${c.m.mos}`, c.m.role].filter(Boolean).join(' · '),
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
		lines(d.req, p.decal === d.num ? 'Equipped' : decalsUnlocked.has(d.num) ? 'Unlocked' : 'Locked');
</script>

<Page>
	<Seo
		title="{p.name} — Collection"
		description="Classes, Skill Identifiers, medals, decals, camouflages and vehicle gear unlocked by {p.name} in Undead Assault Reborn."
	/>

	<!-- Two pairs that read across rather than down: what you may play beside
	     what you may play it with, then the two things you wear. One grid shape
	     and one tile size throughout, so a column break lands on the same rhythm
	     on both sides. -->
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
						href="/career/si"
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
			<p class="note"><a href="/career/si">All Skill Identifiers →</a></p>
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
						href="/career/medals"
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
						href="/career/medals"
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
	<p class="note"><a href="/career/medals">All medals & decals →</a></p>

	<h2 class="section">
		Camouflages <span class="counthint">{p.unlocks.camos.length} / {camos.length}</span>
	</h2>
	<div class="ugrid">
		{#each camos as c (c.num)}
			<Tooltip label={c.name} text={camoTip(c)} href="/career/camos" linkText="All camouflages">
				<span class="utile" class:locked={!camosUnlocked.has(c.num)} class:worn={p.camo === c.num}>
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
	<p class="note"><a href="/career/camos">All camouflages →</a></p>

	<!-- The gear ladders were in the aside, where they were the one unlock set
	     that did not sit with the others. They are lists rather than grids
	     because each is an ordered ladder — a piece needs the ones before it. -->
	{#if playerGear.length}
		<h2 class="section">Vehicle gear</h2>
		<div class="gearcols">
			{#each playerGear as g (g.key)}
				<div class="card geargroup">
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
				</div>
			{/each}
		</div>
	{/if}
</Page>

<style>
	.counthint {
		font-family: var(--font-mono);
		font-size: 11.5px;
		font-weight: 400;
		color: var(--text-faint);
		margin-left: 6px;
	}
	.duo {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr));
		gap: 0 24px;
		align-items: start;
	}

	/* The top row gives back the spacing its headings did not need: --section-gap
	   is the air *between* two sections, and nothing is above this one but the
	   tab bar. Left at full it opened the collection 30px lower than the overview
	   and the activity tabs, which lead with 4px, and the three read as different
	   pages.

	   On the row rather than on its headings, which is what makes it survive the
	   grid collapsing: at two columns both headings have to stay level, and at
	   one the section below still wants the full gap above it. Moving the row
	   moves only what is at the top, in either shape. The 4px is the profile
	   frame's own lead-in (see its `.main h2.section:first-child`) and the two
	   have to agree by hand. */
	.duo:first-child {
		margin-top: calc(4px - var(--section-gap));
	}

	/* ---------- unlock grids: classes, SIs, medals, camos, decals ----------
	   One shape for the five. What differs between them is the picture: cover
	   for a portrait or a swatch, contain for a medal, an SI or a decal that
	   has to keep its own shape. The one size is what lets the paired sections
	   line up. */
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
		color: var(--text-dim);
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
		border-radius: var(--radius-2);
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
		background: var(--surface-raised);
		color: var(--text-faint);
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
		color: var(--text-faint);
		text-align: center;
		margin-top: -1px;
	}

	/* ---------- vehicle gear ----------
	   Five ladders across the content column rather than stacked down a 290px
	   aside, which is what they had to be when they lived there. */
	.gearcols {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
		gap: 12px;
		align-items: start;
	}
	.geargroup {
		padding: 4px 0 2px;
	}
	.gear-head {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px var(--card-pad-x) 3px;
		text-decoration: none;
		color: inherit;
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
		color: var(--text-faint);
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
		color: var(--text-faint);
		opacity: 0.6;
	}
	.tick {
		font-family: var(--font-mono);
		color: var(--accent);
		width: 12px;
		flex: none;
	}
	.gear li.locked .tick {
		color: var(--text-faint);
	}
</style>
