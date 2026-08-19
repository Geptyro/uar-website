<script lang="ts">
	/**
	 * The Combat Engineer, played. Written by hand — see $lib/guides — but
	 * drawn from the data: the map, the regions, the pre-placed cases and the
	 * panel costs are read, not typed, so a re-extraction that moves a cave
	 * moves the marker.
	 *
	 * The class has one job the others do not — feeding the City Guard — and
	 * that job is geography: three piles of scrap on the ground at 0:00, a
	 * machine in Thalim to carry them to, five caves to blow shut on the way.
	 * So the page opens on the map, and the text is ordered by what a Combat
	 * Engineer actually does first.
	 *
	 * Facts were read from the map's trigger script; the community's page was
	 * used to find where to look, not quoted. Ability costs are the map's
	 * patched values (AbilData), which differ from the base mod's for the
	 * satchel and the sentry.
	 */
	import { mosById } from '$lib/mos';
	import { mechanicsFor } from '$lib/mechanics';
	import { mapRegions, regionCenter } from '$lib/map';
	import placed from '$lib/data/placed.json';
	import ObjectiveMap, {
		type MapArea,
		type MapDots,
		type MapLabel,
		type MapPin
	} from '$lib/components/ObjectiveMap.svelte';
	import { mosTabHref } from '$lib/mosTabs';
	import GuideShell from './GuideShell.svelte';

	const ID = 'CombatEngineer';
	const mos = mosById.get(ID)!;
	const abil = (id: string) => mos.common.find((a) => a.id === id) ?? null;

	/* ---------- the map ---------- */

	/** Looked up by name: a rename should drop the marker, not move it. */
	const region = (name: string) => mapRegions.find((r) => r.name === name) ?? null;
	const at = (name: string) => {
		const r = region(name);
		return r ? regionCenter(r) : null;
	};

	const thalim = region('Thalim');
	const guardAt = at('City Guard area');
	const lzAt = at('LZ Wolverine');

	/* The five caves the satchel seals — the trigger tests the charge's point
	   against these regions, so these are the marks, not the smaller Cave0N
	   spawn points beside them. Numbered as the script numbers them. */
	const caves = [1, 2, 3, 4, 5]
		.map((n) => ({ n, c: at(`Cavern ${n} for Satchel`) }))
		.filter((c): c is { n: number; c: { x: number; y: number } } => c.c !== null);

	/* Every scraps case on the ground at 0:00, from the map's Objects file. The
	   author dropped them in three heaps; each dot is filed under the nearest
	   heap so the label can carry a count. The anchors are named regions the
	   heaps sit in, and the labels are the names players use for those places. */
	const scrapPoints: [number, number][] = (
		(placed as Record<string, number[][]>).AmmoCase2 ?? []
	).map(([x, y]) => [x, y]);
	const HEAPS = [
		{ anchor: 'Destroyed City1', label: 'Balaad ruins' },
		{ anchor: 'Outpost1', label: 'RA outpost' },
		{ anchor: 'Motorpool2', label: 'UT motor pool' }
	];
	const heaps = HEAPS.map((h) => ({ ...h, c: at(h.anchor), points: [] as [number, number][] }))
		.filter((h) => h.c);
	for (const p of scrapPoints) {
		let best = heaps[0];
		let bestD = Infinity;
		for (const h of heaps) {
			const d = Math.hypot(p[0] - h.c!.x, p[1] - h.c!.y);
			if (d < bestD) {
				bestD = d;
				best = h;
			}
		}
		best?.points.push(p);
	}
	const heapLabels: MapLabel[] = heaps
		.filter((h) => h.points.length)
		.map((h) => {
			const xs = h.points.map((p) => p[0]);
			const top = Math.max(...h.points.map((p) => p[1]));
			/* Written from the heap's western edge, so a heap by the west side
			   of the map keeps its label on the map; the eastern heap is the
			   exception and is written back from its eastern edge. */
			const east = Math.max(...xs) > 200;
			return {
				x: east ? Math.max(...xs) : Math.min(...xs),
				y: top + 8,
				text: `${h.label} · ${h.points.length} cases`,
				tone: 'item',
				anchor: east ? 'end' : 'start'
			};
		});

	/** Thalim is a rectangle in the map file; a ring reads as "the city is
	 *  around here". Mean of the sides, so it stays inside the map. */
	const cityRing: MapArea | null = thalim
		? {
				...regionCenter(thalim),
				r: ((thalim.x2 ?? 0) - (thalim.x1 ?? 0) + ((thalim.y2 ?? 0) - (thalim.y1 ?? 0))) / 4,
				tone: 'item',
				label: 'Thalim'
			}
		: null;

	const pins: MapPin[] = [
		...(guardAt ? [{ ...guardAt, tone: 'mos', label: 'City Guard', side: 'right' } as MapPin] : []),
		...caves.map(
			(c) =>
				({
					...c.c,
					tone: 'hostile',
					label: `cave ${c.n}`,
					side: c.c.x > 200 ? 'left' : 'right'
				}) as MapPin
		),
		...(lzAt ? [{ ...lzAt, tone: 'accent', label: 'you land here', side: 'right' } as MapPin] : [])
	];
	const dots: MapDots[] = [{ points: scrapPoints, tone: 'item' }];

	/* ---------- the City Guard's shop ---------- */

	/* The mini-panel, from the map's own button tooltips: the F-key, the add-on
	   and its price. The cost line is lifted out of the tooltip so it can sit in
	   a column of its own; what is left is the effect. */
	const panel = (mechanicsFor(ID)?.panel ?? []).map((k) => {
		const cost = /(\d+(?:\/\d+)*)\s+scraps/i.exec(k.desc ?? '')?.[1] ?? '—';
		const effect = (k.desc ?? '')
			.split('\n')
			.filter((l) => !/scraps/i.test(l))
			.join(' ')
			.replace(/\s+/g, ' ')
			.trim();
		return {
			key: k.key,
			label: k.label.replace(/\s*Add-on$/i, '').replace(/^Bloodhorn$/, 'Bullhorn'),
			icon: k.icon,
			cost,
			effect
		};
	});

	/* Ability costs — the map's patched AbilData values, by hand because the
	   extractor does not emit costs. Energy / cooldown in seconds. */
	const COST = {
		satchel: { energy: 180, cd: 240 },
		disarm: { energy: 5, cd: 3 },
		barricade: { energy: 90, cd: 60 },
		trap: { energy: 60, cd: 20 },
		sentry: { energy: 140, cd: 30 },
		flash: { energy: 85, cd: 60 },
		bot: { energy: 100, cd: 90 },
		refit: { energy: 75 },
		overhaul: { energy: 111, cd: 90 },
		reconstruct: { energy: 150, cd: 120 }
	};

	const scrapsOnGround = scrapPoints.length;
