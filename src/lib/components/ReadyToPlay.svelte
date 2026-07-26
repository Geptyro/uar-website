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
	import { PresenceChips, HoverPop, ReadyPlayers, ReadyChip } from 'uar-shared';
	import { activeReady, minutesLeft, readyLevel, type ReadyPlayer } from '$lib/ready';
	import { splitPresence, type PresenceEntry } from '$lib/presence';

	let { signedIn }: { signedIn: boolean } = $props();

	let players = $state<ReadyPlayer[]>([]);
	let presence = $state<PresenceEntry[]>([]);
	let known = $state<Record<string, { toon: string; avatar?: string }>>({});
	let myStatus = $state<'lobby' | 'ingame' | null>(null);
	let myUntil = $state<string | null>(null);
	let busy = $state(false);
	let now = $state(0);

	const active = $derived(activeReady(players, now));
	const split = $derived(splitPresence(presence));
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
				};
				presence = body.players;
				myStatus = body.me;
				known = body.known ?? {};
			}
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

<PresenceChips
	lobbies={split.lobbies}
	games={split.games}
	href={(m: PresenceEntry) => (m.toon ? `/players/${m.toon}` : null)}
	{known}
	toonHref={(toon: string) => `/players/${toon}`}
/>

{#if signedIn || active.length > 0}
	<HoverPop disabled={active.length === 0} heading={`Ready to play · ${active.length}`}>
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
			/>
		{/snippet}
		{#if active.length > 0}
			<ReadyPlayers
				players={active}
				{now}
				href={(p: ReadyPlayer) => (p.toon ? `/players/${p.toon}` : null)}
				{statusOf}
			/>
		{/if}
	</HoverPop>
{/if}
