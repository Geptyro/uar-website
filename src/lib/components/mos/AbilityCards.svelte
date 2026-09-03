<script lang="ts">
	/**
	 * A class's abilities as cards, two abreast where the column allows: the
	 * game's own text first, and under it the level table when the data has
	 * numbers for the ability — a column per level for a tree, one column for
	 * a plain command. Skill trees and standard abilities are the same card,
	 * so a page reads as one list of what the class can do.
	 */
	import type { ClassStats } from '$lib/skillstats';
	import LevelTable from './LevelTable.svelte';

	export interface AbilityCard {
		id: string;
		name: string;
		icon: string | null;
		tooltip: string;
		levels?: number | null;
	}

	let {
		items,
		stats = {},
		anchor = 'ability',
		treeNames = {}
	}: {
		items: AbilityCard[];
		/** The level rows of these abilities, by ability id. */
		stats?: ClassStats;
		/** Prefix of each card's element id — guides link to `#skill-<id>`. */
		anchor?: string;
		/** Skill tree names by id, for the columns a tree's upgrades add to a card. */
		treeNames?: Record<string, string>;
	} = $props();
</script>

<div class="flow">
	<div class="cards">
	{#each items as a (a.id)}
		{@const rows = stats[a.id] ?? []}
		<article class="card" id="{anchor}-{a.id}">
			<h3>
				{#if a.icon}
					<img class="icon" src={a.icon} alt="" loading="lazy" />
				{:else}
					<span class="icon placeholder"></span>
				{/if}
				<span class="name">{a.name}</span>
				{#if a.levels}<span class="lv">{a.levels} lv</span>{/if}
			</h3>
			{#if a.tooltip}<p class="tip">{a.tooltip}</p>{/if}
			{#if rows.length}
				<div class="table" class:after-text={!!a.tooltip}><LevelTable {rows} {treeNames} /></div>
			{/if}
		</article>
	{/each}
	</div>
</div>

<style>
	/* Cards of very different heights — a four-level rocket beside a one-line
	   Reload. In a row grid the row takes the tallest and the short card sits
	   over a hole, so they flow as columns instead, each card whole, filled
	   top to bottom and balanced: one column until the two would each get the
	   440px a four-level table needs to keep its cells on one line. */
	.flow {
		container-type: inline-size;
	}
	.cards {
		columns: 1;
		column-gap: 12px;
	}
	@container (min-width: 900px) {
		.cards {
			columns: 2;
		}
	}
	.card {
		break-inside: avoid;
		margin-bottom: 12px;
	}
	/* the last card in a column carries the column gap's height for nothing;
	   the section below already keeps its distance, so the flow gives it back */
	.cards {
		margin-bottom: -12px;
	}
	.card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-3);
		box-shadow: var(--shadow-1);
		padding: 14px 16px;
		min-width: 0;
	}
	.card h3 {
		margin: 0 0 10px;
		font-size: 14px;
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 11px;
	}
	/* the in-game button art at close to its command-card size: the picture
	   is how a player knows the ability before reading its name */
	.icon {
		width: 44px;
		height: 44px;
		object-fit: cover;
		border-radius: var(--radius-2);
		flex-shrink: 0;
	}
	.icon.placeholder {
		display: inline-block;
		background: var(--surface-raised);
	}
	.name {
		flex: 1;
	}
	.lv {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 550;
		color: var(--accent);
		background: var(--accent-soft);
		border-radius: 99px;
		padding: 2px 8px;
		white-space: nowrap;
	}
	.tip {
		margin: 0;
		font-size: 12.5px;
		color: var(--text-dim);
		white-space: pre-line;
		max-width: 68ch;
	}
	.table.after-text {
		margin-top: 10px;
		padding-top: 8px;
		border-top: 1px solid var(--border);
	}
</style>
