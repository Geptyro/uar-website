<script lang="ts">
	/**
	 * A rank track as a chip: the track's wireframe portrait from the game's
	 * rank-set dialog and its name. The one way a guide's rank is drawn, in
	 * its head, its byline and the class's list.
	 */
	import { rankTrackInfo } from '$lib/mos';
	import type { RankKey } from '$lib/ranks';

	let { rank, small = false }: { rank: RankKey; small?: boolean } = $props();
	const t = $derived(rankTrackInfo(rank));
</script>

<span class="rank" class:small title="Written for the {t.name} track">
	{#if t.icon}<img src={t.icon} alt="" loading="lazy" />{/if}
	{t.name}
</span>

<style>
	.rank {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 2px 9px 2px 3px;
		border-radius: 99px;
		background: var(--surface-raised);
		border: 1px solid var(--border);
		color: var(--text);
		font-size: 12px;
		font-weight: 600;
		white-space: nowrap;
	}
	.rank img {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		object-fit: cover;
		background: var(--surface-sunken);
	}
	.small {
		padding: 1px 7px 1px 2px;
		font-size: 11px;
		font-weight: 500;
		color: var(--text-dim);
	}
	.small img {
		width: 16px;
		height: 16px;
	}
</style>
