<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const release = $derived(data.release);
	const REPO = 'https://github.com/Geptyro/uar-companion';
	const RELEASES = `${REPO}/releases/latest`;

	// highlight the build for the visitor's own OS
	let os = $state<'windows' | 'linux' | 'mac' | null>(null);
	onMount(() => {
		const ua = navigator.userAgent;
		os = /Windows/i.test(ua) ? 'windows' : /Mac OS X/i.test(ua) ? 'mac' : /Linux|X11/i.test(ua) ? 'linux' : null;
	});

	const mb = (bytes: number) => `${Math.round(bytes / 1e6)} MB`;
	const platforms = $derived([
		{ key: 'windows' as const, label: 'Windows', note: 'Installer · updates itself', asset: release.windows },
		{ key: 'linux' as const, label: 'Linux', note: 'AppImage · updates itself', asset: release.linux },
		{ key: 'mac' as const, label: 'macOS', note: 'Zip · update manually', asset: release.mac }
	]);
</script>

<svelte:head>
	<title>UAR Companion — UAR Unit Database</title>
	<meta
		name="description"
		content="Free, open-source desktop companion for Undead Assault Reborn: uploads your replays automatically, flags you ready to play, and shows open lobbies and running games."
	/>
</svelte:head>

<p class="note">
	<b>UAR Companion</b> is a small app for your PC that keeps this site in sync with your play. It runs
	in the system tray and stays out of the way — install it once, sign in with Battle.net, and forget
	about it. It is free and <b>open source</b>: every line it runs is public on
	<a href={REPO} rel="external">GitHub</a>.
</p>

<h2 class="section">What it does</h2>
<div class="features">
	<div class="card feat">
		<h3>Uploads your replays</h3>
		<p>
			Every Undead Assault Reborn replay is sent here right after the game, so your
			<a href="/players">profile</a>, XP history and the leaderboards stay current without you
			uploading anything by hand.
		</p>
	</div>
	<div class="card feat">
		<h3>Ready to play, from the tray</h3>
		<p>
			Flag yourself ready without opening the site, and get a desktop notification when someone
			else does. Joining a lobby or starting a game withdraws your flag automatically.
		</p>
	</div>
	<div class="card feat">
		<h3>Live lobbies &amp; games</h3>
		<p>
			See which UAR lobbies are forming and which games are running, with the players in each —
			the same chips you get in the top bar here, right next to your clock.
		</p>
	</div>
	<div class="card feat">
		<h3>Stays up to date</h3>
		<p>
			The app checks for new versions on launch and installs them itself on Windows and Linux, so
			you are never left on a build the site has moved past.
		</p>
	</div>
</div>

<!-- it is an executable that watches a folder on their PC, so the answer to
     "why should I trust this" gets its own band rather than a clause in a
     feature card -->
<a class="card oss" href={REPO} rel="external">
	<svg class="oss-mark" viewBox="0 0 16 16" aria-hidden="true">
		<path
			fill-rule="evenodd"
			d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
		/>
	</svg>
	<span class="oss-body">
		<span class="oss-title">Free and open source</span>
		<span class="oss-text">
			Read exactly what it uploads, report a bug, suggest a feature, or build it yourself from
			source — the whole app is on GitHub.
		</span>
		<span class="oss-repo mono">github.com/Geptyro/uar-companion ↗</span>
	</span>
</a>

<h2 class="section">
	Download
	{#if release.version}<span class="tag">{release.version}</span>{/if}
</h2>
<div class="downloads">
	{#each platforms as p (p.key)}
		<a
			class="card dl"
			class:mine={os === p.key}
			href={p.asset?.url ?? RELEASES}
			rel="external"
			download={p.asset ? '' : undefined}
		>
			<span class="dl-os">{p.label}</span>
			<span class="dl-note">{p.note}</span>
			<span class="dl-size mono">{p.asset ? mb(p.asset.size) : 'releases page'}</span>
		</a>
	{/each}
</div>
<p class="note small">
	Builds are unsigned, so Windows SmartScreen shows a warning (“More info → Run anyway”) and macOS
	needs right-click → Open the first time. On Linux, make the AppImage executable
	(<span class="mono">chmod +x</span>) and install <span class="mono">fuse2</span> if your distro
	doesn't ship it — or run it with <span class="mono">--appimage-extract-and-run</span>. Older
	versions are on the <a href={RELEASES} rel="external">releases page</a>.
</p>

<h2 class="section">What it sends</h2>
<p class="note">
	Only Undead Assault Reborn replays: every file is checked on your machine first, replays the site
	already has are skipped, and uploads are spaced out to respect the server. Lobby and game status
	is reported only while you are signed in, and only says whether you are in a lobby or in a game —
	it never reads anything else from StarCraft II. Sign out in the app and it stops immediately. You
	don't have to take any of that on trust — it is all in
	<a href={REPO} rel="external">the source</a>.
</p>

<style>
	.features {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr));
		gap: 12px;
		max-width: 760px;
	}
	.feat h3 {
		margin: 0 0 6px;
		font-size: 13.5px;
	}
	.feat p {
		margin: 0;
		font-size: 13px;
		color: var(--ink-2);
		line-height: 1.5;
	}
	/* the one card on the page that is about trust rather than a feature, so it
	   sits on its own between the features and the download buttons, tinted and
	   full width instead of a fifth tile in the grid */
	.oss {
		display: flex;
		align-items: flex-start;
		gap: 14px;
		max-width: 760px;
		margin: 14px 0 0;
		background: var(--accent-soft);
		border-color: color-mix(in srgb, var(--accent) 45%, transparent);
		text-decoration: none;
		color: inherit;
		transition: all 140ms ease;
	}
	.oss:hover {
		border-color: var(--accent);
		transform: translateY(-1px);
		box-shadow: var(--shadow-2);
	}
	.oss-mark {
		width: 30px;
		height: 30px;
		fill: var(--accent);
		flex-shrink: 0;
		margin-top: 1px;
	}
	.oss-body {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}
	.oss-title {
		font-size: 14.5px;
		font-weight: 650;
	}
	.oss-text {
		font-size: 13px;
		line-height: 1.5;
		color: var(--ink-2);
	}
	.oss-repo {
		font-size: 12px;
		color: var(--accent);
		overflow-wrap: anywhere;
	}
	.downloads {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr));
		gap: 12px;
		max-width: 760px;
		margin-bottom: 12px;
	}
	.dl {
		display: flex;
		flex-direction: column;
		gap: 3px;
		text-decoration: none;
		transition: all 140ms ease;
	}
	.dl:hover {
		border-color: var(--accent);
		transform: translateY(-1px);
		box-shadow: var(--shadow-2);
	}
	/* the visitor's own platform, so the obvious button is the right one */
	.dl.mine {
		border-color: var(--accent);
		background: var(--accent-soft);
	}
	.dl-os {
		font-weight: 650;
		font-size: 14px;
	}
	.dl-note {
		font-size: 12px;
		color: var(--ink-2);
	}
	.dl-size {
		font-size: 11px;
		color: var(--ink-3);
	}
	.small {
		font-size: 12px;
		max-width: 760px;
	}
</style>
