<script lang="ts">
	import anonPortrait from '$lib/assets/anon-portrait.svg';
	import { onMount } from 'svelte';
	import { rememberUmamiId } from '$lib/analytics';
	import Seo from '$lib/components/Seo.svelte';

	let { data } = $props();

	/* Theme. null = follow the device, which is what the site did before this
	   existed. app.html pins the choice on <html> before the first paint; this
	   only has to keep the button state and the stored value in step. */
	const THEME_KEY = 'uar:theme';
	type Theme = 'light' | 'dark' | null;
	const themes: { id: Theme; label: string; hint: string }[] = [
		{ id: null, label: 'System', hint: 'Follow the device setting' },
		{ id: 'light', label: 'Light', hint: 'Always light' },
		{ id: 'dark', label: 'Dark', hint: 'Always dark' }
	];
	let theme = $state<Theme>(null);
	onMount(() => {
		const saved = localStorage.getItem(THEME_KEY);
		theme = saved === 'light' || saved === 'dark' ? saved : null;
	});
	function pickTheme(next: Theme) {
		theme = next;
		if (next) {
			localStorage.setItem(THEME_KEY, next);
			document.documentElement.dataset.theme = next;
		} else {
			localStorage.removeItem(THEME_KEY);
			delete document.documentElement.dataset.theme;
		}
	}

	const regionName = (id: number) =>
		({ 1: 'Americas', 2: 'Europe', 3: 'Asia' })[id] ?? `Region ${id}`;

	const errorText = $derived.by(() => {
		switch (data.error) {
			case 'denied':
				return 'The Battle.net login was cancelled — nothing was linked.';
			case 'state':
				return 'The login attempt expired or could not be verified. Please try again.';
			case 'bnet':
				return 'Battle.net did not respond correctly. Please try again in a moment.';
			case 'profiles':
				return 'Signed in, but the StarCraft II profile lookup failed (the SC2 API is occasionally down). Use “Refresh from Battle.net” to retry.';
			case 'unavailable':
				return 'Battle.net login is not available right now.';
			default:
				return null;
		}
	});
</script>

<!-- yours alone: a real page, but nothing a search result could point at -->
<Seo
	title="Account"
	description="Link your Battle.net StarCraft II profiles to their Undead Assault Reborn player pages, and pick the site's theme."
	noindex
/>

<p class="eyebrow">Account</p>
<!-- h2: the page's <h1> is the heading in the top bar -->
<h2 class="page-title">Battle.net link</h2>
<p class="note">
	Sign in with Battle.net to link your StarCraft&nbsp;II profiles to their UAR player pages.
	Blizzard only shares your battletag and profile list — no email, no password, and the site
	never sees anything else on your account.
</p>

{#if errorText}
	<p class="quote error">{errorText}</p>
{/if}

{#if !data.enabled}
	<p class="note">Battle.net login is not configured on this server.</p>
{:else if !data.battletag}
	<a class="bnet-btn" href="/auth/bnet">Connect with Battle.net</a>
	<p class="note fineprint">
		Linking marks your player pages as verified and shows your battletag on them.
	</p>
{:else}
	<div class="card box">
		<div class="who">
			<img class="who-avatar" src={data.avatar ?? anonPortrait} alt="" />
			<span class="tag t-mos">✓ signed in</span>
			<b class="btag">{data.battletag}</b>
		</div>

		<h2 class="section">Linked profiles</h2>
		{#if data.linked.length === 0}
			<p class="note">
				No StarCraft&nbsp;II profiles were found on this Battle.net account
				{#if data.error === 'profiles'}(the lookup failed — try a refresh){/if}.
			</p>
		{:else}
			<ul class="linked">
				{#each data.linked as l (l.toon)}
					<li>
						<img class="portrait" src={l.avatarUrl ?? anonPortrait} alt="" loading="lazy" />
						{#if l.player}
							<a href="/players/{l.toon}">
								{#if l.player.clan}&lt;{l.player.clan}&gt;{/if}
								{l.player.name}
							</a>
							<span class="mono">{l.toon}</span>
							<span class="meta">
								{l.player.gamesPlayed.toLocaleString('en')} games · last seen
								{l.player.lastSeen.slice(0, 10)}
							</span>
						{:else}
							<span class="noplayer">{l.bnetName || 'Unnamed profile'}</span>
							<span class="mono">{l.toon}</span>
							<span class="meta">
								{regionName(l.regionId)} — not seen in any ingested replay yet
							</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}

		<div class="actions">
			<a class="chip" href="/auth/bnet">Refresh from Battle.net</a>
			<!-- Both actions end the session and redirect, i.e. a full reload:
			     drop the cached analytics id here or that reload's first
			     pageview still goes out under the old battletag. -->
			<form method="POST" action="?/logout" onsubmit={() => rememberUmamiId(null)}>
				<button class="chip">Sign out</button>
			</form>
			<form method="POST" action="?/unlink" onsubmit={() => rememberUmamiId(null)}>
				<button class="chip danger">Disconnect &amp; remove link</button>
			</form>
		</div>
	</div>
	<p class="note fineprint">
		“Sign out” only ends this browser session. “Disconnect” also deletes the stored link, so
		your player pages are no longer marked as verified.
	</p>
{/if}

<!-- outside the Battle.net branch on purpose: the theme is yours whether or
     not you have linked an account -->
<h2 class="section">Appearance</h2>
<div class="card box theme">
	<div class="theme-pick">
		{#each themes as t (t.label)}
			<button
				class="chip"
				aria-pressed={theme === t.id}
				title={t.hint}
				onclick={() => pickTheme(t.id)}
			>
				{t.label}
			</button>
		{/each}
	</div>
	<p class="note fineprint">
		Kept in this browser only — sign-in has nothing to do with it, and other devices keep their
		own setting.
	</p>
</div>

<style>
	.quote.error {
		border-left-color: var(--hostile);
		margin-bottom: 16px;
	}
	.bnet-btn {
		display: inline-block;
		background: var(--accent);
		color: var(--accent-contrast);
		border-radius: var(--radius-2);
		padding: 10px 18px;
		font-weight: 650;
		font-size: 14px;
		text-decoration: none;
		transition: background 120ms ease;
	}
	.bnet-btn:hover {
		background: var(--accent-dim);
	}
	.fineprint {
		margin-top: 10px;
		font-size: 12px;
	}
	.box {
		max-width: 640px;
	}
	.who {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.who-avatar {
		width: 44px;
		height: 44px;
		border-radius: var(--radius-2);
		object-fit: cover;
		border: 1px solid var(--border-strong);
	}
	.portrait {
		width: 34px;
		height: 34px;
		border-radius: var(--radius-2);
		object-fit: cover;
		border: 1px solid var(--border);
		align-self: center;
	}
	.btag {
		font-size: 16px;
		letter-spacing: -0.01em;
	}
	.linked {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.linked li {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 10px;
		border: 1px solid var(--border);
		border-radius: var(--radius-2);
		padding: 8px 12px;
	}
	.linked a {
		font-weight: 550;
		text-decoration: none;
	}
	.linked a:hover {
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.noplayer {
		font-weight: 550;
		color: var(--text-dim);
	}
	.meta {
		font-size: 12px;
		color: var(--text-faint);
		flex-basis: 100%;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 18px;
	}
	.chip.danger:hover {
		border-color: var(--hostile);
		color: var(--hostile);
	}
</style>
