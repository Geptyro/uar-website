<script lang="ts">
	import { rankTracks } from '$lib/mos';

	const trackNotes: Record<number, string> = {
		1: 'The starting track — 13 ranks from Private to Sergeant Major of the Army.',
		2: 'Technical specialist track, unlocked separately from Enlisted.',
		3: 'Officer track — leadership classes and officer equipment unlock here.'
	};
</script>

<svelte:head>
	<title>Ranks — UAR Unit Database</title>
</svelte:head>

<p class="note">
	Account XP is tracked separately in three rank sets. Ranks gate class unlocks, equipment and
	Skill Identifiers; the insignia is shown as a decal on your hero. Thresholds below are the
	minimum XP in that track.
</p>

<div class="tracks">
	{#each rankTracks as track (track.track)}
		<section class="track">
			<h2 class="section">{track.name}</h2>
			{#if trackNotes[track.track]}<p class="note">{trackNotes[track.track]}</p>{/if}
			<div class="tablewrap">
				<table class="data">
					<thead>
						<tr>
							<th></th>
							<th>Grade</th>
							<th>Rank</th>
							<th class="num">XP min</th>
						</tr>
					</thead>
					<tbody>
						{#each track.ranks as r (r.idx)}
							<tr>
								<td class="icon-cell">
									{#if r.icon}<img class="insignia" src={r.icon} alt="" loading="lazy" />{/if}
								</td>
								<td class="mono grade">{r.prefix}</td>
								<td>{r.name}</td>
								<td class="num">{r.xp?.toLocaleString('en') ?? ''}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/each}
</div>

<style>
	.tracks {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 0 24px;
		align-items: start;
	}
	.track :global(h2.section) {
		margin-top: 10px;
	}
	.icon-cell {
		width: 34px;
		padding-right: 0;
	}
	.insignia {
		width: 26px;
		height: 26px;
		object-fit: contain;
		vertical-align: middle;
	}
	.grade {
		font-weight: 650;
		white-space: nowrap;
	}
</style>
