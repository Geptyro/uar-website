<script lang="ts">
	/**
	 * The page for someone who has not played yet. Every other page here is a
	 * reference you open with a question already in mind; this one has to work
	 * on a visitor who has none — so it is drawn, not written.
	 *
	 * The graph is the whole of a first game: start, class, the one choice that
	 * first minute actually offers, and the one mechanic no other arcade map
	 * has taught them. Beside it, the AO with the two places those branches
	 * name — a step that says "head for the city" is worth nothing to someone
	 * who has never seen where the city is.
	 *
	 * Icons are the in-game buttons, not decoration: a hotkey letter is only
	 * useful once you know which layout it was written for, and the button is
	 * the same thing to click on every keyboard.
	 *
	 * Connectors are inline SVG with non-scaling strokes: the split and merge
	 * have to line up with the two grid columns at any width, and a CSS
	 * pseudo-element bracket cannot bend.
	 *
	 * Numbers come from $lib/mechanics and positions from $lib/map — both the
	 * map's own script — so a re-extraction that moves them moves the page.
	 */
	import { mosById, mosList, mosName, pickableMos } from '$lib/mos';
	import { rules, pityCap } from '$lib/mechanics';
	import { mapRegions, mapSize, regionCenter } from '$lib/map';
	import { modeNames } from '$lib/players';
	import si from '$lib/data/si.json';
	import Seo from '$lib/components/Seo.svelte';
	import Rich from '$lib/components/builds/Rich.svelte';
	import { renderBuildInline, type RefResolver } from '$lib/buildMarkdown';
	import { refResolver } from '$lib/buildRefs';
	import { Page } from 'sveltekit-commons';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const unjam = rules.jam.unjam;

	/** trims trailing zeros so 1.70 reads as 1.7, as the class pages do */
	const secs = (v: number) => `${+v.toFixed(2)} s`;
	/** one unit for the pair: "1.7–2.1 s", not "1.7 s–2.1 s" */
	const span = (a: number, b: number) => `${+a.toFixed(2)}–${+b.toFixed(2)} s`;

	const failPct = Math.round(100 / unjam.failOdds);

	/* How much likelier a shot is to jam once the ladder has run all the way
	   out. Both ends share the magazine gate, so the ratio is odds-only and
	   holds for every class whatever its magazine size. */
	const worstOdds = Math.min(...rules.jam.pity.map((s) => s.odds));
	const riskMult = +((rules.jam.defaultOdds + 1) / (worstOdds + 1)).toFixed(1);

	const neverJam = rules.jam.excluded.map(mosName).sort((a, b) => a.localeCompare(b));

	/* The magazine economy, every figure from the script. The node in the graph
	   carries three of them; the cards under it carry the rest. */
	const ammo = rules.ammo;
	/** "10 for A, B and C": one clause per count, the classes listed once each */
	const byCount = new Map<number, string[]>();
	for (const [id, n] of Object.entries(ammo.start.more)) {
		byCount.set(n, [...(byCount.get(n) ?? []), mosName(id)]);
	}
	const list = (xs: string[]) =>
		xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0];
	const moreStarts = [...byCount]
		.sort(([a], [b]) => b - a)
		.map(([n, names]) => `${n} for ${list(names.sort((a, b) => a.localeCompare(b)))}`)
		.join('; ');
	const pct = (v: number) => `${Math.round(v * 100)}%`;
	/** 380 s reads as a clock figure, not a count */
	const mins = (s: number) => {
		const m = Math.floor(s / 60);
		const r = Math.round(s - m * 60);
		return r ? `${m} min ${r} s` : `${m} min`;
	};
	const tiers = ammo.tiers.filter((t) => t.over !== null && t.slow !== null) as {
		over: number;
		slow: number;
		behavior: string | null;
	}[];

	/* The three states are effects in the catalog, so they are drawn as the
	   same chips a guide would use. The chip's hover card normally carries the
	   effect's kind; here it carries what the ailment panel says in the game. */
	const baseResolve = refResolver(null);
	const chip = (id: string) => {
		const panelText = new Map(data.tierEffects.map((e) => [e.id, e.tooltip]));
		const resolve: RefResolver = (kind, ref) => {
			const t = baseResolve(kind, ref);
			const tip = t && kind === 'effect' ? panelText.get(ref) : undefined;
			return t && tip ? { ...t, tip } : t;
		};
		return renderBuildInline(`[[effect:${id}]]`, resolve);
	};
	const combatLoad = ammo.combatLoad ? si.find((x) => x.num === ammo.combatLoad?.si) : null;
	const combatCap = ammo.cap && ammo.combatLoad ? Math.floor(ammo.cap * ammo.combatLoad.mult) : null;
	const skipMode = ammo.spawn.skipMode ? modeNames[ammo.spawn.skipMode - 1] : null;

	// the trigger names its bonuses by behaviour id; these read as a label
	const BONUS_LABELS: Record<string, string> = {
		SoldierSkills: 'per Soldier Skills level',
		QuickThinking: 'Quick Thinking',
		InstructorTarget: "instructor's aura"
	};
	const bonuses = Object.entries(unjam.bonus).filter(([, v]) => !!v) as [string, number][];

	/* The two classes the map hands a brand new account: rank PVT, no XP. Read
	   from the unlock table rather than named here, so a rebalance moves it.
	   Ordered by how many of them a lobby may field, which puts the one a first
	   game is nearly always spent on first. */
	const starters = mosList
		.filter((m) => m.unlock?.en?.xp === 0 && !m.unlock?.medals)
		.sort((a, b) => (b.unlock?.charges ?? 0) - (a.unlock?.charges ?? 0));

	/* Where the hero selector is created (region 6, "LZ Wolverine") and the
	   city every squad ends up defending. Looked up by name: a rename should
	   drop the marker, not silently move it somewhere wrong. */
	const region = (name: string) => mapRegions.find((r) => r.name === name) ?? null;
	const lz = region('LZ Wolverine');
	const city = region('Thalim');
	/** game coords have their origin bottom-left, the SVG's is top-left */
	const flip = (y: number) => mapSize - y;
	const at = (name: string) => {
		const r = region(name);
		if (!r) return null;
		const c = regionCenter(r);
		return { x: c.x, y: flip(c.y) };
	};
	const lzAt = at('LZ Wolverine');
	const cityAt = at('Thalim');

	/** Thalim is a rectangle in the map file; on a thumbnail a ring reads as
	 *  "the city is around here" where an exact box reads as a claim. Mean of
	 *  the two sides, not the longer one — a ring drawn to the long side
	 *  overruns the top of the map. */
	const cityRadius = city
		? ((city.x2 ?? 0) - (city.x1 ?? 0) + ((city.y2 ?? 0) - (city.y1 ?? 0))) / 4
		: 0;

	/* Both from the map's ButtonData for ImmediateRemedialAction. The alert
	   icon is what a jam puts on screen — red-tinted there, so it is tinted
	   here (checked against the game, not inferred from the data: the trigger
	   only prints a subtitle, and the ailments panel draws the other one).
	   The button icon is what sits on the command card. Shown in that order:
	   the thing that happens, then the thing to do about it. */
	const JAM_ICON = '/icons/btn-upgrade-tychus-weapons-level1.png';
	const UNJAM_ICON = '/icons/btn-tips-mercenary.png';
	/* The submenu Z opens before A does anything — the map's AdditionalActions
	   button. SC2 ships this whole icon family as a white glyph the game plates
	   itself, hence the plate in the CSS rather than art with one baked in. */
	const SUBMENU_ICON = '/icons/btn-techupgrade-terran-neosteelbunker.png';
	/* The magazine counter's own art, which is also the Magazines pack's: the
	   thing that runs down and the thing you pick up are one picture. The case
	   is the other shape ammo takes on the ground. */
	const RELOAD_ICON = '/icons/icon-mags.png';
	const CASE_ICON = '/icons/btnammocase.png';

	/* Eight arrows converging on the jam icon, one per compass point. The
	   corner four rest further out than the edge four: the icon is a square,
	   so one radius for all eight would bury the corners in the art and leave
	   the edges stranded. Distances are to the top of the arrow's own box, and
	   `far` is where each starts its run in. */
	const ARROWS = [0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
		/* distance to the *top* of the arrow's box; its apex sits one arrow
		   length nearer, so these carry the triangle's height plus the gap the
		   tip should keep from a 52px icon — 26px to a flat edge, 37 to a
		   corner. */
		const near = deg % 90 === 0 ? 38 : 48;
		return { deg, near, far: near + 9 };
	});