</script>

<GuideShell>
<p class="note lead">
	The Combat Engineer's game, top to bottom. One class has a machine to feed and caves to shut,
	and both are places on the map — so start with the map.
</p>

<div class="top">
	<ol class="jobs">
		<li class="job c-item">
			<span class="j-k">first</span>
			<b>Bring <em class="k">scraps</em> to the City Guard</b>
			<span class="j-d">
				{scrapsOnGround} cases lie in three heaps at 0:00 — carry them into Thalim and hand them to the
				City Guard. It counts them above its head.
			</span>
		</li>
		<li class="job c-mos">
			<span class="j-k">then</span>
			<b>Spend them on <em class="k">add-ons</em></b>
			<span class="j-d">
				Class panel, <kbd>F1</kbd>–<kbd>F7</kbd>, while you stand inside Thalim. Drones and gate
				turrets are the ones that shoot.
			</span>
		</li>
		<li class="job c-bad">
			<span class="j-k">on the way</span>
			<b><em class="k">Seal</em> the caves</b>
			<span class="j-d">
				Satchel Charge inside a cave mouth, step back, Disarm. 30 XP each, and that cave stops rolling
				its packs.
			</span>
		</li>
		<li class="job c-ok">
			<span class="j-k">always</span>
			<b>Keep the <em class="k">machines</em> running</b>
			<span class="j-d">
				Repair what is dented, Refit what is broken, Overhaul dead turrets and Predators, Reconstruct
				dead vehicles.
			</span>
		</li>
	</ol>

	<ObjectiveMap
		title="AO Thalim · the engineer's map"
		alt="The minimap with the three heaps of scraps, the City Guard in Thalim, the five caves and the landing zone marked"
		areas={cityRing ? [cityRing] : []}
		{pins}
		{dots}
		labels={heapLabels}
		legend={[
			{ tone: 'item', label: `scraps case on the ground at 0:00 (${scrapsOnGround})` },
			{ tone: 'mos', shape: 'pin', label: 'City Guard' },
			{ tone: 'hostile', shape: 'pin', label: 'cave — seal it with a satchel' },
			{ tone: 'accent', shape: 'pin', label: 'landing zone' }
		]}
		caption="Case positions are the map's own placed objects; the caves are the regions the satchel trigger tests; the City Guard stands where the script builds it. All read from the map file."
	/>
