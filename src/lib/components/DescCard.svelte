<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		label,
		text = null,
		children = null
	}: {
		label: string;
		/** plain pre-line body; use children for custom (parent-styled) markup */
		text?: string | null;
		children?: Snippet | null;
	} = $props();
</script>

<div class="card box desc">
	<div class="box-label">{label}</div>
	{#if text}<p>{text}</p>{/if}
	{@render children?.()}
</div>

<style>
	.box.desc {
		padding: var(--card-pad-y) var(--card-pad-x);
		overflow: hidden;
	}
	.box-label {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-faint);
		margin-bottom: 6px;
	}
	.box.desc p {
		margin: 0;
		font-size: 12.5px;
		line-height: 1.6;
		color: var(--text-dim);
		white-space: pre-line;
	}
</style>
