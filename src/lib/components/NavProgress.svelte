<script lang="ts">
	/**
	 * Thin accent bar across the top while a page is loading.
	 *
	 * Pages are served from cache in the common case and arrive in tens of
	 * milliseconds, so the bar deliberately waits before appearing — showing it
	 * for every navigation would read as a flicker, and a flicker on a fast page
	 * makes the site feel *less* responsive, not more. It only shows up when a
	 * load is slow enough that a visitor would otherwise wonder if their click
	 * registered.
	 */
	import { navigating } from '$app/state';

	/** Loads finishing sooner than this never show a bar at all. */
	const SHOW_AFTER_MS = 180;
	/** How often the bar creeps forward while waiting. */
	const CREEP_MS = 200;
	/** How long the filled bar lingers before fading out. */
	const DONE_MS = 240;

	let width = $state(0);
	let shown = $state(false);
	// plain, not $state: the effect must react to navigation, not to itself
	let showing = false;

	let showTimer: ReturnType<typeof setTimeout> | undefined;
	let creepTimer: ReturnType<typeof setInterval> | undefined;
	let doneTimer: ReturnType<typeof setTimeout> | undefined;

	function clearTimers() {
		clearTimeout(showTimer);
		clearInterval(creepTimer);
		clearTimeout(doneTimer);
		showTimer = creepTimer = doneTimer = undefined;
	}

	$effect(() => {
		const loading = Boolean(navigating.to);
		clearTimers();
		if (loading) {
			showTimer = setTimeout(() => {
				showing = true;
				shown = true;
				width = 8;
				// close a fraction of the *remaining* distance each tick, so the
				// bar always keeps moving but never reaches the end on its own —
				// there is no way to know how far along a load actually is
				creepTimer = setInterval(() => {
					width += (92 - width) * 0.12;
				}, CREEP_MS);
			}, SHOW_AFTER_MS);
		} else if (showing) {
			showing = false;
			width = 100;
			doneTimer = setTimeout(() => {
				shown = false;
				width = 0;
			}, DONE_MS);
		}
		return clearTimers;
	});
</script>

{#if shown}
	<div
		class="navprogress"
		role="progressbar"
		aria-label="Loading page"
		aria-valuemin="0"
		aria-valuemax="100"
		aria-valuenow={Math.round(width)}
		style="--w: {width}%"
	></div>
{/if}

<style>
	.navprogress {
		position: fixed;
		top: 0;
		left: 0;
		z-index: 100;
		height: 3px;
		width: var(--w);
		background: var(--accent);
		/* the glow is what makes a 3px bar read as motion rather than a border */
		box-shadow: 0 0 8px var(--accent);
		transition:
			width 0.2s ease-out,
			opacity 0.24s ease-out;
		opacity: 1;
	}
	/* filled means finished: fade as it completes */
	.navprogress[aria-valuenow='100'] {
		opacity: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.navprogress {
			transition: none;
		}
	}
</style>
