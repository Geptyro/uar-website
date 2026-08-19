<script lang="ts">
	/**
	 * A class's standard abilities as a command card: square tiles, the
	 * in-game button art, the tooltip on hover or focus. `dense` is the rail's
	 * size; the default is the main column's, where the tiles have room.
	 */
	import type { CommonAbility } from '$lib/mos';
	import Tooltip from '$lib/components/Tooltip.svelte';

	let {
		abilities,
		dense = false,
		size = 'normal',
		placement = 'top'
	}: {
		abilities: CommonAbility[];
		/** The rail's size — takes precedence over `size`. */
		dense?: boolean;
		/** 'large' is for a half-width column, where the tiles are the content. */
		size?: 'normal' | 'large';
		placement?: 'top' | 'left' | 'right' | 'bottom';
	} = $props();

	/** stand-in tile art for the handful of abilities the map ships without an icon */
	function initials(name: string): string {
		return (name.match(/[A-Za-z0-9]+/g) ?? [])
			.slice(0, 2)
			.map((w) => w[0].toUpperCase())
			.join('');
	}
</script>

<ul class="abil-grid" class:dense class:large={size === 'large' && !dense}>
	{#each abilities as a (a.id)}
		<li>
			<Tooltip label={a.name} text={a.tooltip} {placement}>
				<span class="abil-tile">
					{#if a.icon}
						<img src={a.icon} alt={a.name} loading="lazy" />
					{:else}
						<span class="abil-fallback" aria-label={a.name}>{initials(a.name)}</span>
					{/if}
				</span>
			</Tooltip>
		</li>
	{/each}
</ul>

<style>
	/* command-card style grid: square tiles filling the width they are given */
	.abil-grid {
		list-style: none;
		margin: 2px 0 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
		gap: 8px;
	}
	.abil-grid.dense {
		grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
		gap: 6px;
	}
	.abil-grid.large {
		grid-template-columns: repeat(auto-fill, minmax(68px, 1fr));
		gap: 10px;
	}
	.abil-tile {
		width: 100%;
		aspect-ratio: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		/* dark slot in both themes: the icon art is drawn for SC2's dark command
		   card, and white line-art ones vanish on the light surface */
		background: var(--sidebar);
		border: 1px solid var(--border);
		border-radius: var(--radius-2);
		box-shadow: var(--shadow-1);
		cursor: help;
		transition:
			border-color 140ms ease,
			transform 140ms ease,
			box-shadow 140ms ease;
	}
	.abil-tile img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.abil-grid :global(.tt) {
		width: 100%;
	}
	.abil-fallback {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 650;
		color: var(--sidebar-ink-2);
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.abil-grid li:hover .abil-tile,
	.abil-grid li:focus-within .abil-tile {
		border-color: var(--border-strong);
		transform: translateY(-1px);
		box-shadow: var(--shadow-2);
	}
</style>
