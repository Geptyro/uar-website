<script lang="ts">
	/**
	 * The Assault Engineer, played. Written by hand — see $lib/guides — with
	 * the numbers read from the map: ability costs from AbilData (the map's
	 * patched values), the craft results from the Craft trigger and the
	 * behaviours it grants, the reload from gf_PredatorReload, and what
	 * happens when the Predator breaks from the Broken/Overhaul triggers. No
	 * build order: what to skill first is the reader's call, and the tabs
	 * beside this one carry the facts to make it.
	 *
	 * No map here: the class has no place on it that is its own. Its game is a
	 * machine and the other machines, so the page opens on the Predator.
	 */
	import { mosById } from '$lib/mos';
	import { mosTabHref, vehicleSlug } from '$lib/mosTabs';
	import GuideShell from './GuideShell.svelte';

	const ID = 'AssaultEngineer';
	const mos = mosById.get(ID)!;
	const predator = mosById.get(mos.vehicle ?? 'Goliath2') ?? null;
	const predatorHref = predator ? mosTabHref(ID, vehicleSlug(predator.name)) : mosTabHref(ID);
	const abil = (id: string) =>
		mos.common.find((a) => a.id === id) ?? predator?.common.find((a) => a.id === id) ?? null;

	/* Ability costs — the map's AbilData, by hand because the extractor does not
	   emit costs. Energy / cooldown in seconds. */
	const COST = {
		craft: { energy: 45, range: 2 },
		armor: { energy: 40, cd: 15 },
		battery: { energy: 60, cd: 15 },
		overhaul: { energy: 111, cd: 90 },
		reconstruct: { energy: 150, cd: 120 },
		refit: { energy: 75 },
		rockets: { energy: [150, 130, 115, 90], cd: [45, 40, 35, 30], range: [30, 35, 40, 45] },
		strikeWalk: { charges: 2, recharge: 30 },
		matrix: { energy: 40, cd: 60 },
		jump: { energy: 80, cd: 50 },
		flare: { energy: 40, cd: 75 },
		floodlights: { energy: 20, cd: 30 }
	};
	/* The Predator's guns, from its weapon data: the autocannon fires two rounds
	   a shot from a 100-round drum; the lasers are the map's 320-damage patch. */
	const GUNS = { autocannon: { dmg: 85, range: 18, period: 0.5 }, laser: { dmg: 320 }, drum: 100 };

	/* What Craft does to each thing it can touch — the Craft trigger's cases,
	   with the effect from the behaviour or item it grants. */
	const CRAFT = [
		{ target: 'Scope', into: 'Improved Scope', effect: '+2 range and +1 sight become +2.5 and +1.5' },
		{
			target: 'Magnetic Stabilizer',
			into: 'Improved Magnetic Stabilizer',
			effect: 'its stun goes from 0.2 s to 0.4 s'
		},
		{
			target: 'Recoil Suppressor',
			into: 'Improved Recoil Suppressor',
			effect: 'its slow goes from 10 % to 15 %'
		},
		{
			target: 'Recoil Suppressor (vehicle)',
			into: 'Improved, vehicle',
			effect: 'the same, on the vehicle version'
		},
		{
			target: 'Predator',
			into: 'Enhanced',
			effect: '+2 armor, +50 life, +1 life and +1 energy a second — and it keeps them'
		},
		{ target: 'Rjx-73', into: 'Enhanced', effect: '+1 armor, +50 life, +1 life a second' },
		{ target: 'Cyborg', into: 'Enhanced', effect: '+25 life, +1 a second' },
		{ target: 'Prototype', into: 'Enhanced', effect: '+25 life, +1 a second' },
		{ target: 'MULE', into: 'Enhanced', effect: '+5 armor, +50 life, +1 a second — and it digs faster' },
		{
			target: 'City Guard',
			into: 'Enhanced',
			effect: 'the militia drones fire 0.6 s faster'
		}
	];
</script>

