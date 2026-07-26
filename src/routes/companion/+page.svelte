<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const release = $derived(data.release);
	const RELEASES = 'https://github.com/Geptyro/uar-companion/releases/latest';

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
		content="Desktop companion for Undead Assault Reborn: uploads your replays automatically, flags you ready to play, and shows open lobbies and running games."
	/>
</svelte:head>

<p class="note">
	<b>UAR Companion</b> is a small app for your PC that keeps this site in sync with your play. It runs
	in the system tray and stays out of the way — install it once, sign in with Battle.net, and forget
	about it.
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
			New versions install themselves on Windows and Linux. The app is open source — the code
			lives on <a href="https://github.com/Geptyro/uar-companion" rel="external">GitHub</a>.
		</p>
	</div>
</div>

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
	it never reads anything else from StarCraft II. Sign out in the app and it stops immediately.
</p>

<style>
	.features {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
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
	.downloads {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
