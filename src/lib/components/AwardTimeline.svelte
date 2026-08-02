<script lang="ts">
	/**
	 * The awards feed: games down a rail, each with what it gave.
	 *
	 * The shape is the brew timeline's — a fixed left column, a rail of dots and
	 * connectors, and the content taking the rest — and the part worth borrowing
	 * is that the space between two games is a *row* rather than padding. Where
	 * a player got through games nobody uploaded, the rail says so and says how
	 * many, because a reader shown a medal against a game deserves to know when
	 * the record either side of it is broken.
	 *
	 * The connector is `flex: 1` inside a stretched column, so a game that gave
	 * six things draws its own line six rows long without anything measuring it.
	 */
	import type { TimelineRow } from '$lib/awards';
	import { awardView } from '$lib/awardView';
	import type { Outcome } from '$lib/outcome';
	import { mosById } from '$lib/mos';
	import ModeMark from './ModeMark.svelte';
	import OutcomeMark from './OutcomeMark.svelte';
	import Tooltip from './Tooltip.svelte';
	import { timeAgo } from 'sveltekit-commons/time';

	/** Only what a row draws. Spelled out rather than borrowed from the server's
	    ReplayFacts, because $lib/server is out of bounds from a component —
	    `import type` would be erased, but the rule is not about the bundle. */
	interface GameFacts {
		startedAt?: string;
		mode?: number;
		outcome?: Outcome;
	}

	let {
		rows,
		facts = {}
	}: { rows: TimelineRow[]; facts?: Record<string, GameFacts> } = $props();

	/** The full stamp, for the row's `title` — never for the column. */
	const fmtWhen = new Intl.DateTimeFormat('en', {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	});
	const fmtDay = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });

	// SSR renders the server's clock and hydration re-renders in the viewer's —
	// the same trade the Last games widget and the activity chart both make
	const now = Date.now();
	const thisYear = new Date(now).getFullYear();

	/**
	 * How long ago, and past five weeks — where `timeAgo` gives up, because
	 * there is no useful age left — the date instead.
	 *
	 * Without the time of day: this column is 70px of mono holding "3w" on most
	 * rows, and "May 31, 18:00" does not belong in it. The exact stamp is the
	 * row's tooltip, and on a game two months old the minute it started is not
	 * what a reader came for. The year only appears when it is not this one,
	 * which keeps the common case short and the ambiguous one honest.
	 */
	function when(iso: string): string {
		const ago = timeAgo(iso, now);
		if (ago) return ago;
		const d = new Date(iso);
		const day = fmtDay.format(d);
		return d.getFullYear() === thisYear ? day : `${day} ’${String(d.getFullYear()).slice(2)}`;
	}

	const replayId = (file: string) => file.replace(/\.SC2Replay$/, '');
</script>

