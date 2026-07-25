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
		padding: 12px 14px;
		overflow: hidden;
	}
	.box-label {
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--ink-3);
		margin-bottom: 6px;
	}
	.box.desc p {
		margin: 0;
		font-size: 12.5px;
		line-height: 1.6;
		color: var(--ink-2);
		white-space: pre-line;
	}
</style>
