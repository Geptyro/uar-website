<script lang="ts">
	/**
	 * One level of a guide's document, editable: each block in a row with its
	 * kind, its controls (up, down, remove) and its own editor, and at the
	 * foot the blocks this level may take. Recursive for the containers,
	 * which is the whole of the nesting: a section holds anything but a
	 * section, columns hold leaves.
	 *
	 * The tree it edits is the parent's state, mutated in place: a block's
	 * fields are bound, a list is spliced. Nothing is copied out and back.
	 */
	import type { Mos } from '$lib/mos';
	import {
		BUILD_LIMITS,
		MAP_MARK_KINDS,
		MAP_TONES,
		TABLE_ALIGNS,
		allowedIn,
		type Block,
		type BlockType,
		type MapMark
	} from '$lib/builds';
	import { getContext } from 'svelte';
	import { mapSize } from '$lib/map';
	import { CONFIRM, askNative, type Ask } from '$lib/confirm';
	import { placedKinds, regionNames, renderBlocks } from '$lib/buildRender';
	import BuildBlocks from './BuildBlocks.svelte';
	import MarkdownField from './MarkdownField.svelte';
	import Self from './BlockEditor.svelte';

	let {
		blocks,
		container = null,
		mos
	}: { blocks: Block[]; container?: BlockType | null; mos: Mos } = $props();

	const allowed = $derived(allowedIn(container));
	const WORD: Record<BlockType, string> = {
		section: 'Section',
		columns: 'Columns',
		markdown: 'Text',
		table: 'Table',
		map: 'Map'
	};
	const HINT: Record<BlockType, string> = {
		section: 'a band heading over blocks',
		columns: 'two or three cards side by side',
		markdown: 'words, pictures, chips',
		table: 'a table, one cell per box',
		map: 'the minimap with marks on it'
	};

	function fresh(type: BlockType): Block {
		switch (type) {
			case 'section':
				return { type, title: '', children: [{ type: 'markdown', text: '' }] };
			case 'columns':
				return { type, columns: [[{ type: 'markdown', text: '' }], [{ type: 'markdown', text: '' }]] };
			case 'markdown':
				return { type, text: '' };
			case 'table':
				return {
					type,
					columns: [
						{ label: 'Name', align: 'left' },
						{ label: 'Cost', align: 'right' },
						{ label: 'What it does', align: 'left', wide: true }
					],
					rows: [['', '', '']]
				};
			case 'map':
				return { type, title: '', caption: '', marks: [] };
		}
	}
	function add(type: BlockType) {
		blocks.push(fresh(type));
	}
	const ask = getContext<Ask | undefined>(CONFIRM) ?? askNative;

	async function remove(i: number) {
		const b = blocks[i];
		const empty =
			(b.type === 'markdown' && !b.text.trim()) ||
			(b.type === 'map' && !b.marks.length) ||
			(b.type === 'table' && !b.rows.some((r) => r.some((c) => c.trim())));
		if (
			!empty &&
			!(await ask({ title: `Remove this ${WORD[b.type].toLowerCase()}?`, message: 'What is in it goes with it.', yes: 'Remove' }))
		)
			return;
		blocks.splice(i, 1);
	}
	function move(i: number, by: -1 | 1) {
		const j = i + by;
		if (j < 0 || j >= blocks.length) return;
		[blocks[i], blocks[j]] = [blocks[j], blocks[i]];
	}

	/* ---------- tables ---------- */
	type TableBlock = Extract<Block, { type: 'table' }>;
	function addRow(t: TableBlock) {
		if (t.rows.length < BUILD_LIMITS.table.rows) t.rows.push(t.columns.map(() => ''));
	}
	function addColumn(t: TableBlock) {
		if (t.columns.length >= BUILD_LIMITS.table.columns) return;
		t.columns.push({ label: '', align: 'left' });
		for (const r of t.rows) r.push('');
	}
	function removeColumn(t: TableBlock, j: number) {
		if (t.columns.length <= 1) return;
		t.columns.splice(j, 1);
		for (const r of t.rows) r.splice(j, 1);
	}
	function setWide(t: TableBlock, j: number) {
		t.columns.forEach((c, k) => {
			if (k === j) c.wide = true;
			else delete c.wide;
		});
	}

	/* ---------- maps ---------- */
	type MapBlock = Extract<Block, { type: 'map' }>;
	const TONE_WORD: Record<string, string> = {
		accent: 'accent',
		item: 'item',
		mos: 'class',
		hostile: 'hostile',
		gold: 'gold',
		warn: 'warn',
		lobby: 'lobby'
	};
	const round = (v: number) => Math.round(v * 10) / 10;
	/**
	 * A click on the drawn map drops a pin there: the SVG's box maps straight
	 * onto game coordinates, the y axis flipped as the map component flips it.
	 */
	function dropPin(m: MapBlock, e: MouseEvent) {
		if (m.marks.length >= BUILD_LIMITS.map.marks) return;
		const svg = (e.currentTarget as HTMLElement).querySelector('svg');
		if (!svg) return;
		const r = svg.getBoundingClientRect();
		const x = round(((e.clientX - r.left) / r.width) * mapSize);
		const y = round(mapSize - ((e.clientY - r.top) / r.height) * mapSize);
		if (x < 0 || y < 0 || x > mapSize || y > mapSize) return;
		m.marks.push({ kind: 'pin', tone: 'accent', label: '', at: { x, y } });
	}
	function addMark(m: MapBlock, kind: MapMark['kind']) {
		if (m.marks.length >= BUILD_LIMITS.map.marks) return;
		if (kind === 'dots') m.marks.push({ kind, tone: 'item', label: '', placed: placedKinds[0]?.key ?? '' });
		else m.marks.push({ kind, tone: 'accent', label: '', at: { region: regionNames[0] ?? '' } });
	}
	/** A mark sits on a point or on a region; switching keeps whichever the author picks. */
	function placeMode(mark: MapMark): 'point' | 'region' {
		return mark.at && 'region' in mark.at ? 'region' : 'point';
	}
	function setPlace(mark: MapMark, mode: 'point' | 'region') {
		if (mode === 'region') mark.at = { region: regionNames[0] ?? '' };
		else mark.at = { x: round(mapSize / 2), y: round(mapSize / 2) };
	}
	const preview = (m: MapBlock) => renderBlocks([m], null);
