<script lang="ts">
	/**
	 * Top-bar "ready to play" widget. Signed-in players toggle a one-hour
	 * flag; hovering shows everyone currently flagged. The flagged button
	 * counts down and shifts color as the hour runs out (green → gold → red),
	 * and a restart button rewinds it to a full hour. Signed-out visitors see
	 * the count (linking to sign-in) whenever someone is ready.
	 * Client-side fetch + polling because the layout is prerendered.
	 */
	import { onMount } from 'svelte';
	import anonPortrait from '$lib/assets/anon-portrait.svg';
	import { activeReady, minutesLeft, readyLevel, type ReadyPlayer } from '$lib/ready';

	let { signedIn }: { signedIn: boolean } = $props();

	let players = $state<ReadyPlayer[]>([]);
	let myUntil = $state<string | null>(null);
	let busy = $state(false);
	let now = $state(0);

	const active = $derived(activeReady(players, now));
	const me = $derived(myUntil !== null && Date.parse(myUntil) > now);
	const myMinutes = $derived(me ? minutesLeft(myUntil!, now) : null);
	const level = $derived(myMinutes === null ? 'high' : readyLevel(myMinutes));

	function apply(data: { until: string | null; players: ReadyPlayer[] }) {
		myUntil = data.until;
		players = data.players;
		now = Date.now();
	}

	async function refresh() {
		try {
			const res = await fetch('/api/ready');
			if (res.ok) apply(await res.json());
		} catch {
			// transient — keep the last known state
		}
	}

	onMount(() => {
		now = Date.now();
		refresh();
		// live sync: the server announces roster changes over SSE and we
		// refetch; the slow poll is only a fallback, the tick drives countdowns
		const events = new EventSource('/api/ready/events');
		events.addEventListener('change', refresh);
		const poll = setInterval(refresh, 60_000);
		const tick = setInterval(() => (now = Date.now()), 15_000);
		return () => {
			events.close();
			clearInterval(poll);
			clearInterval(tick);
		};
	});

	async function send(method: 'POST' | 'DELETE') {
		if (busy) return;
		busy = true;
		try {
			const res = await fetch('/api/ready', { method });
			if (res.ok) apply(await res.json());
		} catch {
			// leave state as-is; the next poll reconciles
		} finally {
			busy = false;
		}
	}
</script>