<GuideShell>
	<p class="note lead">
		The Assault Engineer's game, top to bottom. One class comes with a mech, and the mech is most
		of the class — the rest is keeping every other machine on the field running.
	</p>

	<ol class="jobs grid">
		<li class="job c-mos">
			<span class="j-k">first</span>
			<b>Get in the <em class="k">Predator</em></b>
			<span class="j-d">
				It drops in at the start, on control group <kbd>2</kbd>. <b>Enter the Predator</b> — and put
				your first points in <b>Mecha Skills</b>: each level is one of its abilities.
			</span>
		</li>
		<li class="job c-ok">
			<span class="j-k">then</span>
			<b>Feed it <em class="k">Engineering</em></b>
			<span class="j-d">
				Every Engineering level raises the Predator's Rockets a level too — and brings Repair,
				Overhaul, the armor and battery upgrades, and at 4, <b>Craft</b>.
			</span>
		</li>
		<li class="job c-item">
			<span class="j-k">once you have it</span>
			<b><em class="k">Craft</em> for the team</b>
			<span class="j-d">
				{COST.craft.energy} energy turns a scope, a stabilizer or a suppressor into its improved
				version — and enhances the Predator, the Rjx-73, a Cyborg, a Prototype, the MULE, the City
				Guard. Say when it is ready.
			</span>
		</li>
		<li class="job c-bad">
			<span class="j-k">always</span>
			<b>Keep the <em class="k">machines</em> running</b>
			<span class="j-d">
				Repair what is dented, Refit what is broken, Overhaul a dead turret — or your own Predator
				— and Reconstruct a dead vehicle. Nobody else can do the last three.
			</span>
		</li>
	</ol>

	<h2 class="section">The Predator</h2>

	<div class="cards">
		<article class="card d">
			<h3>Getting in and out</h3>
			<ul class="pts">
				<li>
					<b>Enter the Predator</b> (E) from beside it; <b>Leave the Predator</b> from inside. While
					you pilot, you cannot be hit — the engineer rides invisible inside the hull.
				</li>
				<li>
					It arrives at <b>{predator?.life ?? 550} life</b> and <b>{predator?.energy ?? 300} energy</b>
					— its own pool, not yours — and it moves 0.8 faster per Mecha Skills level.
				</li>
				<li>
					It carries {predator?.inventory.slots ?? 6} slots of its own: a scope, a vehicle aim assist or
					recoil suppressor, a shield generator, a recon drone module, weight reduction, the Twin
					Autocannons MK II. Every one is on its <a href={mosTabHref(ID, 'gear')}>Gear tab</a>.
				</li>
				<li class="fine-li">
					Stuck outside a broken hull with the engineer hidden? Type <b>-stuck</b> in chat: the map
					puts you back beside it, visible.
				</li>
			</ul>
		</article>

		<article class="card d">
			<h3>When it breaks</h3>
			<ul class="pts">
				<li>
					The Predator <b>never dies</b>: at its last point of life it stops, goes <b>Broken</b>, and
					throws you clear — the ejection is a jump forward, so you land on your feet.
				</li>
				<li>
					Anything it carried for a mission is dropped beside it: a satchel, a sentry, a battery, the
					BMDD.
				</li>
				<li>
					<b>Overhaul</b> it — {COST.overhaul.energy} energy, {COST.overhaul.cd} s cooldown, needs
					Engineering 1 — and it comes back at 100 life; repair the rest. Which is why Engineering 1
					comes before anything you would rather have.
				</li>
				<li>Losing it costs the mission items too: pick them back up before you climb in.</li>
			</ul>
		</article>
	</div>

	<h3 class="sub">Its guns and its abilities</h3>
	<div class="tablewrap">
		<table class="data shop" style="min-width: 640px">
			<thead>
				<tr>
					<th>Ability</th>
					<th class="num">Costs</th>
					<th class="num">Cooldown</th>
					<th>What it does</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<td class="namecell">
						{#if predator?.icon}<img class="row-icon" src={predator.icon} alt="" loading="lazy" />{:else}<span class="row-icon placeholder"></span>{/if}
						<span class="uname">Autocannon</span>
					</td>
					<td class="num mono">2 rounds</td>
					<td class="num mono">—</td>
					<td class="effect">
						{GUNS.autocannon.dmg} damage every {GUNS.autocannon.period} s at range {GUNS.autocannon.range}, from a
						{GUNS.drum}-round drum. Its <b>Reload</b> takes one of <em>your</em> magazines and about
						6 s — Quick Thinking cuts it a quarter — and you cannot climb out mid-reload.
					</td>
				</tr>
				<tr>
					<td class="namecell">
						{#if abil('LaserGuns')?.icon}<img class="row-icon" src={abil('LaserGuns')?.icon} alt="" loading="lazy" />{:else}<span class="row-icon placeholder"></span>{/if}
						<span class="uname">Laser Guns</span>
					</td>
					<td class="num mono">—</td>
					<td class="num mono">4 s</td>
					<td class="effect">
						A toggle: {GUNS.laser.dmg} damage a shot on the same drum. Switch back to the autocannon
						the same way.
					</td>
				</tr>
				<tr>
					<td class="namecell">
						{#if abil('Rockets')?.icon}<img class="row-icon" src={abil('Rockets')?.icon} alt="" loading="lazy" />{:else}<span class="row-icon placeholder"></span>{/if}
						<span class="uname">Rockets <span class="lvl">Mecha 1</span></span>
					</td>
					<td class="num mono">{COST.rockets.energy.join('/')}</td>
					<td class="num mono">{COST.rockets.cd.join('/')} s</td>
					<td class="effect">
						Two rockets on the ground. The level is <b>your Engineering level</b>, not Mecha —
						1,000 → 1,400 → 1,800 → 2,200 damage a pair by the tooltip, range {COST.rockets
							.range[0]} → {COST.rockets.range[3]}. Explosive damage — an explosives SI counts.
					</td>
				</tr>
				<tr>
					<td class="namecell">
						{#if abil('PsiStrikeWalk')?.icon}<img class="row-icon" src={abil('PsiStrikeWalk')?.icon} alt="" loading="lazy" />{:else}<span class="row-icon placeholder"></span>{/if}
						<span class="uname">Strike Walk <span class="lvl">Mecha 2</span></span>
					</td>
					<td class="num mono">1 charge</td>
					<td class="num mono">{COST.strikeWalk.recharge} s / charge</td>
					<td class="effect">
						{COST.strikeWalk.charges} charges. A charge through the target point, damaging what it
						crosses — and open to what survives it.
					</td>
				</tr>
				<tr>
					<td class="namecell">
						{#if abil('NovaStoneDefensiveMatrix')?.icon}<img class="row-icon" src={abil('NovaStoneDefensiveMatrix')?.icon} alt="" loading="lazy" />{:else}<span class="row-icon placeholder"></span>{/if}
						<span class="uname">Defensive Matrix <span class="lvl">Mecha 3</span></span>
					</td>
					<td class="num mono">{COST.matrix.energy}</td>
					<td class="num mono">{COST.matrix.cd} s</td>
					<td class="effect">A shield around the hull that soaks damage until it is spent.</td>
				</tr>
				<tr>
					<td class="namecell">
						{#if abil('HydraulicJump')?.icon}<img class="row-icon" src={abil('HydraulicJump')?.icon} alt="" loading="lazy" />{:else}<span class="row-icon placeholder"></span>{/if}
						<span class="uname">Jump <span class="lvl">Mecha 4</span></span>
					</td>
					<td class="num mono">{COST.jump.energy}</td>
					<td class="num mono">{COST.jump.cd} s</td>
					<td class="effect">
						One second to crouch, then a jump — up and down cliffs, no vision needed.
					</td>
				</tr>
				<tr>
					<td class="namecell">
						{#if abil('FlareGun2')?.icon}<img class="row-icon" src={abil('FlareGun2')?.icon} alt="" loading="lazy" />{:else}<span class="row-icon placeholder"></span>{/if}
						<span class="uname">Flare Gun <span class="lvl">unlock</span></span>
					</td>
					<td class="num mono">{COST.flare.energy}</td>
					<td class="num mono">{COST.flare.cd} s</td>
					<td class="effect">
						45 s of vision over the point, detects the invisible, slows what stands in it — the
						enemy sees by it too. Floodlights ({COST.floodlights.energy} energy) are the other
						unlock; both come from the <a href={predatorHref}>Predator's ladder</a>.
					</td>
				</tr>
			</tbody>
		</table>
	</div>
	<p class="fine">
		Costs and cooldowns are the map's ability data; the autocannon and lasers are its weapon data.
		The Predator neither jams nor loads ammo — its Reload spends your magazines, so carry them.
	</p>

	<h2 class="section">Engineering</h2>

	<div class="cards">
		<article class="card d">
			<h3>Fixing things</h3>
			<ul class="pts icons">
				<li>
					{#if abil('RepairCE')?.icon}<img src={abil('RepairCE')?.icon} alt="" />{/if}
					<span><b>Repair</b> · 15 life per 1.5 energy, autocast. Any friendly mechanical.</span>
				</li>
				<li>
					{#if abil('Refit')?.icon}<img src={abil('Refit')?.icon} alt="" />{/if}
					<span
						><b>Refit</b> · {COST.refit.energy} energy. Clears a machine's malfunctions — and is
						what a right-click on an <em>undamaged</em> machine does, so mind where you click.</span
					>
				</li>
				<li>
					{#if abil('Overhaul')?.icon}<img src={abil('Overhaul')?.icon} alt="" />{/if}
					<span
						><b>Overhaul</b> · {COST.overhaul.energy} energy. A destroyed turret or a broken
						Predator, back in service.</span
					>
				</li>
				<li>
					{#if abil('Reconstruct')?.icon}<img src={abil('Reconstruct')?.icon} alt="" />{/if}
					<span
						><b>Reconstruct</b> · {COST.reconstruct.energy} energy. A destroyed vehicle — the tank,
						the walker, the helicopter — or the City Guard.</span
					>
				</li>
			</ul>
		</article>

		<article class="card d">
			<h3>Bolting things on</h3>
			<ul class="pts icons">
				<li>
					{#if abil('ArmorUpgrade')?.icon}<img src={abil('ArmorUpgrade')?.icon} alt="" />{/if}
					<span
						><b>Armor Upgrade</b> · Engineering 2 · {COST.armor.energy} energy. +5 armor on a
						mechanical — mechs, turrets, the convoy, the MULE, a barricade. Lost when it dies.</span
					>
				</li>
				<li>
					{#if abil('BatteryUpgrade')?.icon}<img src={abil('BatteryUpgrade')?.icon} alt="" />{/if}
					<span
						><b>Battery Upgrade</b> · Engineering 3 · {COST.battery.energy} energy. +50 maximum
						energy on a mech; on a turret that is ammunition. Lost when it dies.</span
					>
				</li>
				<li>
					{#if abil('Craft')?.icon}<img src={abil('Craft')?.icon} alt="" />{/if}
					<span
						><b>Craft</b> · Engineering 4 · {COST.craft.energy} energy, from {COST.craft.range} range.
						What it does depends on what you point it at — the table below.</span
					>
				</li>
			</ul>
			<p class="fine">
				The community's page notes that a Cyborg, a Prototype or the Rjx-73 loses its enhancement
				when it dies while the Predator keeps its own — worth a second Craft once they are back.
			</p>
		</article>
	</div>

	<h3 class="sub">What Craft does</h3>
	<div class="tablewrap">
		<table class="data shop" style="min-width: 560px">
			<thead>
				<tr>
					<th>Point it at</th>
					<th>It becomes</th>
					<th>What changes</th>
				</tr>
			</thead>
			<tbody>
				{#each CRAFT as c (c.target)}
					<tr>
						<td><span class="uname">{c.target}</span></td>
						<td class="mono">{c.into}</td>
						<td class="effect">{c.effect}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p class="fine">
		Read from the Craft trigger and the behaviours it grants. An attachment already equipped on a
		unit is upgraded in place — you do not have to take it off first.
	</p>

	<h2 class="section">With a City Guard up</h2>

	<div class="cards">
		<article class="card d">
			<h3>Two add-ons only you can buy</h3>
			<ul class="pts">
				<li>
					When a Combat Engineer is in the game the City Guard stands in Thalim, and your class
					panel gains two keys: <kbd>F1</kbd> <b>Emergency Shield Drone</b> and <kbd>F2</kbd>
					<b>Emergency Heal Drone</b>, <b>25 scraps</b> each, bought from inside Thalim.
				</li>
				<li>
					The shield drone answers to the <b>Platoon Leader</b>, the heal drone to the <b>Combat
					Medics</b> — each sends the drone to shield or heal a target. Neither exists until you buy
					it.
				</li>
				<li>
					<b>Craft the City Guard</b> and its militia drones fire 0.6 s faster; craft the <b>MULE</b>
					and it digs its scraps faster and takes a beating.
				</li>
			</ul>
			<a class="glink" href={mosTabHref('CombatEngineer', 'guide')}>The Combat Engineer's guide →</a>
		</article>

		<article class="card d">
			<h3>Predator unlocks</h3>
			<ul class="pts">
				<li>
					Six pieces, each earned by a win: floodlights, the MK II, III and IV chassis, the flare
					gun, shield regeneration — in order, each needing the ones before it.
				</li>
				<li>Every player's profile shows which they own; the requirements are on the Predator tab.</li>
			</ul>
			<a class="glink" href={predatorHref}>The Predator tab →</a>
		</article>
	</div>

	<p class="fine credit">
		Numbers are read from the map file — its ability, weapon and behaviour data and its trigger
		script.
	</p>
</GuideShell>

<style>
	.lvl {
		font-family: var(--font-mono);
		font-size: 9.5px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-faint);
		margin-left: 6px;
	}
</style>
