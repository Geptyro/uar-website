<script>
	/**
	 * Top-bar count chip for SC2 presence: open lobbies (amber — a lobby is
	 * forming, join it) or running games (MOS blue — informational). Same
	 * 30px pill anatomy as the ready chip. Purely presentational.
	 *
	 * NOTE: temporary mirror of uar-shared's PresenceChip — replace with
	 * the package import when the site adopts uar-shared.
	 */
	let { kind = 'lobby', count = 0, label, title, onclick, href } = $props();

	const text = $derived(
		label ??
			(kind === 'lobby'
				? `${count} ${count === 1 ? 'lobby' : 'lobbies'}`
				: `${count} ${count === 1 ? 'game' : 'games'}`)
	);
	const tip = $derived(
		title ?? (kind === 'lobby' ? 'Open UAR lobbies — hover for who is in' : 'UAR games running')
	);
</script>

{#snippet icon()}
	{#if kind === 'lobby'}
		<!-- two players -->
		<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
			stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
			<circle cx="9" cy="7" r="4" />
			<path d="M23 21v-2a4 4 0 0 0-3-3.87" />
			<path d="M16 3.13a4 4 0 0 1 0 7.75" />
		</svg>
	{:else}
		<!-- play -->
		<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
			<polygon points="6 3 20 12 6 21 6 3" />
		</svg>
	{/if}
{/snippet}

{#if href}
	<a class="presence-chip {kind}" {href} title={tip}>{@render icon()}{text}</a>
{:else}
	<button class="presence-chip {kind}" {onclick} title={tip}>{@render icon()}{text}</button>
{/if}

<style>
	.presence-chip {
		display: flex;
		align-items: center;
		gap: 7px;
		height: 30px;
		padding: 0 14px;
		border-radius: 99px;
		font: 500 12px/1 var(--mono);
		font-variant-numeric: tabular-nums;
		text-decoration: none;
		white-space: nowrap;
		cursor: pointer;
		transition: all 120ms ease;
		border: 1px solid transparent;
	}
	.presence-chip.lobby {
		background: var(--item);
		color: var(--on-accent);
		border-color: var(--item);
	}
	.presence-chip.game {
		background: var(--mos);
		color: var(--on-accent);
		border-color: var(--mos);
	}
	.presence-chip:hover {
		filter: brightness(1.08);
	}
</style>
