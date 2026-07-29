<script lang="ts">
	import { onMount } from 'svelte';

	let { src, alt }: { src: string; alt: string } = $props();

	// <model-viewer> is client-only; the component only mounts when a model exists
	onMount(() => {
		import('@google/model-viewer');
	});
</script>

<div class="card box viewer-card">
	<model-viewer
		class="viewer"
		{src}
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
