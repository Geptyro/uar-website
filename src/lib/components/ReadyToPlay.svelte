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
	import { HoverPop } from 'sveltekit-commons';
	import { PresenceChips, ReadyPlayers, ReadyChip } from 'uar-shared';
	import { activeReady, minutesLeft, readyLevel, type ReadyPlayer } from '$lib/ready';
	import { splitPresence, type PresenceEntry, type PresenceGroup } from '$lib/presence';

	type Split = { lobbies: PresenceGroup<PresenceEntry>[]; games: PresenceGroup<PresenceEntry>[] };

	let {
		signedIn,
		compact = false,
		/** the session turned out to be gone — the top bar owns that state */
		onexpired
	}: { signedIn: boolean; compact?: boolean; onexpired?: () => void } = $props();

	let players = $state<ReadyPlayer[]>([]);
	let presence = $state<PresenceEntry[]>([]);
	let groups = $state<Split | null>(null);
	let known = $state<Record<string, { toon: string; avatar?: string }>>({});
	let myStatus = $state<'lobby' | 'ingame' | null>(null);
	let myUntil = $state<string | null>(null);
	let busy = $state(false);
	let now = $state(0);
	/** why the last toggle did not take, shown next to the chip for a moment */
	let notice = $state<string | null>(null);
	let noticeTimer: ReturnType<typeof setTimeout> | null = null;

	const active = $derived(activeReady(players, now));
	// the server groups; a page left open across a deploy predates that field
	const split = $derived(groups ?? splitPresence(presence));
	const statusOf = (battletag: string) => presence.find((p) => p.battletag === battletag)?.status;
	const myMinutes = $derived(
		myUntil !== null && Date.parse(myUntil) > now ? minutesLeft(myUntil, now) : null
	);
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
		try {
			const res = await fetch('/api/presence');
			if (res.ok) {
				const body = (await res.json()) as {
					players: PresenceEntry[];
					me: 'lobby' | 'ingame' | null;
					known?: Record<string, { toon: string; avatar?: string }>;
					groups?: Split;
				};
				presence = body.players;
				groups = body.groups ?? null;
				myStatus = body.me;
				known = body.known ?? {};
			}
		} catch {
			// transient — keep the last known state
		}
	}

	/**
	 * A refusal has to say so. Until this existed every non-ok answer left the
	 * chip exactly as it was, so a click that the server turned down looked
	 * identical to one that worked — which is how an expired session could go
	 * unnoticed for a day.
	 */
	function say(message: string) {
		notice = message;
		if (noticeTimer) clearTimeout(noticeTimer);
		noticeTimer = setTimeout(() => (notice = null), 8_000);
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
			if (noticeTimer) clearTimeout(noticeTimer);
		};
	});

	async function send(method: 'POST' | 'DELETE') {
		if (busy) return;
		busy = true;
		notice = null;
		try {
			const res = await fetch('/api/ready', { method });
			if (res.ok) {
				apply(await res.json());
			} else if (res.status === 401) {
				// the session expired under an open tab: the whole top bar is
				// wrong, not just this chip, so hand it up rather than
				// explaining it here
				onexpired?.();
				say('Your session expired — sign in again.');
			} else if (res.status === 409) {
				// already in a lobby or game; the chip has a state for that and
				// the refetched presence is what selects it
				await refresh();
				say(await reason(res, 'You are already in a lobby.'));
			} else {
				say(await reason(res, 'That did not go through — try again in a moment.'));
			}
		} catch {
			say('No answer from the site — check your connection.');
		} finally {
			busy = false;
		}
	}

	/** The server's own wording when it sent one (SvelteKit `error()` shape). */
	async function reason(res: Response, fallback: string): Promise<string> {
		try {
			const body = (await res.json()) as { message?: string };
			return body?.message ?? fallback;
		} catch {
			return fallback;
		}
	}
</script>

<PresenceChips
	lobbies={split.lobbies}
	games={split.games}
	href={(m: PresenceEntry) => (m.toon ? `/players/${m.toon}` : null)}
	{known}
	toonHref={(toon: string) => `/players/${toon}`}
	{compact}
/>

{#if signedIn || active.length > 0}
	<HoverPop disabled={active.length === 0} heading={`Ready to play now · ${active.length}`}>
		{#snippet trigger()}
			<ReadyChip
				{signedIn}
				minutes={myMinutes}
				{level}
				count={active.length}
				{busy}
				locked={myStatus !== null}
				lockedStatus={myStatus ?? 'lobby'}
				ontoggle={(on: boolean) => send(on ? 'POST' : 'DELETE')}
				guestHref="/account"
				{compact}
			/>
		{/snippet}
		{#if active.length > 0}
			<ReadyPlayers
				players={active}
				href={(p: ReadyPlayer) => (p.toon ? `/players/${p.toon}` : null)}
				{statusOf}
			/>
		{/if}
	</HoverPop>
{/if}

{#if notice}
	<!-- role=status so it reaches a screen reader too: this is the only thing
	     that ever says a toggle was refused -->
	<span class="ready-notice" role="status">{notice}</span>
{/if}

<style>
	.ready-notice {
		max-width: 22ch;
		padding: 0 10px;
		display: flex;
		align-items: center;
		height: 30px;
		border-radius: 99px;
		background: var(--sidebar-2);
		border: 1px solid var(--hostile, #a4463c);
		color: var(--sidebar-ink);
		font: 500 11px/1.15 var(--font-mono);
		text-align: center;
	}
	/* the top bar gets tight before it goes compact; the chip itself is the
	   part that must survive, so the explanation is what gives way */
	@media (max-width: 900px) {
		.ready-notice {
			display: none;
		}
	}
</style>