<div class="tl">
	{#each rows as row, i (row.kind === 'gap' ? `gap-${i}` : row.game.file)}
		{#if row.kind === 'gap'}
			<div class="tl-gap">
				<div class="tl-when"></div>
				<div class="tl-rail"><div class="tl-gapline"></div></div>
				<div class="tl-gaplabel" title="Games the save file counted between the two above and below — played, but nothing new earned in them (or never uploaded)">
					{row.games} game{row.games === 1 ? '' : 's'}, nothing earned
				</div>
			</div>
		{:else}
			{@const g = row.game}
			{@const f = facts[g.file] ?? {}}
			{@const started = f.startedAt ?? g.startedAt}
			<div class="tl-item">
				<div class="tl-when">
					<a href="/replays/{replayId(g.file)}" title={fmtWhen.format(new Date(started))}>
						{when(started)}
					</a>
				</div>
				<div class="tl-rail">
					<span class="tl-dot" class:approx={row.approximate}></span>
					<div class="tl-conn"></div>
				</div>
				<div class="tl-body">
					<!-- What the game was, and who it was played as — but only when
					     the award is pinned to it. The mode, the result and the class
					     are all facts about one game; if the reward could have come
					     from any of a run, none of them describes where it came from,
					     and a ✓ or a class portrait beside a medal reads as a claim
					     about that medal. An approximate row says the one thing that
					     is true of it and nothing else. -->
					<div class="tl-head">
						{#if row.approximate}
							<span
								class="approxtag"
								title="Earned somewhere in this game and the {g.span -
									1} after it, which were never uploaded — the record cannot say which, nor what was played in them"
							>
								somewhere in {g.span} games
							</span>
						{:else}
							{#if f.mode}<ModeMark mode={f.mode} />{/if}
							{#if f.outcome}<OutcomeMark outcome={f.outcome} />{/if}
							{#if g.mos?.length}
								<span class="asclass">
									{#each g.mos as id (id)}
										{@const m = mosById.get(id)}
										{#if m?.icon}
											<img
												class="asfig"
												src={m.icon}
												alt={m.name}
												title="Played as {m.name}"
												loading="lazy"
											/>
										{/if}
									{/each}
								</span>
							{/if}
						{/if}
					</div>
					<ul class="awards">
						{#each g.awards as a, j (`${a.type}-${a.group ?? ''}-${a.id}-${j}`)}
							{@const v = awardView(a)}
							<li>
								<Tooltip
									label="{v.label} · {v.kind}"
									text={v.text}
									href={v.href ?? ''}
									linkText={v.linkText}
									placement="entry"
								>
									<span class="award t-{v.tone}">
										{#if v.icon}
											<img class="aimg" src={v.icon} alt="" loading="lazy" />
										{:else}
											<span class="aimg placeholder">★</span>
										{/if}
										<span class="atext">
											<span class="aname">{v.label}</span>
											<span class="akind">{v.kind}</span>
										</span>
									</span>
								</Tooltip>
							</li>
						{/each}
					</ul>
				</div>
			</div>
		{/if}
	{/each}
</div>

<style>
	.tl {
		display: flex;
		flex-direction: column;
	}

	/* Both row kinds share one three-column grid, so the rail runs down a single
	   line through the whole feed rather than each row centring its own. */
	.tl-item,
	.tl-gap {
		display: grid;
		grid-template-columns: 70px 14px minmax(0, 1fr);
		gap: 0 10px;
		align-items: stretch;
	}
	.tl-gap {
		min-height: 26px;
	}

	/* `min-width: 0` is load-bearing: a grid item defaults to `auto`, which
	   refuses to shrink below its content, so a long value spilled out over the
	   rail instead of being contained. The date format keeps it short; this
	   keeps it from ever overlapping again whatever the format does. */
	.tl-when {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		text-align: right;
		font-family: var(--font-mono);
		font-size: 11px;
		font-variant-numeric: tabular-nums;
		color: var(--text-faint);
		/* .tl-body's top padding, plus the 1px that centred it on the header */
		padding-top: 9px;
		white-space: nowrap;
	}
	.tl-when a {
		color: inherit;
		text-decoration: none;
	}
	.tl-when a:hover {
		color: var(--accent);
	}

	.tl-rail {
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.tl-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex: none;
		/* .tl-body's top padding, plus the 4px that centred it on the header */
		margin-top: 12px;
		background: var(--accent);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
	}
	/* Hollow when the award cannot be pinned to this game — the same mark, not
	   filled in, which reads as "this, but not certainly here". */
	.tl-dot.approx {
		background: var(--surface);
		border: 2px solid var(--accent);
		box-sizing: border-box;
	}
	/* the line fills whatever height the row's content takes, so nothing has to
	   know how many awards a game gave */
	.tl-conn,
	.tl-gapline {
		flex: 1;
		width: 1px;
		background: var(--border);
	}
	.tl-gapline {
		/* dashed, so an unrecorded run does not read as time that was watched */
		width: 0;
		border-left: 1px dashed var(--border-strong, var(--border));
	}

	/* Equal above and below, so a game sits in the middle of its own space
	   rather than hanging from the top of it. Two blocks therefore stand 16px
	   apart however tall either is, which is the figure that used to be the
	   bottom padding alone — the same air, shared out.

	   The three columns are separate grid items, so this padding moves the
	   header down without moving the dot or the timestamp: both are nudged by
	   the same amount below to stay level with the line they label. */
	.tl-body {
		min-width: 0;
		padding: 8px 0;
	}
	.tl-head {
		display: flex;
		align-items: center;
		gap: 6px;
		min-height: 16px;
		line-height: 1;
	}
	.approxtag {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.04em;
		color: var(--text-faint);
		cursor: help;
	}
	/* who the game was played as — the context an award actually wants, and on
	   an approximate row the only part of the header still worth trusting */
	.asclass {
		display: flex;
		align-items: center;
		gap: 3px;
	}
	.asfig {
		width: 18px;
		height: 18px;
		object-fit: cover;
		border-radius: 3px;
	}
	.tl-gaplabel {
		display: flex;
		align-items: center;
		font-family: var(--font-mono);
		font-size: 10.5px;
		color: var(--text-faint);
	}

	/* A game's rewards sit side by side, not stacked: they were won together in
	   one game, and a row reads as one haul where a column reads as a list of
	   separate events. They wrap, because a good game can give six. */
	.awards {
		list-style: none;
		margin: 8px 0 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		/* the whole card is the hover target, as the collection tiles are */
		cursor: pointer;
	}
	/* Tooltip renders its own inline-flex anchor around each card; the card is
	   what should carry the box, so the anchor is told to be exactly its size. */
	.awards :global(.tt) {
		align-items: stretch;
	}
	/* The picture is the card's leading edge — flush to it, full height, no
	   inset. `stretch` is what makes it fill: the text sets the card's height,
	   and the image takes whatever that turns out to be. `overflow: hidden` is
	   what keeps its corners inside the card's radius now that it touches them. */
	.award {
		display: flex;
		align-items: stretch;
		min-width: 0;
		padding: 0 14px 0 0;
		border: 1px solid var(--border);
		border-radius: var(--radius-2);
		background: var(--surface);
		overflow: hidden;
		transition: border-color 120ms ease;
	}
	/* the hover lives on the card itself — Svelte will not let `:global()` sit
	   in the middle of a selector, and the anchor around it is Tooltip's */
	.award:hover {
		border-color: var(--border-strong, var(--text-faint));
	}
	.aimg {
		width: 48px;
		flex: none;
		align-self: stretch;
		/* the box ends up near enough square, so `cover` fills it without
		   cropping anything off a square game icon */
		object-fit: cover;
		background: var(--surface-raised);
		margin-right: 12px;
	}
	.aimg.placeholder {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 20px;
		line-height: 1;
		color: var(--text-faint);
	}
	/* the height the picture stretches to is set here, since the card itself no
	   longer has vertical padding of its own */
	.atext {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 2px;
		min-width: 0;
		padding: 9px 0;
	}
	.aname {
		font-size: 13.5px;
		font-weight: 600;
		line-height: 1.25;
	}
	/* the family, quiet: it labels the picture rather than competing with the
	   name, and it is what tells a camo from a decal at a glance */
	.akind {
		font-family: var(--font-mono);
		font-size: 9.5px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-faint);
	}
	/* The card's leading edge carries the family's colour, so a game that gave
	   three medals and a rank reads as three-and-one at a glance without every
	   card spelling the word out. */
	.award {
		border-left-width: 3px;
	}
	.award.t-medal {
		border-left-color: var(--accent);
	}
	.award.t-wear {
		border-left-color: var(--mos, var(--accent));
	}
	.award.t-si {
		border-left-color: var(--item, var(--text-dim));
	}
	.award.t-gear {
		border-left-color: var(--text-dim);
	}
	.award.t-rank {
		border-left-color: var(--hostile, var(--accent));
	}

	@media (max-width: 599.98px) {
		.tl-item,
		.tl-gap {
			grid-template-columns: 46px 14px minmax(0, 1fr);
			gap: 0 8px;
		}
		.tl-when {
			font-size: 10px;
		}
	}
</style>
