<script lang="ts">
	/**
	 * The faces on a message or a comment: a pill per face with its count,
	 * the reader's own lit, and a button that opens the palette. Clicking a
	 * pill or a face in the palette is one call to `onreact`; the page it
	 * sits on does the rest (a fetch for the chat, an action for a thread).
	 */
	import { REACTIONS, type ReactionView } from '$lib/reactions';

	let {
		reactions,
		can,
		onreact,
		why = 'Sign in to react'
	}: {
		reactions: ReactionView[];
		/** The reader may react. */
		can: boolean;
		onreact: (emoji: string) => void | Promise<void>;
		/** Why not, when they may not. */
		why?: string;
	} = $props();

	let open = $state(false);
	let box = $state<HTMLElement>();

	function pick(emoji: string) {
		open = false;
		void onreact(emoji);
	}
	function away(e: PointerEvent) {
		if (open && box && !box.contains(e.target as Node)) open = false;
	}
</script>

<svelte:window onpointerdown={away} />

<span class="reactions" bind:this={box}>
	{#each reactions as r (r.emoji)}
		{#if can}
			<button
				type="button"
				class="pill"
				class:mine={r.mine}
				onclick={() => pick(r.emoji)}
				title={r.mine ? 'Take yours back' : `React with ${r.emoji}`}
				aria-pressed={r.mine}
			>
				<span class="face">{r.emoji}</span><span class="n">{r.n}</span>
			</button>
		{:else}
			<span class="pill off" title={why}><span class="face">{r.emoji}</span><span class="n">{r.n}</span></span>
		{/if}
	{/each}
	{#if can}
		<button type="button" class="add" class:on={open} onclick={() => (open = !open)} title="React" aria-label="React" aria-expanded={open}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
			</svg>
		</button>
		{#if open}
			<span class="palette" role="group" aria-label="Reactions">
				{#each REACTIONS as e (e)}
					<button type="button" class="face-btn" class:mine={reactions.some((r) => r.emoji === e && r.mine)} onclick={() => pick(e)} title={e}>{e}</button>
				{/each}
			</span>
		{/if}
	{/if}
</span>

<style>
	.reactions {
		position: relative;
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
	}
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 24px;
		padding: 0 8px 0 6px;
		border: 1px solid var(--border);
		border-radius: 99px;
		background: var(--surface-raised);
		color: var(--text-dim);
		font: 600 11px var(--font-mono);
		cursor: pointer;
		transition: all 120ms ease;
	}
	.pill:hover {
		border-color: var(--border-strong);
		color: var(--text);
	}
	.pill.mine {
		border-color: var(--accent);
		background: var(--accent-soft);
		color: var(--accent);
	}
	.pill.off {
		cursor: default;
	}
	.face {
		font-size: 13px;
		line-height: 1;
	}
	.add {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		border: 1px solid transparent;
		border-radius: 99px;
		background: none;
		color: var(--text-faint);
		cursor: pointer;
		transition: all 120ms ease;
	}
	.add svg {
		width: 15px;
		height: 15px;
	}
	.add:hover,
	.add.on {
		color: var(--text);
		border-color: var(--border);
		background: var(--surface-raised);
	}
	/* the palette, above the row so it never hides under the next card */
	.palette {
		position: absolute;
		z-index: var(--z-float, 60);
		bottom: calc(100% + 6px);
		left: 0;
		display: flex;
		gap: 2px;
		padding: 4px;
		background: var(--surface);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-2);
		box-shadow: var(--shadow-2);
	}
	.face-btn {
		width: 30px;
		height: 30px;
		border: 1px solid transparent;
		border-radius: 6px;
		background: none;
		font-size: 17px;
		line-height: 1;
		cursor: pointer;
	}
	.face-btn:hover {
		background: var(--surface-raised);
		border-color: var(--border);
	}
	.face-btn.mine {
		background: var(--accent-soft);
		border-color: var(--accent);
	}
</style>