{#if signedIn || active.length > 0}
	<div class="ready">
		{#if signedIn && me}
			<!-- flagged: the chip is a group — toggle area + inline restart segment -->
			<div class="ready-btn on" class:mid={level === 'mid'} class:low={level === 'low'}>
				<button
					class="seg main"
					onclick={() => send('DELETE')}
					disabled={busy}
					title={`Ready for ${myMinutes} more min — click to withdraw`}
				>
					<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
						stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
						<line x1="4" y1="22" x2="4" y2="15" />
					</svg>
					Ready · {myMinutes} min
					{#if active.length > 0}<span class="count">{active.length}</span>{/if}
				</button>
				<button
					class="seg re"
					onclick={() => send('POST')}
					disabled={busy}
					aria-label="Restart your ready hour"
					title="Restart your ready hour"
				>
					<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
						stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<polyline points="23 4 23 10 17 10" />
						<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
					</svg>
				</button>
			</div>
		{:else if signedIn}
			<button
				class="ready-btn plain"
				onclick={() => send('POST')}
				disabled={busy}
				title="Flag yourself as ready to play for the next hour"
			>
				<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
					stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
					<line x1="4" y1="22" x2="4" y2="15" />
				</svg>
				Ready to play?
				{#if active.length > 0}<span class="count">{active.length}</span>{/if}
			</button>
		{:else}
			<a class="ready-btn plain guest" href="/account" title="Sign in with Battle.net to flag yourself too">
				<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
					stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
					<line x1="4" y1="22" x2="4" y2="15" />
				</svg>
				Ready to play
				<span class="count">{active.length}</span>
			</a>
		{/if}

		{#if active.length > 0}
			<div class="pop">
				<div class="pop-card">
					<div class="pop-head">Ready to play · {active.length}</div>
					{#each active as p (p.battletag)}
						<div class="row">
							<img class="portrait" src={p.avatar ?? anonPortrait} alt="" />
							{#if p.toon}
								<a class="tag-link" href="/players/{p.toon}">{p.battletag}</a>
							{:else}
								<span class="tag-link">{p.battletag}</span>
							{/if}
							<span class="left">{minutesLeft(p.until, now)} min</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.ready {
		position: relative;
		display: flex;
		align-items: center;
	}
	.ready-btn {
		display: flex;
		align-items: stretch;
		height: 30px;
		background: var(--sidebar-2);
		color: var(--sidebar-ink);
		border: 1px solid var(--sidebar-line);
		border-radius: 99px;
		font: 500 12px/1 var(--mono);
		font-variant-numeric: tabular-nums;
		text-decoration: none;
		white-space: nowrap;
		transition: all 120ms ease;
	}
	.ready-btn.plain {
		align-items: center;
		gap: 7px;
		padding: 0 14px;
		cursor: pointer;
	}
	.ready-btn.plain:hover {
		color: var(--accent-hover);
		border-color: var(--accent);
	}
	.ready-btn.plain:disabled {
		opacity: 0.6;
		cursor: default;
	}
	/* signed-out visitors: amber attention pill — players are ready, join in */
	.ready-btn.guest {
		background: var(--item);
		color: var(--on-accent);
		border-color: var(--item);
	}
	.ready-btn.guest:hover {
		color: var(--on-accent);
		border-color: var(--item);
		filter: brightness(1.08);
	}
	.ready-btn.on {
		--chip-bg: var(--accent);
		background: var(--chip-bg);
		color: var(--on-accent);
		border-color: var(--chip-bg);
	}
	.ready-btn.on.mid {
		--chip-bg: var(--item);
	}
	.ready-btn.on.low {
		--chip-bg: var(--hostile);
	}
	/* segments inside the flagged chip: toggle area + restart */
	.seg {
		display: flex;
		align-items: center;
		gap: 7px;
		background: none;
		border: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
		transition: background 120ms ease, opacity 120ms ease;
	}
	.seg.main {
		/* extra right padding runs under the overlapping circle, so the hover
		   tint's straight edge hides behind it and is cut by the curve */
		padding: 0 24px 0 14px;
		border-radius: 99px 0 0 99px;
	}
	.seg.main:hover {
		background: color-mix(in srgb, currentColor 14%, transparent);
	}
	/* restart = the chip's circular right end-cap: fixed 30px to match the
	   chip height (aspect-ratio can't square a stretched flex item), negative
	   margins overlap it onto the chip border (right) and the main segment
	   (left); opaque inherited background masks the tint underneath */
	.seg.re {
		align-self: stretch;
		flex: none;
		width: 30px;
		padding: 0;
		justify-content: center;
		position: relative;
		margin: -1px -1px -1px -15px;
		/* frosted like the count badge: text color over chip color, kept
		   opaque so it masks the main segment's hover tint underneath */
		background: color-mix(in srgb, var(--on-accent) 18%, var(--chip-bg));
		border: 1px solid color-mix(in srgb, currentColor 40%, transparent);
		border-radius: 50%;
	}
	.seg.re svg {
		opacity: 0.85;
	}
	.seg.re:hover {
		background: color-mix(in srgb, var(--on-accent) 30%, var(--chip-bg));
	}
	.seg.re:hover svg {
		opacity: 1;
	}
	.seg:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.count {
		display: grid;
		place-items: center;
		min-width: 17px;
		height: 17px;
		padding: 0 4px;
		border-radius: 99px;
		background: color-mix(in srgb, currentColor 18%, transparent);
		font-size: 10.5px;
		font-variant-numeric: tabular-nums;
	}
	/* hover / focus dropdown; transparent padding keeps hover alive over the gap */
	.pop {
		display: none;
		position: absolute;
		top: 100%;
		right: 0;
		padding-top: 8px;
		z-index: 40;
	}
	.ready:hover .pop,
	.ready:focus-within .pop {
		display: block;
	}
	.pop-card {
		min-width: 240px;
		background: var(--surface);
		color: var(--ink);
		border: 1px solid var(--border);
		border-radius: var(--r);
		box-shadow: var(--shadow-2);
		padding: 6px;
	}
	.pop-head {
		font-family: var(--mono);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-3);
		padding: 5px 8px 7px;
		border-bottom: 1px solid var(--border);
		margin-bottom: 4px;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 8px;
		border-radius: var(--r-sm);
	}
	.row:hover {
		background: var(--surface-2);
	}
	.portrait {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		object-fit: cover;
		border: 1px solid var(--border);
		flex-shrink: 0;
	}
	.tag-link {
		flex: 1;
		font-size: 12.5px;
		font-weight: 550;
		color: var(--ink);
		text-decoration: none;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	a.tag-link:hover {
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.left {
		font-family: var(--mono);
		font-size: 11px;
		font-variant-numeric: tabular-nums;
		color: var(--ink-3);
		flex-shrink: 0;
	}
</style>
