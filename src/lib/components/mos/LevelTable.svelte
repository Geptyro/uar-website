<script lang="ts">
	/**
	 * The numbers of one ability, a column per level: what a level costs, how
	 * long it takes, what it does. A one-level command is the same table with
	 * no level header. A tinted cell is a value the level changed — what the
	 * level bought — so the table answers "is the next level worth it" without
	 * reading every column against the one before.
	 */
	import StatIcon from '$lib/components/StatIcon.svelte';
	import ModeMark from '$lib/components/ModeMark.svelte';
	import { unitById } from '$lib/units';
	import { changed, columnLabel, footNotes, statRows, type LevelStats } from '$lib/skillstats';

	let { rows, treeNames = {} }: { rows: LevelStats[]; treeNames?: Record<string, string> } = $props();

	const stats = $derived(statRows(rows));
	const multi = $derived(rows.length > 1);
	const notes = $derived(footNotes(rows, treeNames));

	/** Prose that every level repeats word for word is written once, across the levels. */
	function spans(d: (typeof stats)[number]): boolean {
		if (!multi) return false;
		const c0 = d.cells[0];
		if (!c0 || !(c0.blocks || c0.lines || c0.nested)) return false;
		return d.cells.every((c) => c && c.text === c0.text);
	}
</script>