</div>

<h2 class="section">Scraps</h2>

<div class="cards">
	<article class="card d">
		<h3>Where they come from</h3>
		<ul class="pts">
			<li>
				<b>{scrapsOnGround} cases on the ground</b> at 0:00, in three heaps — the Balaad ruins in the
				south-west, the RA outpost in the east, the UT motor pool on the west edge. Each holds
				<b>3–6 scraps</b>.
			</li>
			<li>
				<b>One fresh case every 100 s</b> once the City Guard stands, dropped somewhere passable on the
				map, with <b>6–10</b> in it.
			</li>
			<li>
				<b>The MULE.</b> Activate it at the City Guard: it walks 50–120 units out of Thalim, digs for
				20–30 s and leaves a case of <b>40–49</b> where it dug, then walks home. You fetch the case.
			</li>
			<li>
				<b>Scraps Scanner</b> — 10 scraps, needs Rory Swann inside Thalim. From then on every case on the
				map is pinged for the engineers every 3 minutes.
			</li>
			<li>
				<b>Computational AI Module</b>, 10 minutes after the guard is built, somewhere on the map. Not
				scraps: hand it to the City Guard for <b>+15 drone damage</b> and <b>+2 drones</b>.
			</li>
			<li class="fine-li">
				In <b>Infested</b> a case is credited the moment you pick it up — no walk back.
			</li>
		</ul>
	</article>

	<article class="card d">
		<h3>The City Guard</h3>
		<ul class="pts">
			<li>
				Built <b>the moment a Combat Engineer is picked</b>, at Thalim's southern edge, with the MULE
				beside it. Not in Competitive, Survival, PMC or PMC+, nor with the Classical modifier.
			</li>
			<li>
				<b>Hand it a case</b> — drop the case into the City Guard — and the count above its head goes
				up by what the case held.
			</li>
			<li>
				Add-ons are bought from the <b>class panel</b> while you are <b>inside Thalim</b>, one at a time;
				each one names the engineer who paid for it.
			</li>
			<li>
				It works until <b>Chapter 3</b>: the hull's arrival breaks it and the scrap drops stop, so
				spend what you have before then. <b>Reconstruct</b> it afterwards and it hands over its Drones
				module — <b>7 drones follow you</b> for the rest of the game.
			</li>
		</ul>
	</article>
</div>

