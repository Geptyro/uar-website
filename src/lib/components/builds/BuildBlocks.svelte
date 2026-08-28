<script lang="ts">
	/**
	 * One level of a guide's document, drawn: sections as the site's band
	 * heading, columns as the guide's cards side by side, text as the
	 * renderer's HTML, a table in the site's frame, a map through the guides'
	 * own component. Recursive for the containers; the styling of what the
	 * text holds lives in BuildBody, which wraps the top level.
	 */
	import ObjectiveMap from '$lib/components/ObjectiveMap.svelte';
	import type { Rendered } from '$lib/buildRender';
	import Self from './BuildBlocks.svelte';

	let { blocks, inCard = false }: { blocks: Rendered[]; inCard?: boolean } = $props();
</script>

{#each blocks as b, i (i)}
	{#if b.type === 'section'}
		<section class="bsec">
			{#if b.title}<h2 class="section">{b.title}</h2>{/if}
			<Self blocks={b.children} />
		</section>
	{:else if b.type === 'columns'}
		<!-- a column is a stack: each block of it in a card of its own, as the
		     guide's job cards stand four high beside its map; a map goes bare -->
		<div class="cols n{b.columns.length}">
			{#each b.columns as col, j (j)}
				<div class="colstack">
					{#each col as cb, k (k)}
						{#if cb.type === 'map'}
							<Self blocks={[cb]} />
						{:else}
							<div class="card colcard"><Self blocks={[cb]} inCard /></div>
						{/if}
					{/each}
				</div>
			{/each}
		</div>
	{:else if b.type === 'markdown'}
		<div class="md" class:incard={inCard}>{@html b.html}</div>
	{:else if b.type === 'table'}
		{@const wide = b.columns.findIndex((c) => c.wide)}
		{@const wideAt = wide < 0 ? b.columns.length - 1 : wide}
		<div class="tablewrap md-table" class:incard={inCard}>
			<table class="data">
				<thead>
					<tr>
						{#each b.columns as c, j (j)}
							<th class:num={c.align === 'right'} class:mid={c.align === 'center'} class:wide={j === wideAt}
								>{c.label}</th
							>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each b.rows as row, r (r)}
						<tr>
							{#each row as cell, j (j)}
								<td
									class="md"
									class:num={b.columns[j]?.align === 'right'}
									class:mid={b.columns[j]?.align === 'center'}
									class:wide={j === wideAt}>{@html cell}</td
								>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else if b.type === 'map'}
		<div class="bmap" class:incard={inCard}>
			<ObjectiveMap
				title={b.title}
				alt={b.alt}
				areas={b.areas}
				pins={b.pins}
				dots={b.dots}
				labels={b.labels}
				legend={b.legend}
				caption={b.caption || null}
			/>
		</div>
	{/if}
{/each}

<style>
	.bsec {
		margin-top: 24px;
	}
	.bsec:first-child {
		margin-top: 0;
	}
	/* the first heading on the page is not between anything: see h2.section */
	.bsec:first-child > .section {
		margin-top: 0;
	}
	.bsec > :global(* + *) {
		margin-top: 14px;
	}
	.cols {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 12px;
		align-items: stretch;
	}
	.cols.n2 {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.cols.n3 {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	@media (max-width: 900px) {
		.cols.n3 {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 760px) {
		.cols.n2,
		.cols.n3 {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	/* the guide's detail card: `.card` from the root layout, padded as `.card.d` */
	.colstack {
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-width: 0;
	}
	.colcard {
		padding: 13px 15px 14px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	/* a stack of one: the card fills the row's height, as the guide's do */
	.colstack > .colcard:only-child {
		flex: 1;
	}
	.colstack :global(.bmap) {
		max-width: none;
	}
	.md-table {
		margin: 4px 0 12px;
	}
	.md-table:last-child {
		margin-bottom: 0;
	}
	.md-table.incard {
		margin: 0;
		border: 0;
		box-shadow: none;
		border-radius: 0;
		background: none;
	}
	.md-table :global(table.data) {
		font-size: 12.5px;
	}
	.md-table :global(table.data th) {
		position: static;
	}
	/* the guide's rule: every column but the wide one is as wide as its widest
	   cell and never wraps; the wide one takes what is left and wraps; past
	   that the wrapper scrolls sideways */
	.md-table :global(table.data :is(th, td):not(.wide)) {
		width: 1%;
		white-space: nowrap;
	}
	.md-table :global(table.data td.wide) {
		min-width: 240px;
	}
	.md-table :global(:is(th, td).mid) {
		text-align: center;
	}
	.md-table :global(td.md p) {
		margin: 0;
	}
	/* the guide draws its map in half a row; alone on a page a map this wide
	   is a poster, so it keeps to the width the guide gives it */
	.bmap {
		margin: 4px 0 12px;
		max-width: 620px;
	}
	.bmap:last-child {
		margin-bottom: 0;
	}
</style>