</script>

<Page>
	<Seo
		title="Quick guide"
		description="Undead Assault Reborn in one diagram: where you land, what to pick, how to keep your gun fed, why you follow the squad, and how to clear a jammed weapon. Plus the detail underneath."
	/>

	<p class="note">Your first game, top to bottom. Two minutes.</p>

	<div class="layout">
		<div class="graph">
			<div class="node c-lobby">
				<span class="n-k">start</span>
				<b>The lobby <em class="k">votes</em> a mode</b>
				<span class="n-d">Pick <b>{modeNames[0]}</b> — the one the map recommends first.</span>
			</div>

			<svg class="conn" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">
				<path d="M50 0 V26" />
			</svg>

			<div class="node c-mos">
				<span class="n-k">then</span>
				<b>Pick your <em class="k">class</em></b>
				{#if starters.length}
					<span class="picks">
						{#each starters as m (m.id)}
							<a class="pick" href="/mos/{m.id}">
								{#if m.icon}<img src={m.icon} alt="" loading="lazy" />{/if}
								<span>{m.name}</span>
							</a>
						{/each}
					</span>
				{/if}
				<span class="n-d">
					You start with these. {pickableMos.length} in all — rank unlocks the rest.
				</span>
			</div>

			<!-- the bracket only means anything while the branches sit side by side;
			     stacked, the same two cards are one line apart -->
			<svg class="conn fork" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">
				<path d="M50 0 V13 M24 13 H76 M24 13 V26 M76 13 V26" />
			</svg>
			<svg class="conn stacked" viewBox="0 0 100 14" preserveAspectRatio="none" aria-hidden="true">
				<path d="M50 0 V14" />
			</svg>

			<div class="split">
				<div class="node branch c-item">
					<span class="n-k">either</span>
					<b>Head for the <em class="k">city</em></b>
					<span class="n-d">Thalim — walls, gates, the City Guard.</span>
				</div>
				<span class="or" aria-hidden="true">or</span>
				<div class="node branch hi c-ok">
					<span class="n-k">better</span>
					<b><em class="k">Follow</em> other players</b>
					<span class="n-d">Nobody survives AO Thalim alone.</span>
				</div>
			</div>

			<svg class="conn fork" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">
				<path d="M24 0 V13 M76 0 V13 M24 13 H76 M50 13 V26" />
			</svg>
			<svg class="conn stacked" viewBox="0 0 100 14" preserveAspectRatio="none" aria-hidden="true">
				<path d="M50 0 V14" />
			</svg>

			<div class="node alert c-bad">
				<span class="n-k">sooner or later</span>
				<b>Your weapon <em class="k">jams</em></b>
				<span class="jam-focus">
					{#each ARROWS as a (a.deg)}
						<span
							class="arr"
							style="--a: {a.deg}deg; --near: {a.near}px; --far: {a.far}px"
							aria-hidden="true"
						></span>
					{/each}
					<span class="btn-icon jam" title="What a jam puts on screen">
						<img src={JAM_ICON} alt="Weapon jammed" />
					</span>
				</span>

				<!-- the two clicks the hotkey is short for: Z opens the submenu, A is
				     the action inside it -->
				<span class="do">
					<span class="step">
						<span class="step-row">
							<img class="btn-icon glyph" src={SUBMENU_ICON} alt="" />
							<kbd>Z</kbd>
						</span>
						<span class="lab">Additional actions</span>
					</span>
					<span class="sep" aria-hidden="true">→</span>
					<span class="step">
						<span class="step-row">
							<img class="btn-icon" src={UNJAM_ICON} alt="" />
							<kbd>A</kbd>
						</span>
						<span class="lab">Immediate/Remedial</span>
					</span>
				</span>
				<span class="do-d">the two command-card buttons, or their keys</span>
				<span class="n-d">Nothing clears it on its own. Step behind the line, then press it.</span>
			</div>

			<svg class="conn" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">
				<path d="M50 0 V26" />
			</svg>

			<!-- the quieter mechanic, after the loud one: the magazine is finite,
			     and so is the stack of them you carry -->
			<div class="node c-ammo">
				<span class="n-k">in between</span>
				<b>Your magazine <em class="k">runs dry</em></b>
				<!-- no key to press: the reload happens on its own, so the strip is
				     the cost of one and where the next comes from -->
				<span class="do">
					<span class="step">
						<span class="step-row">
							<img class="btn-icon" src={RELOAD_ICON} alt="" />
						</span>
						<span class="lab">{ammo.magsPerReload} magazine per reload</span>
					</span>
					<span class="sep" aria-hidden="true">→</span>
					<span class="step">
						<span class="step-row">
							<img class="btn-icon" src={CASE_ICON} alt="" />
						</span>
						<span class="lab">Pick up packs</span>
					</span>
				</span>
				<span class="do-d">it reloads on its own, on the next shot</span>
				{#if ammo.start.default && ammo.perUse && ammo.cap}
					<span class="n-d">
						You land with <b>{ammo.start.default} magazines</b>. A pack on the ground readies
						<b>{ammo.perUse}</b> more. Past <b>{ammo.cap}</b> you slow down.
					</span>
				{/if}
			</div>
		</div>

		<aside class="ao">
			<h2 class="ao-h">AO Thalim</h2>
			<svg class="ao-map" viewBox="0 0 {mapSize} {mapSize}" role="img" aria-label="Where you land, and where the city is">
				<image href="/map/minimap.png" width={mapSize} height={mapSize} />
				{#if city && cityAt}
					<circle class="ao-city" cx={cityAt.x} cy={cityAt.y} r={cityRadius} />
					<circle class="ao-pin city" cx={cityAt.x} cy={cityAt.y} r="4.5" />
				{/if}
				{#if lz && lzAt}
					<circle class="ao-halo" cx={lzAt.x} cy={lzAt.y} r={(lz.r ?? 6) + 4} />
					<circle class="ao-pin lz" cx={lzAt.x} cy={lzAt.y} r="4.5" />
				{/if}

				<!-- labels last so nothing draws over them -->
				{#if cityAt && city}
					<text class="ao-t city" x={cityAt.x + 8} y={cityAt.y + 3}>{city.name} · the city</text>
				{/if}
				{#if lzAt}
					<text class="ao-t lz" x={lzAt.x + 12} y={lzAt.y + 3}>you land here</text>
				{/if}
			</svg>
			<p class="ao-d">
				Every game starts at {lz?.name ?? 'the landing zone'}. The city is north of it — both
				positions are read from the map file.
			</p>
			<a class="glink" href="/map">The full map →</a>
		</aside>
	</div>

	<p class="note done">That is the game. The rest is detail.</p>

	<h2 class="section">The jam, in numbers</h2>

	<div class="cards">
		<article class="card d">
			<h3>Clearing it</h3>
			<div class="limbs">
				<div class="limb good">
					<span class="limb-k">{100 - failPct}% · immediate</span>
					<b>{span(unjam.action.min, unjam.action.max)}</b>
					<span class="limb-d">Charging handle.</span>
				</div>
				<div class="limb bad">
					<span class="limb-k">1 in {unjam.failOdds} · remedial</span>
					<b>{span(unjam.remedial.min, unjam.remedial.max)}</b>
					<span class="limb-d">Magazine out, fresh one in. No cancel.</span>
				</div>
			</div>
			{#if bonuses.length}
				<p class="tags">
					{#each bonuses as [name, value] (name)}
						<span class="tag"><b>−{secs(value)}</b> {BONUS_LABELS[name] ?? name}</span>
					{/each}
				</p>
				<p class="fine">Off every wait — and the long drill has four.</p>
			{/if}
		</article>

		<article class="card d">
			<h3>Why it happened</h3>
			<ul class="pts">
				<li>Rolled on <b>every shot</b>, against the magazine your class spawned with.</li>
				<li>
					<b>{riskMult}× likelier</b> after {pityCap} s without a jam — a clean run is what ends it.
				</li>
				<li>A Magazine Extender buys ammo, <b>not safety</b>.</li>
				<li class="never">
					Never jam:
					{#each neverJam as name, i (name)}{i ? ', ' : ''}<span class="nj">{name}</span>{/each}
				</li>
			</ul>
			<a class="glink" href="/mos">Jam risk per class →</a>
		</article>
	</div>

	<h2 class="section">Ammo, in numbers</h2>

	<div class="cards ammo">
		<article class="card d">
			<h3>Feeding the gun</h3>
			<div class="limbs">
				<div class="limb good">
					<span class="limb-k">you land with</span>
					<b>{ammo.start.default} magazines</b>
					{#if moreStarts}<span class="limb-d">{moreStarts}.</span>{/if}
				</div>
				<div class="limb bad">
					<span class="limb-k">each reload</span>
					<b>{ammo.magsPerReload} magazine</b>
					{#if ammo.magsPerReload}
						<span class="limb-d">{ammo.magsPerReload + 1} with a Magazine Extender.</span>
					{/if}
				</div>
			</div>
			<ul class="pts">
				<li>Empty, it reloads <b>on its own</b>, on the next shot. Nothing to press.</li>
				{#if ammo.lowAmmoAt}
					<li>
						A warning tone at <b>a {ammo.lowAmmoAt === 4 ? 'quarter' : `1/${ammo.lowAmmoAt}`}</b>
						magazine. None left to load: the reload is refused, and the squad hears about it.
					</li>
				{/if}
				{#if ammo.respawn}
					<li>Respawn at a reinforcement point with <b>{ammo.respawn}</b>.</li>
				{/if}
			</ul>
			<a class="glink" href="/mos">Magazine sizes per class →</a>
		</article>

		<article class="card d">
			<h3>Finding more</h3>
			<ul class="pts">
				<li>
					A <a href="/entities/Magazines"><b>pack</b></a> readies <b>{ammo.perUse}</b> per use.
					{#if ammo.pack.ground && ammo.pack.airdrop}
						{ammo.pack.ground} use on one you find, {ammo.pack.airdrop} on one airdropped.
					{/if}
				</li>
				<li>
					An <a href="/entities/AmmoCase"><b>Ammo Case</b></a> readies the same {ammo.perUse} per
					use{#if ammo.case.start && ammo.case.max}, starts with {ammo.case.start} of {ammo.case
							.max}{/if}. Packs you pick up pour into it.
				</li>
				{#if ammo.spawn.every && ammo.spawn.packs && ammo.spawn.cases}
					<li>
						Every <b>{mins(ammo.spawn.every)}</b> the map drops {ammo.spawn.packs.base} packs, one
						more per {ammo.spawn.packs.perPlayers} players, and {ammo.spawn.cases} cases at random
						spots{#if skipMode}, in every mode but {skipMode}{/if}.
					</li>
				{/if}
				{#if ammo.cache.packs && ammo.cache.cases}
					<li>
						A weapon cache holds <b>{ammo.cache.packs[0]} to {ammo.cache.packs[1]} packs</b> and
						{ammo.cache.cases[0]} to {ammo.cache.cases[1]} cases.
					</li>
				{/if}
			</ul>
		</article>

		<article class="card d">
			<h3>Carrying too many</h3>
			{#if ammo.cap && tiers.length}
				<Rich>
					<div class="tiers">
						{#each tiers as t (t.over)}
							<div class="tier" class:stop={t.slow >= 1}>
								<span class="limb-k">over {ammo.cap + t.over}</span>
								{#if t.behavior}<span class="md tier-fx">{@html chip(t.behavior)}</span>{/if}
								<b>{t.slow >= 1 ? 'stuck' : `${pct(t.slow)} slower`}</b>
							</div>
						{/each}
					</div>
				</Rich>
			{/if}
			<ul class="pts">
				<li>
					<b>{ammo.cap} readied</b> is the cap{#if combatLoad && combatCap}, {combatCap} with
						{combatLoad.name}{/if}.
				</li>
				{#if ammo.dropMags && ammo.dropmagsPause}
					<li>
						<kbd>D</kbd> hands <b>{ammo.dropMags}</b> back as a pack. Stuck? Select your hero and
						type <code>-dropmags</code>: the excess drops, and you stand still {+ammo.dropmagsPause.toFixed(0)} s.
					</li>
				{/if}
				{#if ammo.deathDropPer}
					<li>
						Die, and your readied magazines <b>drop as packs</b> around you, one per {ammo.deathDropPer}.
						What nobody took is back in your bag when you are revived, not readied.
					</li>
				{/if}
			</ul>
			<a class="glink" href="/career/si">Skill Identifiers →</a>
		</article>
	</div>

	<h2 class="section">Fire teams</h2>

	<div class="cards">
		<article class="card d">
			<h3>Joining</h3>
			<ul class="pts">
				<li><b class="ft">FT</b> button, bottom right of the minimap.</li>
				<li><b>4 teams</b>, up to <b>4 soldiers</b> each. Click again to leave.</li>
				<li>Whoever starts one is its <b>team leader</b>.</li>
			</ul>
		</article>

		<article class="card d">
			<h3>What it gives you</h3>
			<ul class="pts">
				<li><b>You see each other</b> — through fog and darkness, anywhere on the map.</li>
				<li>
					The TL <b>middle-clicks</b> a rally point for the team; on an enemy it tracks that target.
				</li>
				<li>A <b>Platoon Leader</b> can link every fire team into one.</li>
			</ul>
			<a class="glink" href="/mos/PlatoonLeader">Platoon Leader →</a>
		</article>
	</div>

	<h2 class="section">Between games</h2>

	<div class="cards">
		<article class="card d">
			<h3>XP is yours to keep</h3>
			<ul class="pts">
				<li>Objectives pay XP, <b>win or lose</b>.</li>
				<li>It banks into <b>3 rank tracks</b>.</li>
				<li>Rank unlocks classes, equipment and Skill Identifiers.</li>
			</ul>
			<a class="glink" href="/career">Rank thresholds →</a>
		</article>

		<article class="card d">
			<h3>Modes open up</h3>
			<ul class="pts">
				<li><b>{modeNames.length} modes</b>, {modeNames[0]} → {modeNames[modeNames.length - 1]}.</li>
				<li>The hard ones only accept a vote from players with the career XP.</li>
				<li>Dead? A medic revives you — with none left, you respawn at a reinforcement point.</li>
			</ul>
		</article>
	</div>

	<h2 class="section">Where to go next</h2>

	<div class="next">
		<a class="card nx" href="/mos">
			<span class="nx-t">Classes</span>
			<span class="nx-d">Magazines, reloads and jam risk, side by side</span>
		</a>
		<a class="card nx" href="/career/si">
			<span class="nx-t">Skill Identifiers</span>
			<span class="nx-d">Career-wide perks — Quick Thinking lives here</span>
		</a>
		<a class="card nx" href="/map">
			<span class="nx-t">Map &amp; missions</span>
			<span class="nx-d">Every named region of AO Thalim</span>
		</a>
		<a class="card nx" href="/entities">
			<span class="nx-t">Entities</span>
			<span class="nx-d">What is shooting at you, and what takes it down</span>
		</a>
		<a class="card nx" href="/companion">
			<span class="nx-t">Companion app</span>
			<span class="nx-d">Uploads your replays, pings you when a lobby opens</span>
		</a>
		<a class="card nx" href="/players">
			<span class="nx-t">Players</span>
			<span class="nx-d">Where your XP shows up once the games are in</span>
		</a>
	</div>
</Page>

<style>
	/* ---------- layout: the graph, and the ground it happens on ---------- */
	.layout {
		display: grid;
		/* even halves of the whole width: the AO is not an aside, it is the
		   other half of the explanation — the graph names two places, this
		   shows them */
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 28px;
		align-items: start;
	}
	@media (max-width: 780px) {
		.layout {
			grid-template-columns: 1fr;
			gap: 20px;
		}
		.ao {
			position: static;
			max-width: 420px;
		}
	}

	/* ---------- the graph ---------- */
	.graph {
		min-width: 0;
	}
	.node {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-3);
		box-shadow: var(--shadow-1);
		padding: 12px 16px 13px;
		text-align: center;
	}
	.n-k {
		display: block;
		font-family: var(--font-mono);
		font-size: 9.5px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-faint);
		margin-bottom: 4px;
	}
	.node > b {
		display: block;
		font-size: 16px;
		font-weight: 650;
		letter-spacing: -0.01em;
		line-height: 1.25;
	}
	.n-d {
		display: block;
		margin-top: 5px;
		font-size: 12.5px;
		line-height: 1.45;
		color: var(--text-dim);
	}
	.n-d b {
		color: var(--text);
		font-weight: 600;
	}
	.node.hi {
		border-color: var(--accent);
		box-shadow: var(--shadow-1), 0 0 0 3px var(--accent-soft);
	}
	.node.alert {
		border-color: var(--hostile);
		box-shadow: var(--shadow-1), 0 0 0 3px var(--hostile-soft);
	}

	/* One colour per step, carried by the word that step is really about and
	   echoed in its eyebrow. The two that also appear on the AO borrow their
	   colour from the marker there — "city" is the colour of the city. */
	.c-lobby {
		--step: var(--lobby);
	}
	.c-mos {
		--step: var(--mos);
	}
	.c-item {
		--step: var(--item);
	}
	.c-ok {
		--step: var(--accent);
	}
	.c-bad {
		--step: var(--hostile);
	}
	/* brass: the colour of the thing itself, and no other step's */
	.c-ammo {
		--step: var(--gold);
	}
	.node .k {
		font-style: normal;
		font-weight: 750;
		color: var(--step, var(--text));
	}
	.node .n-k {
		color: color-mix(in srgb, var(--step, var(--text-faint)) 72%, var(--text-faint));
	}

	.conn {
		display: block;
		width: 100%;
		height: 26px;
		fill: none;
		stroke: var(--border-strong);
		stroke-width: 2;
		stroke-linecap: round;
	}
	.conn path {
		vector-effect: non-scaling-stroke;
	}
	.conn.stacked {
		display: none;
		height: 14px;
	}

	.split {
		display: grid;
		grid-template-columns: 48% 48%;
		justify-content: space-between;
		/* stretch, not start: two cards of different text length either side of
		   an "or" read as a comparison, and a comparison wants one baseline */
		align-items: stretch;
		position: relative;
	}
	.branch {
		padding: 11px 12px 12px;
	}
	.branch > b {
		font-size: 14px;
	}
	.or {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		font-family: var(--font-mono);
		font-size: 9.5px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text-faint);
		background: var(--bg);
		padding: 2px 4px;
	}

	/* the two classes a new account starts with */
	.picks {
		display: flex;
		justify-content: center;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 9px;
	}
	.pick {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px 4px 4px;
		border: 1px solid var(--border);
		border-radius: 99px;
		background: var(--surface-raised);
		text-decoration: none;
		color: var(--text);
		font-size: 12px;
		font-weight: 600;
	}
	.pick:hover {
		border-color: var(--mos);
	}
	.pick img {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		object-fit: cover;
	}

	/* what to press, and what to click */
	.do {
		display: inline-flex;
		align-items: stretch;
		gap: 12px;
		margin-top: 12px;
		padding: 9px 14px;
		border: 1px solid var(--border);
		border-radius: var(--radius-2);
		background: var(--surface-raised);
	}
	.step {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}
	.step-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.lab {
		font-family: var(--font-mono);
		font-size: 9.5px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-faint);
		white-space: nowrap;
	}
	.btn-icon {
		width: 44px;
		height: 44px;
		display: block;
	}
	/* SC2 ships this family as a white glyph and plates it itself; the painted
	   icons carry their own plate, so only this one needs one drawn here. */
	.btn-icon.glyph {
		background: #0d1014;
		border-radius: 6px;
		padding: 4px;
	}
	/* Z opens the submenu, A picks the action out of it: one step then the
	   next, which is a sequence and wants an arrow, not a rule */
	.sep {
		align-self: center;
		margin-bottom: 15px;
		font-size: 34px;
		line-height: 1;
		color: var(--text-dim);
	}
	/* The alert, not a button. The game draws this one red, and the red is half
	   of how it is recognised — multiply rather than a filter, because that is
	   what the tint does there: it leaves the dark plate black and turns the
	   steel red.
	 *
	 * Masked with the icon's own alpha, which is the whole trick: an unmasked
	 * overlay has nothing to multiply against out on that transparent margin,
	 * so it lands as flat #ff3a20 and reads as a thick red border. */
	.btn-icon.jam {
		position: relative;
		isolation: isolate;
	}
	.btn-icon.jam img {
		display: block;
		width: 100%;
		height: 100%;
	}
	.btn-icon.jam::after {
		content: '';
		position: absolute;
		inset: 0;
		background: #ff3a20;
		mix-blend-mode: multiply;
		mask-image: url('/icons/btn-upgrade-tychus-weapons-level1.png');
		mask-size: 100% 100%;
		-webkit-mask-image: url('/icons/btn-upgrade-tychus-weapons-level1.png');
		-webkit-mask-size: 100% 100%;
	}

	/* ---------- the jam icon, pointed at from every side ---------- */
	.jam-focus {
		position: relative;
		display: block;
		/* wide enough for the corner arrows at full stretch, and no wider */
		width: 116px;
		height: 116px;
		margin: 4px auto -4px;
	}
	/* the one the arrows are for, so it is the bigger of the two */
	.jam-focus .btn-icon.jam {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 52px;
		height: 52px;
		transform: translate(-50%, -50%);
	}
	/* a zero-size box at the centre, turned to its compass point; the arrow
	   itself is the pseudo-element, so it can run in and out along that one
	   axis without the rotation having to be repeated in every keyframe */
	.arr {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 0;
		height: 0;
		transform: rotate(var(--a));
	}
	.arr::before {
		content: '';
		position: absolute;
		width: 0;
		height: 0;
		border-left: 6px solid transparent;
		border-right: 6px solid transparent;
		/* a triangle whose apex points down — which is inward, once rotated.
		   The icon's own tint rather than --hostile: the pair has to read as
		   one alarm, and the theme's hostile is a muted salmon next to it. */
		border-top: 9px solid #ff3a20;
		/* alternate, and never all the way out: eight arrows that fade to
		   nothing together leave the icon unmarked for half of every cycle
		   (and unmarked in any screenshot of it) */
		/* All eight on the same beat — a ring that closes in together reads as
		   one alarm, where a staggered one reads as a spinner. */
		animation: jam-converge 0.9s ease-in-out infinite alternate;
	}
	@keyframes jam-converge {
		from {
			transform: translate(-50%, calc(-1 * var(--far)));
			opacity: 0.45;
		}
		to {
			transform: translate(-50%, calc(-1 * var(--near)));
			opacity: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.arr::before {
			animation: none;
			transform: translate(-50%, calc(-1 * var(--near)));
			opacity: 0.9;
		}
	}
	kbd {
		font-family: var(--font-mono);
		font-size: 14px;
		font-weight: 650;
		color: var(--text);
		background: var(--surface);
		border: 1px solid var(--border-strong);
		border-bottom-width: 2px;
		border-radius: 5px;
		padding: 2px 9px;
	}
	.do-d {
		display: block;
		margin-top: 6px;
		font-size: 10.5px;
		line-height: 1.3;
		color: var(--text-faint);
	}

	/* three cards where the other sections have two: the third takes the
	   whole row rather than dangling at half width, and its three tiers
	   read across it */
	.cards.ammo > .card:last-child {
		grid-column: 1 / -1;
	}
	/* the three steps of the carry cap: brass while you can still walk, the
	   theme's hostile once you cannot */
	.tiers {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 9px;
		margin-bottom: 10px;
	}
	.tier {
		border-left: 2px solid var(--gold);
		padding-left: 9px;
		min-width: 0;
	}
	.tier.stop {
		border-left-color: var(--hostile);
	}
	.tier-fx {
		display: block;
		margin-top: 4px;
	}
	.tier b {
		display: block;
		margin-top: 4px;
		font-size: 15px;
		font-weight: 650;
	}
	.limbs + .pts {
		margin-top: 10px;
	}
	.pts kbd {
		font-size: 11px;
		padding: 0 6px;
	}
	.pts code {
		font-family: var(--font-mono);
		font-size: 11.5px;
		color: var(--text);
	}
	.pts a {
		color: inherit;
		text-decoration-color: var(--border-strong);
	}
	.pts a:hover {
		color: var(--text);
	}

	.note.done {
		margin-top: 18px;
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text-faint);
	}

	@media (max-width: 560px) {
		.split {
			grid-template-columns: 1fr;
			gap: 8px;
		}
		.or {
			position: static;
			transform: none;
			display: block;
			text-align: center;
		}
		.conn.fork {
			display: none;
		}
		.conn.stacked {
			display: block;
		}
	}

	/* ---------- the AO panel ---------- */
	.ao {
		position: sticky;
		top: 4px;
	}
	.ao-h {
		margin: 0 0 8px;
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-faint);
	}
	.ao-map {
		display: block;
		width: 100%;
		border: 1px solid var(--border);
		border-radius: var(--radius-2);
		background: var(--surface-sunken);
	}
	.ao-city {
		fill: var(--item);
		fill-opacity: 0.14;
		stroke: var(--item);
		stroke-width: 1.2;
		stroke-dasharray: 3 3;
	}
	.ao-halo {
		fill: none;
		stroke: var(--accent);
		stroke-width: 1.5;
		opacity: 0.65;
	}
	.ao-pin {
		stroke: #0b0d10;
		stroke-width: 1.5;
	}
	.ao-pin.lz {
		fill: var(--accent);
	}
	.ao-pin.city {
		fill: var(--item);
	}
	.ao-t {
		font-family: var(--font-mono);
		font-size: 7px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		/* the minimap under it is dark and busy: outline the glyphs rather
		   than box them, so nothing of the terrain is hidden */
		paint-order: stroke;
		stroke: #05070a;
		stroke-width: 2.4;
		stroke-linejoin: round;
	}
	.ao-t.lz {
		fill: var(--accent);
	}
	.ao-t.city {
		fill: var(--item);
	}
	.ao-d {
		margin: 9px 0 0;
		font-size: 11.5px;
		line-height: 1.45;
		color: var(--text-faint);
	}

	/* ---------- detail cards ---------- */
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
		gap: 12px;
		align-items: start;
	}
	.card.d {
		padding: 13px 15px 14px;
		min-width: 0;
	}
	.card.d h3 {
		margin: 0 0 9px;
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-faint);
		font-weight: 500;
	}
	.pts {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.pts li {
		position: relative;
		padding-left: 14px;
		margin-bottom: 6px;
		font-size: 12.5px;
		line-height: 1.5;
		color: var(--text-dim);
	}
	.pts li:last-child {
		margin-bottom: 0;
	}
	.pts li::before {
		content: '';
		position: absolute;
		left: 0;
		top: 8px;
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: var(--accent);
	}
	.pts b {
		color: var(--text);
		font-weight: 650;
	}
	.pts .nj {
		font-family: var(--font-mono);
		font-size: 11.5px;
		color: var(--mos);
	}
	.pts li.never {
		font-size: 11.5px;
		color: var(--text-faint);
	}

	.limbs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 9px;
	}
	.limb {
		border-left: 2px solid var(--border);
		padding-left: 9px;
		min-width: 0;
	}
	.limb.good {
		border-left-color: var(--mos);
	}
	.limb.bad {
		border-left-color: var(--hostile);
	}
	.limb-k {
		display: block;
		font-family: var(--font-mono);
		font-size: 9.5px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-faint);
	}
	.limb b {
		display: block;
		margin-top: 2px;
		font-size: 17px;
		font-weight: 650;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.01em;
	}
	.limb-d {
		display: block;
		margin-top: 3px;
		font-size: 11px;
		line-height: 1.4;
		color: var(--text-faint);
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		margin: 11px 0 0;
	}
	.tag b {
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}
	.fine {
		margin: 7px 0 0;
		font-size: 11px;
		line-height: 1.45;
		color: var(--text-faint);
	}
	/* the in-game FT button: a black bar with a green edge */
	.ft {
		font-family: var(--font-mono);
		font-size: 11px;
		color: #7dd87d;
		background: #0a0d0a;
		border: 1px solid #3f7f3f;
		border-radius: 3px;
		padding: 1px 7px;
	}

	.glink {
		display: inline-block;
		margin-top: 9px;
		font-family: var(--font-mono);
		font-size: 10.5px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		text-decoration: none;
		color: var(--accent);
	}
	.glink:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	/* ---------- next steps ---------- */
	.next {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(230px, 100%), 1fr));
		gap: 10px;
	}
	.nx {
		display: block;
		padding: 12px 14px;
		text-decoration: none;
		transition: border-color 120ms ease, transform 120ms ease;
	}
	.nx:hover {
		border-color: var(--accent);
		transform: translateY(-1px);
	}
	.nx-t {
		display: block;
		font-weight: 650;
		font-size: 13.5px;
		color: var(--text);
		margin-bottom: 3px;
	}
	.nx-d {
		display: block;
		font-size: 11.5px;
		line-height: 1.45;
		color: var(--text-faint);
	}
</style>
