<script lang="ts">
	/**
	 * The mode a roll is worked out for: the twelve mode glyphs in a row, the
	 * chosen one named beside them. The script sets the global ailment roll per
	 * mode, so every number under this changes with it.
	 */
	import ModeMark from '$lib/components/ModeMark.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { globalN } from '$lib/rolls';
	import { getRolls } from './context';
	import { MODE_COUNT } from '$lib/mode';
	import { modeName } from '$lib/players';

	let { mode = $bindable(2), note = '' }: { mode?: number; note?: string } = $props();

	const rolls = getRolls();
	const cardText = (m: number) => {
		const n = rolls?.rules ? globalN(rolls.rules, m) : null;
		return n ? `Ailment roll: 1 in ${n} qualifying hits` : '';
	};
</script>

<div class="pick">
	<div class="row" role="group" aria-label="Game mode">
		{#each Array.from({ length: MODE_COUNT }, (_, i) => i + 1) as m (m)}
			<Tooltip label={modeName(m)} text={cardText(m)} focusable={false}>
				<button type="button" class:on={m === mode} aria-pressed={m === mode} aria-label={modeName(m)} onclick={() => (mode = m)}>
					<ModeMark mode={m} iconOnly />
				</button>
			</Tooltip>
		{/each}
	</div>
	<span class="now"><ModeMark {mode} />{#if note}<span class="note">{note}</span>{/if}</span>
</div>

<style>
	.pick {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 12px;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
	}
	button {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		padding: 0;
		border: 1px solid transparent;
		border-radius: var(--radius-2);
		background: none;
		cursor: pointer;
		opacity: 0.55;
	}
	button:hover {
		opacity: 1;
		background: var(--surface-raised);
	}
	button.on {
		opacity: 1;
		border-color: var(--border-strong);
		background: var(--surface-raised);
	}
	.now {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
	}
	.note {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text-dim);
	}
</style>