{#if panel.length}
	<h3 class="sub">What the scraps buy</h3>
	<div class="tablewrap">
		<table class="data shop" style="min-width: 560px">
			<thead>
				<tr>
					<th class="key">Key</th>
					<th>Add-on</th>
					<th class="num">Scraps</th>
					<th>What it does</th>
				</tr>
			</thead>
			<tbody>
				{#each panel as u (u.key)}
					<tr>
						<td class="key"><kbd>{u.key}</kbd></td>
						<td class="namecell">
							{#if u.icon}<img class="row-icon" src={u.icon} alt="" loading="lazy" />{:else}<span
									class="row-icon placeholder"
								></span>{/if}
							<span class="uname">{u.label}</span>
						</td>
						<td class="num mono">{u.cost}</td>
						<td class="effect">{u.effect}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p class="fine">
		Costs with a slash are per level. Ordering the drones out of Thalim costs 10 more each time; the
		Scraps Scanner is Swann's own button. Prices and text are the panel's, from the map file.
	</p>
{/if}

<h2 class="section">The caves</h2>

<div class="cards">
	<article class="card d">
		<h3>Sealing one</h3>
		<div class="limbs">
			<div class="limb good">
				<span class="limb-k">Satchel Charge · Engineering 4</span>
				<b>{COST.satchel.energy} energy</b>
				<span class="limb-d">{COST.satchel.cd / 60} min cooldown. Plant it inside the cave mouth.</span>
			</div>
			<div class="limb bad">
				<span class="limb-k">Disarm · X</span>
				<b>{COST.disarm.energy} energy</b>
				<span class="limb-d">Triggers the fuse. Explosives kill allies — step back first.</span>
			</div>
		</div>
		<ul class="pts top-gap">
			<li><b>30 XP</b> per cave, five caves — the map pings each one as it goes.</li>
			<li>
				The charge has to land <b>inside the cave's region</b> — the marked circle, not the rocks beside
				it — or it is just a very loud bang.
			</li>
			<li class="fine-li">Off with the <b>Rifle</b> modifier: the caves cannot be sealed there.</li>
		</ul>
	</article>

	<article class="card d">
		<h3>Why it matters</h3>
		<ul class="pts">
			<li>
				The five caves are where the undead <b>and the bosses</b> come from — the general spawn also
				uses the four map edges, the bosses use the caves alone.
			</li>
			<li>
				On <b>Hard and above</b> the caves also roll <b>packs</b>: every 60–120 s one of the five is
				picked, and Zerglings, Pure Hunters, Unburied, Risen or Swollen walk out of it.
			</li>
			<li>A <b>sealed cave rolls nothing</b> — the pack timer skips it for the rest of the game.</li>
			<li>
				Cave 5 is straight north of the landing zone, on the highland you cross to reach the city;
				cave 2 is east of it by LZ Eagles; cave 3 sits just east of Thalim's walls.
			</li>
		</ul>
	</article>
</div>

<h2 class="section">The kit</h2>

<div class="cards">
	<article class="card d">
		<h3>Holding ground</h3>
		<ul class="pts icons">
			<li>
				{#if abil('Barricade')?.icon}<img src={abil('Barricade')?.icon} alt="" />{/if}
				<span
					><b>Barricade</b> · {COST.barricade.energy} energy · up to 3. The undead go for it before
					anything near it; place them apart, in the choke, and let the shooters work.</span
				>
			</li>
			<li>
				{#if abil('ParalysisTrapCE')?.icon}<img src={abil('ParalysisTrapCE')?.icon} alt="" />{/if}
				<span
					><b>Paralysis Trap</b> · {COST.trap.energy} energy. Draws whatever sees it, then throws
					everything in the blast outward — allies and items included.</span
				>
			</li>
			<li>
				{#if abil('M1SentryGun')?.icon}<img src={abil('M1SentryGun')?.icon} alt="" />{/if}
				<span
					><b>M1 Sentry Gun</b> · {COST.sentry.energy} energy · 1, 2 or 3 with Security. Pick its
					mount — MMG, poison, flamethrower, .50 cal — before it does anything; it runs on its own
					energy.</span
				>
			</li>
			<li>
				{#if abil('Flash')?.icon}<img src={abil('Flash')?.icon} alt="" />{/if}
				<span><b>Flash</b> · {COST.flash.energy} energy. One target, frozen 3.2 s.</span>
			</li>
		</ul>
	</article>

	<article class="card d">
		<h3>Fixing things</h3>
		<ul class="pts icons">
			<li>
				{#if abil('RepairCE')?.icon}<img src={abil('RepairCE')?.icon} alt="" />{/if}
				<span><b>Repair</b> · 15 life per 1.5 energy. Right-click a dented mechanical.</span>
			</li>
			<li>
				{#if abil('Refit')?.icon}<img src={abil('Refit')?.icon} alt="" />{/if}
				<span
					><b>Refit</b> · {COST.refit.energy} energy. Clears a machine's malfunctions — and is what a
					right-click on an <em>undamaged</em> machine does, so mind where you click.</span
				>
			</li>
			<li>
				{#if abil('Overhaul')?.icon}<img src={abil('Overhaul')?.icon} alt="" />{/if}
				<span
					><b>Overhaul</b> · {COST.overhaul.energy} energy. Brings back a destroyed turret or
					Predator.</span
				>
			</li>
			<li>
				{#if abil('Reconstruct')?.icon}<img src={abil('Reconstruct')?.icon} alt="" />{/if}
				<span
					><b>Reconstruct</b> · {COST.reconstruct.energy} energy. Brings back a destroyed vehicle — or
					the City Guard.</span
				>
			</li>
			<li>
				{#if abil('RepairDrone')?.icon}<img src={abil('RepairDrone')?.icon} alt="" />{/if}
				<span
					><b>Repair Drone</b> · {COST.bot.energy} energy. Repairs at your own rate; the second pair
					of hands. Its sibling the <b>IS Bot</b> shoots on the move.</span
				>
			</li>
			<li>
				{#if abil('ArcCell')?.icon}<img src={abil('ArcCell')?.icon} alt="" />{/if}
				<span
					><b>Arc Cell</b> · 3 charges, one back every 60 s, 50 energy over 10 s each. What pays for
					all of the above.</span
				>
			</li>
		</ul>
	</article>
</div>

<p class="fine credit">Numbers and positions are read from the map file.</p>
</GuideShell>
