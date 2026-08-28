<script lang="ts">
	/**
	 * Where a guide is written: the same form for a new one and an edit.
	 *
	 * The head is two pickers over the class's own data (modes, skill order),
	 * so an author clicks the game's things rather than spelling them. The
	 * body is the block tree, edited in place by BlockEditor: sections,
	 * columns, text, tables, maps.
	 *
	 * Two ways to look at it: Write, the form; Preview, the whole build drawn
	 * as its page will draw it (head and every block), with the form still in
	 * the document so Save works from either. The preview runs the very same
	 * renderer as the page, so nothing shown here differs from what is
	 * published.
	 *
	 * A plain POST, no `enhance`: a save is a navigation to the guide, and a
	 * refused one comes back with the fields filled in from `values`, the way
	 * the feedback form does. The parts that need script (upload, search,
	 * preview, the pickers' state) are conveniences over a form that still
	 * submits.
	 */
	import { setContext, untrack } from 'svelte';
	import { CONFIRM, type Ask } from '$lib/confirm';
	import Confirm from '$lib/components/Confirm.svelte';
	import { rankTracksFor, siFor, skillIdentifiers, type Mos } from '$lib/mos';
	import { isRankKey, siTracks, type RankKey } from '$lib/ranks';
	import RankMark from '$lib/components/RankMark.svelte';
	import { modeNames } from '$lib/players';
	import { rules, skillPoints } from '$lib/mechanics';
	import {
		BUILD_LIMITS,
		SKILL_LEVELS_FALLBACK,
		allText,
		levelOfPoint,
		readBlocks,
		skillCounts,
		readSiPicks,
		type Block,
		type BuildStatus,
		type SiPick
	} from '$lib/builds';
	import { MARKDOWN_HELP } from '$lib/buildMarkdown';
	import { FORMAT_VERSION, formatHref } from '$lib/buildFormat';
	import { SCHEMA_URL } from '$lib/buildSchema';
	import { renderBlocks } from '$lib/buildRender';
	import { refResolver } from '$lib/buildRefs';
	import BlockEditor from './BlockEditor.svelte';
	import BuildBody from './BuildBody.svelte';
	import BuildHead from './BuildHead.svelte';
	import ModeMark from '$lib/components/ModeMark.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';

	interface Initial {
		title: string;
		modes: string[];
		ranks: RankKey[];
		skills: string[];
		sis: SiPick[];
		blocks: Block[];
	}

	let {
		mos,
		initial,
		status,
		mayPublish,
		error
	}: {
		mos: Mos;
		initial: Initial;
		/** 'new' for one not saved yet; otherwise the guide's state, which decides the buttons. */
		status: 'new' | BuildStatus;
		mayPublish: boolean;
		error: string | null;
	} = $props();

	/* ---------- state ---------- */
	// `initial` is read once, on purpose: what the author types from here on is
	// theirs, and a prop that changed under them must not overwrite it
	const start = untrack(() => initial);
	let title = $state(start.title);
	let modes = $state<string[]>([...start.modes]);
	/* the tracks this class is open to; one alone is the guide's track, picked and kept */
	const trackChoices = untrack(() => rankTracksFor(mos.id));
	const lockedTrack = trackChoices.length === 1 ? trackChoices[0] : null;
	let ranks = $state<RankKey[]>(lockedTrack ? [lockedTrack.key] : [...start.ranks]);
	let skills = $state<string[]>([...start.skills]);
	let sis = $state<SiPick[]>(start.sis.map((p) => ({ ...p })));
	const picked = (num: number) => sis.some((p) => p.num === num);
	function togglePick(num: number) {
		const i = sis.findIndex((p) => p.num === num);
		if (i >= 0) sis.splice(i, 1);
		else if (sis.length < BUILD_LIMITS.sis) sis.push({ num });
	}
	function setChoice(num: number, choice: string) {
		const p = sis.find((x) => x.num === num);
		if (!p) return;
		if (choice) p.choice = choice;
		else delete p.choice;
	}
	// a deep copy through the reader, so the tree is the editor's own
	let blocks = $state<Block[]>(
		start.blocks.length
			? readBlocks(JSON.stringify(start.blocks))
			: [{ type: 'markdown', text: '' }]
	);
	let submitting = $state(false);
	/** Write the form, or look at the whole build as the page will draw it. */
	let mode = $state<'write' | 'preview'>('write');

	const original = untrack(() => JSON.stringify({ title, modes, ranks, skills, sis, blocks }));
	const dirty = $derived(JSON.stringify({ title, modes, ranks, skills, sis, blocks }) !== original);

	const resolve = $derived(refResolver(mos.id));
	const rendered = $derived(mode === 'preview' ? renderBlocks(blocks, resolve) : []);
	const draft = $derived(status === 'new' || status === 'draft');
	const textLength = $derived(allText(blocks).length);

	/* ---------- in and out as a document ---------- */
	let importText = $state('');
	let importNote = $state('');
	/* the editor's one question box; the block editor below asks through it too */
	let confirmBox = $state<Confirm>();
	const ask: Ask = (q) => confirmBox!.ask(q);
	setContext(CONFIRM, ask);

	let importPanel = $state<HTMLDetailsElement>();
	/** Open the import panel and go there: the button for it sits with the mode switch. */
	function showImport() {
		mode = 'write';
		if (importPanel) {
			importPanel.open = true;
			importPanel.scrollIntoView({ block: 'center', behavior: 'smooth' });
			importPanel.querySelector<HTMLTextAreaElement>('textarea')?.focus();
		}
	}

	/** The editor's state as the export endpoint would write it: what an AI is handed, what Import takes. */
	function exportJson(): string {
		return JSON.stringify(
			{ $schema: SCHEMA_URL, format: formatHref(mos.id), version: FORMAT_VERSION, mos: mos.id, title, modes, ranks, skills, sis, blocks },
			null,
			'\t'
		);
	}
	function download() {
		const blob = new Blob([exportJson()], { type: 'application/json' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `${mos.id}-build.json`;
		a.click();
		URL.revokeObjectURL(a.href);
	}
	/**
	 * A document in: the top-level fields, read the way a save reads them, so
	 * junk drops out here and the rules are the same ones Save applies. What
	 * was in the editor is replaced, after a word if it was worth anything.
	 */
	async function importFrom(text: string) {
		let doc: Record<string, unknown>;
		try {
			doc = JSON.parse(text) as Record<string, unknown>;
		} catch {
			importNote = 'That is not JSON.';
			return;
		}
		if (!doc || typeof doc !== 'object' || !Array.isArray(doc.blocks)) {
			importNote = 'No `blocks` in it: not a guide document.';
			return;
		}
		if (doc.mos && doc.mos !== mos.id) {
			importNote = `This document is for ${String(doc.mos)}, not the ${mos.name}; its skills and SIs may not fit.`;
		} else importNote = '';
		if (
			dirty &&
			!(await ask({
				title: 'Replace what is in the editor?',
				message: 'The document takes the place of everything written here.',
				yes: 'Replace',
				danger: false
			}))
		)
			return;
		const str = (v: unknown) => (typeof v === 'string' ? v : '');
		const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
		title = str(doc.title).slice(0, BUILD_LIMITS.title.max);
		modes = list(doc.modes).filter((m) => modeNames.includes(m));
		ranks = list(doc.ranks).filter(isRankKey).filter((r) => trackChoices.some((t) => t.key === r));
		skills = list(doc.skills).slice(0, BUILD_LIMITS.skills);
		sis = readSiPicks(doc.sis).slice(0, BUILD_LIMITS.sis);
		const read = readBlocks(doc.blocks);
		blocks = read.length ? read : [{ type: 'markdown', text: '' }];
		importText = '';
		mode = 'write';
		if (!importNote) importNote = 'Imported. Look it over, then save.';
	}

	/* ---------- the head's pickers ---------- */
	/* the class's own SIs first, then the ones any class may take, in the dialog's order */
	const siChoices = $derived(
		[...siFor(mos.id), ...skillIdentifiers.filter((s) => s.mos === null)].sort(
			(a, b) => Number(b.mos !== null) - Number(a.mos !== null) || a.order - b.order
		)
	);
	/* with tracks picked, only the SIs those tracks sell */
	const siShown = $derived(
		siChoices.filter((s) => !ranks.length || siTracks(s.xp).some((t) => ranks.includes(t)))
	);
	$effect(() => {
		const ok = new Set(siShown.map((s) => s.num));
		if (sis.some((p) => !ok.has(p.num))) sis = sis.filter((p) => ok.has(p.num));
	});
	const caps = $derived(new Map(mos.skills.map((s) => [s.id, s.levels ?? SKILL_LEVELS_FALLBACK])));
	const spent = $derived(new Map(skillCounts(skills).map((c) => [c.id, c.points])));
	const skillById = $derived(new Map(mos.skills.map((s) => [s.id, s])));
	/** What the game hands out: one point per level, up to the cap (see $lib/mechanics). */
	const points = Math.min(skillPoints, BUILD_LIMITS.skills);
	function addPoint(id: string) {
		if ((spent.get(id) ?? 0) < (caps.get(id) ?? 0) && skills.length < points) skills.push(id);
	}
</script>

<svelte:window
	onbeforeunload={(e) => {
		if (dirty && !submitting) e.preventDefault();
	}}
/>

{#snippet modebar()}
	<div class="modebar" role="group" aria-label="Write or preview">
		<button type="button" class="chip" aria-pressed={mode === 'write'} onclick={() => (mode = 'write')}
			>Write</button
		>
		<button
			type="button"
			class="chip"
			aria-pressed={mode === 'preview'}
			onclick={() => (mode = 'preview')}>Preview</button
		>
		<span class="sep"></span>
		<button type="button" class="chip" onclick={download} title="Download this guide as a JSON document"
			>Export JSON</button
		>
		<button type="button" class="chip" onclick={showImport} title="Load a JSON document into the editor"
			>Import…</button
		>
		<a
			class="chip"
			href="/guides/schema.json"
			download="uar-build-schema.json"
			data-sveltekit-reload
			title="The JSON schema a guide document follows: hand it to an AI with the format">Schema</a
		>
		<a
			class="chip"
			href={formatHref(mos.id)}
			download="{mos.id}-build-format.json"
			data-sveltekit-reload
			title="The {mos.name}'s format: its skills, modes, SIs, regions, and what every block may hold">Format</a
		>
		{#if mode === 'preview'}
			<span class="fine">The guide as its page will show it. Nothing is saved until you save.</span>
		{/if}
	</div>
{/snippet}

<form method="POST" class="editor" onsubmit={() => (submitting = true)}>
	{#if error}
		<p class="quote error">{error}</p>
	{/if}

	{@render modebar()}

	{#if mode === 'preview'}
		<div class="whole">
			<h2 class="ptitle">{title.trim() || 'Untitled build'}</h2>
			<BuildHead {mos} {modes} {ranks} {skills} {sis} />
			{#if textLength || blocks.some((b) => b.type === 'map')}
				<BuildBody blocks={rendered} />
			{:else}
				<p class="note">Nothing written yet.</p>
			{/if}
		</div>
	{/if}

	<!-- `hidden`, not an {#if}: the fields stay in the document, so a save
	     from the preview posts exactly what the form holds -->
	<div class="fields" hidden={mode === 'preview'}>
		<label class="field">
			<span class="k">Title</span>
			<input
				type="text"
				name="title"
				bind:value={title}
				maxlength={BUILD_LIMITS.title.max}
				required
				placeholder="What this guide is, in a few words"
			/>
		</label>

		<div class="field">
			<span class="k">Modes <small>which game modes it is written for; none means any</small></span>
			<div class="picks">
				{#each modeNames as m, n (m)}
					<label class="pick mode" class:on={modes.includes(m)}>
						<input type="checkbox" name="modes" value={m} bind:group={modes} />
						<ModeMark mode={n + 1} />
					</label>
				{/each}
			</div>
		</div>

		<div class="field">
			<span class="k">
				Rank
				<small>
					{#if lockedTrack}
						the {mos.name} is only played as a {lockedTrack.name}
					{:else}
						which rank tracks it is written for; none means any{#if trackChoices.length < 3}
							· the {mos.name} is open to the {trackChoices.map((t) => t.name).join(' and ')}{/if}
					{/if}
				</small>
			</span>
			<div class="picks">
				{#if lockedTrack}
					<span class="pick mode on locked">
						<input type="hidden" name="ranks" value={lockedTrack.key} />
						<RankMark rank={lockedTrack.key} />
					</span>
				{:else}
					{#each trackChoices as t (t.key)}
						<label class="pick mode" class:on={ranks.includes(t.key)}>
							<input type="checkbox" name="ranks" value={t.key} bind:group={ranks} />
							<RankMark rank={t.key} />
						</label>
					{/each}
				{/if}
			</div>
		</div>

		<div class="field">
			<span class="k">
				Skill IDs
				<small
					>the skill identifiers the guide takes; the class's own come first{#if ranks.length}
						· only the ones sold on that track{/if}</small
				>
			</span>
			<div class="picks">
				{#each siShown as si (si.num)}
					<!-- no href here: it would make the wrapper a link and swallow the pick -->
					<Tooltip label={si.name} text={si.desc} icon={si.icon} focusable={false}>
						<button
							type="button"
							class="pick si"
							class:on={picked(si.num)}
							aria-pressed={picked(si.num)}
							onclick={() => togglePick(si.num)}
						>
							{#if si.icon}<img src={si.icon} alt="" />{/if}
							{si.name}
							<b>{si.code}</b>
						</button>
					</Tooltip>
				{/each}
			</div>
			<!-- an SI with a menu in the game (the Battle Buddy's minis) asks which entry -->
			{#each siShown.filter((s) => s.choices?.length && picked(s.num)) as si (si.num)}
				<label class="menu">
					<span>{si.name}:</span>
					<select
						value={sis.find((p) => p.num === si.num)?.choice ?? ''}
						onchange={(e) => setChoice(si.num, e.currentTarget.value)}
					>
						<option value="">any</option>
						{#each si.choices ?? [] as c (c.key)}
							<option value={c.key}>{c.name}{c.special ? ` (${c.special.unit} as ${c.special.mos.join(' / ')})` : ''}</option>
						{/each}
					</select>
				</label>
			{/each}
			<input type="hidden" name="sis" value={JSON.stringify(sis)} />
		</div>

		<div class="field">
			<span class="k">
				Skill order
				<small>
					click a skill to spend the next point on it; one point per level, the first at level 1, {points}
					by level {rules.levels.max}
				</small>
			</span>
			<div class="picks">
				{#each mos.skills as s (s.id)}
					{@const n = spent.get(s.id) ?? 0}
					{@const cap = caps.get(s.id) ?? 0}
					<button
						type="button"
						class="pick skill"
						class:on={n > 0}
						disabled={n >= cap}
						onclick={() => addPoint(s.id)}
						title={s.tooltip}
					>
						{#if s.icon}<img src={s.icon} alt="" />{/if}
						{s.name}
						<b>{n}/{cap}</b>
					</button>
				{/each}
			</div>
			{#if skills.length}
				<ol class="order">
					{#each skills as id, i (i)}
						{@const s = skillById.get(id)}
						{@const lv = levelOfPoint(i, rules.levels.pointsPerLevel)}
						<li>
							<button
								type="button"
								title="Level {lv}: {s?.name ?? id} (click to take this point back)"
								onclick={() => skills.splice(i, 1)}
							>
								{#if s?.icon}<img src={s.icon} alt="" />{:else}<span class="ph"></span>{/if}
								<b>{lv}</b>
							</button>
						</li>
					{/each}
					<li class="ocount">
						{skills.length} / {points} · badge = the level the point comes with
						<button type="button" class="chip clear" onclick={() => skills.splice(0)}>Clear</button>
					</li>
				</ol>
			{/if}
			<input type="hidden" name="skills" value={skills.join(',')} />
		</div>

		<div class="field">
			<span class="k">
				The guide
				<small
					>blocks, top to bottom: a section is a band heading, columns put cards side by side, text
					takes markdown and @ for the game's things, a table is a grid, a map is the minimap with
					marks on it</small
				>
			</span>
			<BlockEditor {blocks} {mos} />
			<div class="sadd">
				<span class="count" class:over={textLength > BUILD_LIMITS.text.max}>
					{textLength.toLocaleString('en')} / {BUILD_LIMITS.text.max.toLocaleString('en')} characters
				</span>
			</div>
			<input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
		</div>

		<details class="help" bind:this={importPanel}>
			<summary>Import or export the guide as a document</summary>
			<p>
				A guide is a JSON document. Export this one to keep it, or to hand an AI the pattern for a
				new one together with <a href="/guides/schema.json" target="_blank" rel="noopener" data-sveltekit-reload>the schema</a>
				and <a href={formatHref(mos.id)} target="_blank" rel="noopener" data-sveltekit-reload>the format</a> (what every block
				may hold, and the {mos.name}'s own ids). Import what comes back here; the same rules apply when
				you save.
			</p>
			<div class="tools">
				<button type="button" class="chip" onclick={download}>Export JSON</button>
				<label class="chip">
					Import a file
					<input
						type="file"
						accept="application/json,.json"
						hidden
						onchange={(e) => {
							const f = e.currentTarget.files?.[0];
							if (f) void f.text().then(importFrom);
							e.currentTarget.value = '';
						}}
					/>
				</label>
			</div>
			<textarea
				class="importbox"
				rows="5"
				bind:value={importText}
				placeholder="Or paste a document here…"
			></textarea>
			<div class="tools">
				<button type="button" class="chip" onclick={() => importFrom(importText)} disabled={!importText.trim()}
					>Import what is pasted</button
				>
				{#if importNote}<span class="fine">{importNote}</span>{/if}
			</div>
		</details>

		<details class="help">
			<summary>What you can write in a text block</summary>
			<table>
				<tbody>
					{#each MARKDOWN_HELP as h (h.syntax)}
						<tr><td><code>{h.syntax}</code></td><td>{h.means}</td></tr>
					{/each}
				</tbody>
			</table>
			<p>
				Pictures: the button, or paste or drop one into a text block. Up to {BUILD_LIMITS.images} per
				build; they are resized to {BUILD_LIMITS.imageSide}px. For placements, a map block with pins,
				or an annotated screenshot.
			</p>
		</details>
	</div>

	<div class="actions">
		{@render modebar()}
		{#if draft}
			<button class="chip" name="intent" value="draft">Save draft</button>
			<button
				class="chip primary"
				name="intent"
				value="publish"
				disabled={!mayPublish}
				title={mayPublish
					? ''
					: 'Publishing needs a linked profile that has appeared in an uploaded replay'}
			>
				Publish
			</button>
			{#if !mayPublish}
				<span class="fine">
					Drafts are yours alone. To publish, link a profile that has appeared in an uploaded
					replay (<a href="/account">account</a>).
				</span>
			{/if}
		{:else}
			<button class="chip primary" name="intent" value="save">Save changes</button>
			<span class="fine">
				{status === 'hidden' ? 'Saves keep it hidden.' : 'Saves go live at once.'}
			</span>
		{/if}
	</div>
</form>

<Confirm bind:this={confirmBox} />

<style>
	.editor {
		display: flex;
		flex-direction: column;
		gap: 22px;
		margin-top: 14px;
	}
	.quote.error {
		border-left-color: var(--hostile);
	}
	.fields {
		display: flex;
		flex-direction: column;
		gap: 22px;
	}
	.fields[hidden] {
		display: none;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 8px;
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
		color: var(--text-faint);
		margin-left: 8px;
	}
	input[type='text'] {
		width: 100%;
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-2);
		padding: 8px 12px;
		font: inherit;
	}
	input[type='text']:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-soft);
	}

	/* ---------- mode ---------- */
	.modebar a.chip {
		text-decoration: none;
	}
	.modebar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.modebar .sep {
		width: 1px;
		height: 18px;
		background: var(--border-strong);
		margin: 0 2px;
	}
	.whole {
		border: 1px dashed var(--border-strong);
		border-radius: var(--radius-3);
		padding: 16px 18px 18px;
	}
	.ptitle {
		margin: 0 0 14px;
		font-size: clamp(20px, 3vw, 26px);
		font-weight: 650;
		letter-spacing: -0.015em;
	}

	/* ---------- pickers ---------- */
	.picks {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.pick {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px 4px 5px;
		border-radius: 99px;
		background: var(--surface);
		border: 1px solid var(--border-strong);
		color: var(--text-dim);
		font: 500 12px/1.3 var(--font-sans);
		cursor: pointer;
		user-select: none;
		transition: all 120ms ease;
	}
	.pick:hover {
		border-color: var(--accent);
		color: var(--accent);
	}
	.pick.on {
		background: var(--accent-soft);
		border-color: var(--accent);
		color: var(--text);
	}
	.pick:disabled {
		opacity: 0.55;
		cursor: default;
	}
	.pick.mode {
		font-size: 12px;
	}
	.pick.locked {
		cursor: default;
	}
	.menu {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 12.5px;
		color: var(--text-dim);
	}
	.menu select {
		font-size: 12px;
	}
	.pick input {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}
	.pick img {
		width: 20px;
		height: 20px;
		object-fit: cover;
		border-radius: 5px;
	}
	/* a skill identifier is known by its picture: room for it */
	.pick.si {
		padding: 3px 12px 3px 3px;
		gap: 8px;
	}
	.pick.si img {
		width: 32px;
		height: 32px;
		border-radius: 8px;
	}
	.pick b {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 600;
		color: var(--text-faint);
	}
	.order {
		list-style: none;
		margin: 4px 0 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 5px;
	}
	.order li > button:not(.chip) {
		position: relative;
		width: 32px;
		height: 32px;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
	}
	.order img,
	.order .ph {
		width: 32px;
		height: 32px;
		object-fit: cover;
		border-radius: var(--radius-2);
		display: block;
		background: var(--surface-raised);
	}
	.order button:not(.chip):hover img {
		outline: 2px solid var(--hostile);
	}
	.order b {
		position: absolute;
		right: -3px;
		bottom: -3px;
		min-width: 14px;
		height: 14px;
		padding: 0 3px;
		border-radius: 7px;
		background: var(--accent);
		color: var(--accent-contrast);
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 650;
		line-height: 14px;
		text-align: center;
	}
	.ocount {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--text-faint);
		margin-left: 6px;
	}
	.clear {
		margin-left: 6px;
	}

	.sadd {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.count {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--text-faint);
	}
	.count.over {
		color: var(--hostile);
	}

	/* ---------- the rest ---------- */
	.help summary {
		cursor: pointer;
		font-size: 12.5px;
		color: var(--text-dim);
	}
	.help table {
		margin: 8px 0;
		border-collapse: collapse;
		font-size: 12.5px;
	}
	.help td {
		padding: 3px 14px 3px 0;
		vertical-align: top;
		color: var(--text-dim);
	}
	.help code {
		font-family: var(--font-mono);
		font-size: 11.5px;
		color: var(--text);
		white-space: nowrap;
	}
	.help p {
		font-size: 12px;
		color: var(--text-dim);
		max-width: 64ch;
		margin: 6px 0 0;
	}
	.help .tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin-top: 8px;
	}
	.importbox {
		width: 100%;
		margin-top: 8px;
		font: 12px/1.5 var(--font-mono);
		background: var(--surface-raised);
		color: var(--text);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-2);
		padding: 8px 10px;
		resize: vertical;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		padding-top: 6px;
		border-top: 1px solid var(--border);
	}
	.chip.primary {
		background: var(--accent);
		color: var(--accent-contrast);
		border-color: var(--accent);
	}
	.chip.primary:disabled,
	.chip:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.fine {
		font-size: 11.5px;
		line-height: 1.5;
		color: var(--text-faint);
		max-width: 56ch;
	}
</style>
