<script lang="ts">
	import {
		groupsFor,
		jamRangeFor,
		magsPerJam,
		mechanicsFor,
		pityCap,
		rules,
		shotsPerJam
	} from '$lib/mechanics';
	import JamCurve from './JamCurve.svelte';

	let { mosId }: { mosId: string } = $props();

	const m = $derived(mechanicsFor(mosId));
	const jamRange = $derived(jamRangeFor(mosId));
	const groups = $derived(groupsFor(mosId));

	const n = (v: number) => Math.round(v).toLocaleString('en-US');
	/** trims trailing zeros so 0.15 stays 0.15 and 5.0 reads as 5 */
	const secs = (v: number) => `${+v.toFixed(2)} s`;

	/** "1 in 366" reads better than a four-decimal percentage */
	const oneIn = (chance: number) => `1 in ${n(shotsPerJam(chance))}`;

	const jamReason = $derived(
		!m?.ammo.mag
			? 'Burns fuel instead of loading magazines, so it never jams.'
			: 'The jam trigger skips this class outright — it can never jam.'
	);

	const unjam = rules.jam.unjam;
	const failPct = $derived(unjam.failOdds ? Math.round(100 / unjam.failOdds) : 0);

	// the trigger names the sources by behaviour id; these read better on a page
	const BONUS_LABELS: Record<string, string> = {
		SoldierSkills: 'per Soldier Skills level',
		QuickThinking: 'Quick Thinking',
		InstructorTarget: 'instructor aura'
	};
</script>

{#if m}
	<div class="mech-grid">
		<!-- ammunition -->
		<article class="mech-card">
			<h3>Magazine</h3>
			{#if m.ammo.mag}
				<p class="stat">
					<b>{m.ammo.mag}</b><span class="unit">rounds</span>
				</p>
				{#each m.ammo.variants as v (v.weapon)}
					<p class="line">
						<span class="k">with {v.weapon}</span>{v.mag} rounds
					</p>
				{/each}
			{:else}
				<p class="stat"><b>—</b><span class="unit">fuel-fed</span></p>
			{/if}
			{#if m.ammo.reload}
				<p class="line">
					<span class="k">reload</span>{secs(m.ammo.reload)}
					{#if m.ammo.reloadIsDefault}<span class="hint">(default)</span>{/if}
				</p>
			{/if}
			{#if m.ammo.autoReload}
				<p class="note">Reloads automatically when the magazine runs dry.</p>
			{/if}
			{#if rules.reload.magExtenderMult && m.ammo.mag}
				<p class="note">
					A Magazine Extender multiplies capacity by {rules.reload.magExtenderMult}.
				</p>
			{/if}
			{#if m.ammo.conflicts.length}
				<p class="warn">
					Map bug: the respawn path sets {m.ammo.conflicts[0].mag} rounds instead of {m.ammo.mag},
					so the value depends on how the hero was spawned.
				</p>
			{/if}
		</article>

		<!-- jamming -->
		<article class="mech-card">
			<h3>Jamming</h3>
			{#if !jamRange || !m.ammo.mag}
				<p class="stat"><b>Never</b></p>
				<p class="note">{jamReason}</p>
			{:else}
				<p class="stat">
					<b>{oneIn(jamRange.max)}</b><span class="unit">shots at worst</span>
				</p>
				<p class="line">
					<span class="k">just after a jam</span>{oneIn(jamRange.min)}
				</p>
				<JamCurve mag={m.ammo.mag} />
				<p class="note">
					Keyed to the magazine size set at spawn — carrying more ammo does not lower it. Every
					class averages about one jam per {magsPerJam(jamRange.max, m.ammo.mag).toFixed(0)}
					magazines at worst; a small magazine just gets there in fewer shots.
				</p>
				<a class="mech-link" href="/mos">Compare all classes →</a>
			{/if}
		</article>

		<!-- clearing a jam -->
		{#if jamRange}
			<article class="mech-card">
				<h3>Clearing a jam</h3>
				<p class="stat">
					<b>{secs(unjam.action.min)}–{secs(unjam.action.max)}</b><span class="unit">immediate action</span>
				</p>
				<p class="line">
					<span class="k">remedial ({failPct}%)</span>{secs(unjam.remedial.min)}–{secs(
						unjam.remedial.max
					)}
				</p>
				{#each Object.entries(unjam.bonus) as [name, value] (name)}
					{#if value}
						<p class="line">
							<span class="k">{BONUS_LABELS[name] ?? name}</span>−{secs(value)} each wait
						</p>
					{/if}
				{/each}
				<p class="note">
					Immediate action clears it most of the time; one roll in {unjam.failOdds} fails and forces
					the full magazine-out sequence.
				</p>
			</article>
		{/if}

		<!-- shared behaviour -->
		{#if groups.length}
			<article class="mech-card">
				<h3>Shared behaviour</h3>
				{#each groups as g (g.id)}
					<p class="line group">
						<span class="tag t-mos">{g.label}</span>
						<span class="gdesc">{g.desc}</span>
					</p>
				{/each}
			</article>
		{/if}
	</div>
{/if}

<style>
	.mech-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr));
		gap: 12px;
		align-items: start;
	}
	.mech-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-2);
		box-shadow: var(--shadow-1);
		padding: 12px 14px;
		min-width: 0;
	}
	.mech-card h3 {
		margin: 0 0 8px;
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-faint);
		font-weight: 500;
	}
	.stat {
		margin: 0 0 8px;
		display: flex;
		align-items: baseline;
		gap: 6px;
		flex-wrap: wrap;
	}
	.stat b {
		font-size: 20px;
		font-weight: 600;
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
	}
	.stat .unit {
		font-family: var(--font-mono);
		font-size: 10.5px;
		color: var(--text-faint);
	}
	.line {
		margin: 0 0 4px;
		font-size: 12.5px;
		color: var(--text-dim);
		display: flex;
		align-items: baseline;
		gap: 8px;
		font-variant-numeric: tabular-nums;
	}
	.line .k {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.04em;
		color: var(--text-faint);
		flex: 1;
		min-width: 0;
	}
	.hint {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--text-faint);
	}
	.note {
		margin: 8px 0 0;
		font-size: 11.5px;
		line-height: 1.5;
		color: var(--text-faint);
	}
	.mech-link {
		display: inline-block;
		margin-top: 10px;
		font-family: var(--font-mono);
		font-size: 10.5px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		text-decoration: none;
		color: var(--accent);
	}
	.mech-link:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.warn {
		margin: 8px 0 0;
		font-size: 11.5px;
		line-height: 1.5;
		color: var(--hostile);
	}
	.line.group {
		flex-direction: column;
		gap: 3px;
		margin-bottom: 9px;
	}
	.gdesc {
		font-size: 11.5px;
		line-height: 1.5;
		color: var(--text-faint);
	}
</style>
