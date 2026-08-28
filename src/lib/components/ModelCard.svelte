<script lang="ts">
	import { onMount } from 'svelte';

	import type { ModelVariant } from '$lib/models';

	let {
		src = null,
		variants = [],
		alt
	}: {
		src?: string | null;
		/** Several looks for one unit, one per mode; the card gets a picker. */
		variants?: ModelVariant[];
		alt: string;
	} = $props();

	const looks = $derived(variants.length ? variants : src ? [{ src }] : []);
	let picked = $state(0);
	const current = $derived(looks[Math.min(picked, looks.length - 1)]?.src ?? null);

	// <model-viewer> is client-only; the component only mounts when a model exists
	onMount(() => {
		import('@google/model-viewer');
	});
</script>

<div class="card box viewer-card">
	{#if looks.length > 1}
		<div class="looks" role="tablist" aria-label="Model variant">
			{#each looks as look, i (look.src + i)}
				<button
					type="button"
					role="tab"
					class="look"
					class:on={i === picked}
					aria-selected={i === picked}
					onclick={() => (picked = i)}>{look.label ?? `Look ${i + 1}`}</button
				>
			{/each}
		</div>
	{/if}
	<model-viewer
		class="viewer"
		src={current}
		{alt}
		camera-controls
		auto-rotate
		interaction-prompt="none"
		shadow-intensity="0.6"
		exposure="1.1"
	></model-viewer>
	<span class="viewer-hint">3D · drag to rotate</span>
</div>

<style>
	.box {
		padding: 0;
		overflow: hidden;
	}
	.viewer-card {
		position: relative;
	}
	.looks {
		position: absolute;
		top: 10px;
		left: 10px;
		right: 10px;
		z-index: 1;
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.look {
		font-family: var(--font-mono);
		font-size: 10.5px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		padding: 3px 8px;
		border: 1px solid var(--border);
		border-radius: var(--radius-2);
		background: var(--sidebar);
		color: var(--text-dim);
		cursor: pointer;
	}
	.look.on {
		color: var(--text);
		border-color: var(--border-strong);
	}
	.viewer {
		display: block;
		width: 100%;
		height: 280px;
		background: radial-gradient(
			ellipse 70% 30% at 50% 80%,
			color-mix(in srgb, var(--text) 8%, transparent),
			transparent
		);
	}
	.viewer-hint {
		position: absolute;
		right: 12px;
		bottom: 9px;
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-faint);
		pointer-events: none;
	}
</style>