</script>

<div class="list">
	{#each blocks as b, i (i)}
		<div class="block b-{b.type}">
			<div class="bar">
				<span class="kind">{WORD[b.type]}</span>
				<span class="ctl">
					<button type="button" class="chip" onclick={() => move(i, -1)} disabled={i === 0} title="Move up"
						>↑</button
					>
					<button
						type="button"
						class="chip"
						onclick={() => move(i, 1)}
						disabled={i === blocks.length - 1}
						title="Move down">↓</button
					>
					<button type="button" class="chip danger" onclick={() => remove(i)}>Remove</button>
				</span>
			</div>

			{#if b.type === 'markdown'}
				<MarkdownField bind:value={b.text} {mos} />
			{:else if b.type === 'section'}
				<input
					type="text"
					class="heading"
					bind:value={b.title}
					maxlength={BUILD_LIMITS.heading}
					placeholder="Section heading (optional)"
				/>
				<Self blocks={b.children} container="section" {mos} />
			{:else if b.type === 'columns'}
				<div class="cols n{b.columns.length}">
					{#each b.columns as col, j (j)}
						<div class="colbox">
							<Self blocks={col} container="columns" {mos} />
							{#if b.columns.length > BUILD_LIMITS.columns.min}
								<button
									type="button"
									class="chip danger tiny"
									onclick={async () => {
										if (
											!col.length ||
											(await ask({ title: 'Remove this column?', message: 'What is in it goes with it.', yes: 'Remove' }))
										)
											b.columns.splice(j, 1);
									}}>Remove column</button
								>
							{/if}
						</div>
					{/each}
				</div>
				{#if b.columns.length < BUILD_LIMITS.columns.max}
					<div class="tools">
						<button
							type="button"
							class="chip"
							onclick={() => b.columns.push([{ type: 'markdown', text: '' }])}>Add a column</button
						>
					</div>
				{/if}
			{:else if b.type === 'table'}
				<div class="tablewrap tgrid">
					<table>
						<thead>
							<tr>
								{#each b.columns as c, j (j)}
									<th>
										<input
											type="text"
											bind:value={c.label}
											maxlength={BUILD_LIMITS.heading}
											placeholder="Column"
										/>
										<span class="colctl">
											<select bind:value={c.align} aria-label="Alignment">
												{#each TABLE_ALIGNS as a (a)}<option value={a}>{a}</option>{/each}
											</select>
											<label class="wide" title="The column that wraps and takes the width the others leave">
												<input
													type="radio"
													name="wide-{i}"
													checked={c.wide === true}
													onchange={() => setWide(b, j)}
												/>
												wide
											</label>
											<button
												type="button"
												class="x"
												onclick={() => removeColumn(b, j)}
												disabled={b.columns.length <= 1}
												title="Remove column">×</button
											>
										</span>
									</th>
								{/each}
								<th class="addcol">
									<button
										type="button"
										class="chip tiny"
										onclick={() => addColumn(b)}
										disabled={b.columns.length >= BUILD_LIMITS.table.columns}>+ column</button
									>
								</th>
							</tr>
						</thead>
						<tbody>
							{#each b.rows as row, r (r)}
								<tr>
									{#each row as _, j (j)}
										<td>
											<input
												type="text"
												bind:value={row[j]}
												maxlength={BUILD_LIMITS.table.cell}
												placeholder={j === 0 ? '{{item:…}} or words' : ''}
											/>
										</td>
									{/each}
									<td class="rowctl">
										<button
											type="button"
											class="x"
											onclick={() => b.rows.splice(r, 1)}
											title="Remove row">×</button
										>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<div class="tools">
					<button
						type="button"
						class="chip"
						onclick={() => addRow(b)}
						disabled={b.rows.length >= BUILD_LIMITS.table.rows}>Add a row</button
					>
					<span class="fine">Cells take inline markdown: `F1`, [[…]], {'{{…}}'}, **bold**.</span>
				</div>
			{:else if b.type === 'map'}
				<div class="maprow">
					<div class="mapside">
						<input
							type="text"
							class="heading"
							bind:value={b.title}
							maxlength={BUILD_LIMITS.heading}
							placeholder="Map heading (optional)"
						/>
						<!-- a pointer tool: the marks list beside it is the keyboard's way in -->
						<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
						<div class="mapclick" onclick={(e) => dropPin(b, e)} title="Click the map to drop a pin">
							<BuildBlocks blocks={preview(b)} />
						</div>
						<input
							type="text"
							bind:value={b.caption}
							maxlength={BUILD_LIMITS.map.caption}
							placeholder="Caption under the map (optional)"
						/>
					</div>
					<div class="marks">
						<span class="k">Marks <small>click the map to drop a pin, or add one here</small></span>
						{#each b.marks as mark, k (k)}
							<div class="mark">
								<select bind:value={mark.kind} aria-label="Kind">
									{#each MAP_MARK_KINDS as kind (kind)}<option value={kind}>{kind}</option>{/each}
								</select>
								<select bind:value={mark.tone} aria-label="Colour" class="tone t-{mark.tone}">
									{#each MAP_TONES as t (t)}<option value={t}>{TONE_WORD[t]}</option>{/each}
								</select>
								<input
									type="text"
									bind:value={mark.label}
									maxlength={BUILD_LIMITS.heading}
									placeholder={mark.kind === 'dots' ? 'Legend entry' : 'Label (optional)'}
								/>
								{#if mark.kind === 'dots'}
									<select bind:value={mark.placed} aria-label="Placed objects">
										{#each placedKinds as p (p.key)}<option value={p.key}>{p.key} ({p.count})</option>{/each}
									</select>
								{:else}
									<select
										value={placeMode(mark)}
										onchange={(e) => setPlace(mark, e.currentTarget.value as 'point' | 'region')}
										aria-label="Placed on"
									>
										<option value="point">at a point</option>
										<option value="region">on a region</option>
									</select>
									{#if mark.at && 'region' in mark.at}
										<input
											type="text"
											list="regions-{i}"
											bind:value={mark.at.region}
											placeholder="Region name"
											class="region"
										/>
									{:else if mark.at}
										<input type="number" bind:value={mark.at.x} min="0" max={mapSize} step="0.1" aria-label="x" />
										<input type="number" bind:value={mark.at.y} min="0" max={mapSize} step="0.1" aria-label="y" />
									{/if}
									{#if mark.kind === 'area'}
										<input
											type="number"
											bind:value={mark.r}
											min="1"
											max={mapSize / 2}
											step="0.5"
											placeholder="radius"
											aria-label="Radius"
											title="Radius in map units; empty means the region's own size"
										/>
									{/if}
								{/if}
								<button type="button" class="x" onclick={() => b.marks.splice(k, 1)} title="Remove mark">×</button>
							</div>
						{/each}
						<datalist id="regions-{i}">
							{#each regionNames as n (n)}<option value={n}></option>{/each}
						</datalist>
						<div class="tools">
							<button type="button" class="chip tiny" onclick={() => addMark(b, 'pin')}>+ pin</button>
							<button type="button" class="chip tiny" onclick={() => addMark(b, 'area')}>+ area</button>
							<button type="button" class="chip tiny" onclick={() => addMark(b, 'label')}>+ label</button>
							<button type="button" class="chip tiny" onclick={() => addMark(b, 'dots')}>+ dots</button>
						</div>
						<span class="fine">
							A mark on a region follows the map's data: a re-extraction that moves the region moves the
							mark. Dots draw every pre-placed object of one kind.
						</span>
					</div>
				</div>
			{/if}
		</div>
	{/each}

	<div class="add">
		{#each allowed as t (t)}
			<button type="button" class="chip" onclick={() => add(t)} title={HINT[t]}>+ {WORD[t]}</button>
		{/each}
	</div>
</div>

<style>
	.list {
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-width: 0;
	}
	.block {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-3);
		padding: 10px 12px 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
	}
	.block.b-section {
		border-left: 3px solid var(--accent);
	}
	.block.b-columns {
		border-left: 3px solid var(--mos);
	}
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.kind {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-faint);
	}
	.ctl,
	.tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}
	.add {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 2px 0;
	}
	.chip.tiny {
		padding: 4px 9px;
		font-size: 10.5px;
	}
	.chip.danger:hover {
		border-color: var(--hostile);
		color: var(--hostile);
	}
	.chip:disabled {
		opacity: 0.5;
		cursor: default;
	}
	input[type='text'],
	input[type='number'] {
		width: 100%;
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-2);
		padding: 6px 10px;
		font: inherit;
		font-size: 13px;
		min-width: 0;
	}
	input:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-soft);
	}
	.heading {
		font-weight: 600;
	}
	select {
		font-size: 11.5px;
		padding: 5px 8px;
	}
	.x {
		border: 0;
		background: none;
		color: var(--text-faint);
		font-size: 16px;
		line-height: 1;
		cursor: pointer;
		padding: 2px 6px;
	}
	.x:hover {
		color: var(--hostile);
	}
	.x:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.fine {
		font-size: 11.5px;
		line-height: 1.5;
		color: var(--text-faint);
	}
	.k {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-faint);
	}
	.k small {
		text-transform: none;
		letter-spacing: 0;
		font: 11.5px/1.4 var(--font-sans);
		margin-left: 8px;
	}

	/* ---------- columns ---------- */
	.cols {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 10px;
	}
	.cols.n2 {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.cols.n3 {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	@media (max-width: 900px) {
		.cols.n2,
		.cols.n3 {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	.colbox {
		border: 1px dashed var(--border-strong);
		border-radius: var(--radius-2);
		padding: 8px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
	}

	/* ---------- the table grid ---------- */
	.tgrid {
		box-shadow: none;
	}
	.tgrid table {
		border-collapse: collapse;
		width: 100%;
	}
	.tgrid th,
	.tgrid td {
		padding: 4px;
		vertical-align: top;
		border-bottom: 1px solid var(--border);
		min-width: 120px;
	}
	.tgrid th {
		background: var(--surface-raised);
	}
	.tgrid th input {
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.colctl {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-top: 4px;
	}
	.colctl .wide {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font: 10.5px var(--font-mono);
		color: var(--text-faint);
		white-space: nowrap;
	}
	.tgrid .addcol,
	.tgrid .rowctl {
		min-width: 0;
		width: 1%;
		white-space: nowrap;
		vertical-align: middle;
	}
	.tgrid td input {
		font-size: 12.5px;
	}

	/* ---------- the map editor ---------- */
	.maprow {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 14px;
		align-items: start;
	}
	@media (max-width: 900px) {
		.maprow {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	.mapside {
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
	}
	.mapclick {
		cursor: crosshair;
	}
	.marks {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
	}
	.mark {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		align-items: center;
	}
	.mark input[type='text'] {
		flex: 1 1 110px;
		min-width: 90px;
	}
	.mark input[type='number'] {
		width: 76px;
		flex: none;
	}
	.mark select {
		flex: none;
	}
	.tone.t-accent {
		color: var(--accent);
	}
	.tone.t-item {
		color: var(--item);
	}
	.tone.t-mos {
		color: var(--mos);
	}
	.tone.t-hostile {
		color: var(--hostile);
	}
</style>