{#if stats.length}
	<div class="wrap">
		<table class="stat">
			{#if multi}
				<thead>
					<tr>
						<th class="lbl"></th>
						{#each rows as r (r.lv)}
							<th>{columnLabel(r, rows)}</th>
						{/each}
					</tr>
				</thead>
			{/if}
			<tbody>
				{#each stats as d, i (i)}
					<tr>
						<td class="lbl">
							<StatIcon name={d.icon} size={16} />
							<span class="lname">
								{d.label}
								{#if d.note}<span class="lnote">{d.note}</span>{/if}
							</span>
						</td>
						{#each spans(d) ? d.cells.slice(0, 1) : d.cells as c, j (j)}
							<td
								colspan={spans(d) ? rows.length : 1}
								class:chg={c && !spans(d) && changed(d.cells, j)}
								class:empty={!c}
								class:prose={!!(c?.blocks || c?.lines || c?.nested)}
							>
								{#if c?.nested}
									<div class="nest">
										<div>
											<span class="btitle">{c.nested.title}</span>
											{#if c.nested.note}<span class="bnote">{c.nested.note}</span>{/if}
										</div>
										<table class="kv">
											<tbody>
												{#each c.nested.kv as x, k (k)}
													<tr>
														<th>{x.k}</th>
														<td>
															{x.v}
															{#if x.tags?.length}
																<span class="tags">
																	{#each x.tags as t, q (q)}
																		<span class="tag">{#if t.icon}<StatIcon name={t.icon} size={12} />{/if}{t.text}</span>
																	{/each}
																</span>
															{/if}
														</td>
													</tr>
												{/each}
											</tbody>
										</table>
										{#if c.nested.blocks?.length}
											<ul class="blocks">
												{#each c.nested.blocks as b, k (k)}
													<li>
														<span class="btitle">{b.title}</span>
														{#if b.note}<span class="bnote">{b.note}</span>{/if}
														<ul class="bitems">{#each b.items as it, q (q)}<li>{it}</li>{/each}</ul>
													</li>
												{/each}
											</ul>
										{/if}
									</div>
								{:else if c?.blocks}
									<ul class="blocks">
										{#each c.blocks as b, k (k)}
											<li>
												<span class="btitle">{b.title}</span>
												{#if b.note}<span class="bnote">{b.note}</span>{/if}
												{#if b.modes?.length}
													<span class="bmodes">
														{#each b.modes as m (m)}<ModeMark mode={m} />{/each}
														<span class="bnote">only</span>
													</span>
												{/if}
												<ul class="bitems">{#each b.items as it, q (q)}<li>{it}</li>{/each}</ul>
											</li>
										{/each}
									</ul>
								{:else if c?.lines}
									<ul class="lines">
										{#each c.lines as l, k (k)}<li>{l}</li>{/each}
									</ul>
								{:else if c?.parts}
									{#each c.parts as p, k (k)}
										{#if k > 0}, {/if}
										{#if p.unit && unitById.has(p.unit)}
											<a href="/entities/{p.unit}">{p.text}</a>
										{:else}
											{p.text}
										{/if}
									{/each}
									{#if c.sub}<span class="sub">{c.sub}</span>{/if}
								{:else if c}
									{c.text}
									{#if c.tags?.length}
										<span class="tags">
											{#each c.tags as t, k (k)}
												<span class="tag">
													{#if t.icon}<StatIcon name={t.icon} size={12} />{/if}{t.text}
												</span>
											{/each}
										</span>
									{/if}
									{#if c.sub}<span class="sub">{c.sub}</span>{/if}
								{:else}
									–
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	{#if notes.length}
		<p class="foot">
			{#each notes as n (n.lead)}<b>{n.lead}:</b> {n.text}{' '}{/each}
		</p>
	{/if}
{:else}
	<p class="none">No numbers in the map data for this one.</p>
{/if}

<style>
	.wrap {
		overflow-x: auto;
	}
	.stat {
		border-collapse: collapse;
		width: 100%;
		font-size: 12.5px;
		font-variant-numeric: tabular-nums;
	}
	.stat th {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text-faint);
		text-align: right;
		padding: 5px 8px;
		border-bottom: 1px solid var(--border-strong);
		white-space: nowrap;
	}
	.stat td {
		padding: 5px 8px;
		border-bottom: 1px solid var(--border);
		vertical-align: top;
		text-align: right;
		font-family: var(--font-mono);
		font-size: 12px;
		white-space: pre-line;
	}
	.stat tr:last-child td {
		border-bottom: none;
	}
	.stat td.lbl {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		text-align: left;
		font-family: var(--font-sans);
		font-size: 12.5px;
		color: var(--text-dim);
		white-space: nowrap;
	}
	.stat td.lbl :global(svg) {
		margin-top: 1px;
	}
	.lnote {
		display: block;
		font-size: 10.5px;
		color: var(--text-faint);
	}
	/* the tint says "this level changed it" — the accent at a whisper, so the
	   tinted cells read as a pattern down the column, not as buttons */
	.stat td.chg {
		background: color-mix(in srgb, var(--accent) 16%, transparent);
		color: var(--text);
		font-weight: 550;
	}
	.stat td.empty {
		color: var(--text-faint);
	}
	/* a buff list or a toggle's effects are read, not compared: left, in the
	   text face, one entry per line, the buff's name leading its numbers */
	/* columns take the width their content asks for and the wrapper scrolls when
	   the table is wider than the card; prose keeps room enough to be read */
	.stat td.prose {
		text-align: left;
		font-family: var(--font-sans);
		font-size: 12.5px;
		white-space: normal;
		min-width: 16em;
	}
	.stat td.prose .lines li {
		white-space: nowrap;
	}
	.blocks,
	.lines {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 6px;
	}
	.lines {
		gap: 2px;
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.btitle {
		font-weight: 550;
		color: var(--text);
	}
	.bnote {
		margin-left: 6px;
		font-family: var(--font-mono);
		font-size: 10.5px;
		color: var(--text-faint);
	}
	.bitems {
		list-style: none;
		margin: 1px 0 0;
		padding: 0;
		font-family: var(--font-mono);
		font-size: 11.5px;
		color: var(--text-dim);
	}
	.bmodes {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		margin-left: 6px;
		vertical-align: middle;
	}
	.bmodes :global(.mode) {
		font-size: 11px;
	}
	/* a target type after a number: the type's icon and word, small and quiet */
	.tags {
		display: block;
	}
	.tag {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-family: var(--font-sans);
		font-size: 10.5px;
		color: var(--text-faint);
		white-space: nowrap;
	}
	.tag + .tag {
		margin-left: 6px;
	}
	/* the weapon an ammo mode brings: a small key/value table inside the cell */
	.nest {
		display: grid;
		gap: 4px;
		justify-items: start; /* the small table keeps its own width, not the cell's */
	}
	.kv {
		border-collapse: collapse;
		font-family: var(--font-mono);
		font-size: 11.5px;
		font-variant-numeric: tabular-nums;
	}
	.kv th {
		font-family: var(--font-sans);
		font-size: 11px;
		font-weight: 500;
		color: var(--text-faint);
		text-align: left;
		padding: 1px 10px 1px 0;
		white-space: nowrap;
		vertical-align: top;
		border: none;
		background: none;
		letter-spacing: 0;
		text-transform: none;
		position: static;
	}
	.kv td {
		padding: 1px 0;
		border: none;
		text-align: left;
		color: var(--text);
		white-space: normal;
	}
	.kv td .tags {
		display: inline;
		margin-left: 6px;
	}
	.stat td a {
		color: inherit;
		text-decoration: underline;
		text-decoration-color: var(--border-strong);
		text-underline-offset: 3px;
	}
	.stat td a:hover {
		color: var(--accent);
		text-decoration-color: currentColor;
	}
	.sub {
		display: block;
		color: var(--text-faint);
		font-size: 10.5px;
		font-weight: 400;
	}
	.foot,
	.none {
		margin: 8px 0 0;
		font-size: 11.5px;
		color: var(--text-faint);
	}
	.foot b {
		font-weight: 550;
		color: var(--text-dim);
	}
</style>
