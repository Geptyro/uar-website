<script lang="ts">
	/**
	 * What this player has won, game by game.
	 *
	 * Only the games that gave something: every game they have played is the
	 * Replays tab, and a feed of two hundred rows with a medal on three of them
	 * is a worse way to read those three. See $lib/awards.ts for why a game's
	 * awards are always read out of the *next* game's save file, and why the
	 * newest game therefore never has any yet.
	 */
	import { awardTimeline, type AwardGame } from '$lib/awards';
	import AwardTimeline from '$lib/components/AwardTimeline.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { Page } from 'sveltekit-commons';

	let { data } = $props();

	const p = $derived(data.player);

	const games = $derived(
		data.games.map(
			(g): AwardGame => ({
				file: g.file,
				// the stored stamp is when the recording stopped; the replay facts
				// carry the real start, and the component prefers it
				startedAt: g.playedAt,
				awards: g.awards,
				mos: g.mos,
				gamesPlayed: g.gamesPlayed,
				span: g.span
			})
		)
	);
	const rows = $derived(awardTimeline(games));

	const total = $derived(games.reduce((n, g) => n + g.awards.length, 0));
</script>

<Page>
	<Seo
		title="{p.name} — Activity"
		description="Medals, camouflages, decals, Skill Identifiers, gear and ranks {p.name} has earned in Undead Assault Reborn, game by game."
	/>

	<!-- No heading: the tab bar directly above already says Activity, and the
	     shell's crumb says whose it is. A third label would only push the first
	     game down the page. -->
	{#if rows.length}
		{#if total}
			<p class="counthint">{total} earned across {games.length} games</p>
		{/if}
		<AwardTimeline {rows} facts={data.replayFacts} />
		<p class="note">
			{#if data.truncated}
				Showing the {games.length} most recent games that earned something — older ones are in the
				<a href="replays">replay history</a>.
			{/if}
			A game's rewards are read from the save file the player carried into their <em>next</em> game,
			so the most recent game never shows any until another is uploaded.
		</p>
	{:else}
		<p class="empty">
			Nothing recorded yet. Rewards show up here once {p.name} has uploaded two games — the second is
			what reveals what the first one gave.
		</p>
	{/if}
</Page>

<style>
	/* The tab has no heading, so this is what opens it — a count, set in the
	   same quiet mono the section headings use for theirs. */
	.counthint {
		font-family: var(--font-mono);
		font-size: 11.5px;
		color: var(--text-faint);
		margin: 4px 0 14px;
	}
	.empty {
		margin: 0;
		font-size: 13px;
		color: var(--text-faint);
	}
	.note {
		margin: 14px 0 0;
		font-size: 11px;
		line-height: 1.5;
		color: var(--text-faint);
	}
</style>
