<script lang="ts">
	/* Order matters: the contract names the scale and shape but no colour, the
	   palette supplies the colours and overrides anything above it. The fonts
	   the palette names are loaded first so nothing renders in a fallback. */
	import '@fontsource-variable/inter';
	import '@fontsource-variable/jetbrains-mono';
	import 'sveltekit-commons/tokens.css';
	import 'uar-shared/palette.css';
	import favicon from '$lib/assets/favicon.svg';
	import anonPortrait from '$lib/assets/anon-portrait.svg';
	import { portraitFallback } from '$lib/portrait';
	import { MadeBy } from 'cedricdessalles-commons';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { mosList, mosById } from '$lib/mos';
	import { displayName } from '$lib/ogcard';
	import { latestVersionInfo } from '$lib/changelog';
	import { rememberUmamiId } from '$lib/analytics';
	import { changelogIcon, navItems } from '$lib/nav';
	import CommandPalette from '$lib/components/CommandPalette.svelte';
	import ReadyToPlay from '$lib/components/ReadyToPlay.svelte';
	import SyncChip from '$lib/components/SyncChip.svelte';
	import { SearchChip } from 'sveltekit-commons';
	import { isSearchShortcut } from 'sveltekit-commons/palette';
	import { AppShell, NavItem, NavProgress, NavSection } from 'sveltekit-commons/app';

	let { children } = $props();

	/* Ko-fi handle for the footer tip link — the bare handle, not the URL.
	   Empty renders no tip link at all. */
	const KOFI = 'cedricdessalles';

	let palette = $state<ReturnType<typeof CommandPalette> | null>(null);

	/* Ctrl/Cmd+F, Ctrl/Cmd+K and "/" — the binding set lives in commons so this
	   site and STALZONE cannot drift on which keys open search, and the chip in
	   the bar names the first of them. Esc closes, which is the <dialog>
	   element's own doing. */
	function onWindowKeydown(e: KeyboardEvent) {
		if (!isSearchShortcut(e)) return;
		e.preventDefault();
		palette?.open();
	}

	function isActive(href: string): boolean {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname === href || page.url.pathname.startsWith(href + '/');
	}


	const pageTitle = $derived.by(() => {
		const p = page.url.pathname;
		if (p === '/') return { section: '', title: 'Overview' };
		if (p === '/entities') return { section: '', title: 'All entities' };
		if (p.startsWith('/entities/')) {
			// the loaded unit, not the path: the id is a map-internal symbol
			// (SiegeTank) where the name is what the game calls it (AMX S-880),
			// and this heading is the page's <h1>
			const u = page.data.unit as { name?: string } | undefined;
			const id = decodeURIComponent(p.slice('/entities/'.length));
			return { section: 'Entities', title: displayName(u?.name ?? '') || id };
		}
		if (p === '/guide') return { section: '', title: 'Quick guide' };
		if (p === '/si') return { section: '', title: 'Skill Identifiers' };
		if (p === '/ranks') return { section: '', title: 'Rank sets' };
		if (p === '/medals') return { section: '', title: 'Medals & decals' };
		if (p === '/camos') return { section: '', title: 'Camouflages' };
		if (p === '/players') return { section: '', title: 'Players' };
		if (p === '/clans') return { section: '', title: 'Clans' };
		if (p.startsWith('/clans/')) {
			return { section: 'Clans', title: `<${decodeURIComponent(p.slice(7))}>` };
		}
		if (p === '/replays') return { section: '', title: 'Replays' };
		if (p.startsWith('/replays/')) {
			const id = p.slice(9);
			const m = id.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})/);
			return { section: 'Replays', title: m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}` : id };
		}
		if (p.startsWith('/players/')) {
			const pl = page.data.player as { name?: string } | undefined;
			return {
				section: 'Players',
				title: pl?.name ?? p.slice(9),
				icon: (page.data.avatarUrl as string | null) ?? undefined,
				round: true
			};
		}
		if (p === '/map') return { section: '', title: 'Map & missions' };
		if (p === '/flow') return { section: '', title: 'Mission flow' };
		if (p === '/changelog') return { section: '', title: 'Changelog' };
		if (p === '/feedback') return { section: '', title: 'Feedback' };
		if (p === '/companion') return { section: '', title: 'UAR Companion' };
		if (p === '/account') return { section: '', title: 'Account' };
		if (p === '/mos') return { section: 'MOS', title: 'Classes compared' };
		if (p.startsWith('/mos/')) {
			// the class, whichever of its tabs is open — the tab bar names the tab
			const id = decodeURIComponent(p.slice(5).split('/')[0]);
			const m = mosById.get(id);
			return { section: 'MOS', title: m?.name ?? id, icon: m?.icon };
		}
		return { section: '', title: '' };
	});

	// Battle.net login state for the top-bar buttons; fetched client-side
	// because most pages (and this layout) are prerendered. undefined = not
	// yet known — the buttons stay hidden rather than flashing a wrong state.
	const signedOut = { battletag: null, avatar: null, toon: null };
	let me = $state<{ battletag: string | null; avatar: string | null; toon: string | null } | undefined>();
	onMount(async () => {
		try {
			const res = await fetch('/api/me');
			me = res.ok ? await res.json() : signedOut;
			// Cached for app.html, which stamps it on the landing pageview of
			// the next load — identify() below always arrives too late for that
			// one. A fetch that threw leaves the cache alone rather than
			// guessing signed-out.
			rememberUmamiId(me?.battletag ?? null);
		} catch {
			me = signedOut;
		}
		if (me?.battletag) identifyUmami(me.battletag, me.toon);
	});

	// Tie the Umami session (self-hosted, cookieless) to the signed-in
	// battletag. The tracker script is deferred, so retry until it's loaded.
	function identifyUmami(battletag: string, toon: string | null, tries = 0) {
		if (window.umami?.identify) {
			window.umami.identify(battletag, toon ? { toon } : undefined);
		} else if (tries < 20) {
			setTimeout(() => identifyUmami(battletag, toon, tries + 1), 250);
		}
	}

	// Changelog badge: latest released version + a dot when it's new to this visitor.
	const badge = latestVersionInfo(
		import.meta.glob('/changelog/v*/release.json', { eager: true, import: 'default' }) as Record<
			string,
			{ notable?: number }
		>
	);
	const siteVersion = badge.version;
	let newChanges = $state(false);
	$effect(() => {
		if (!siteVersion) return;
		const seen = localStorage.getItem('uar:seen-version');
		if (page.url.pathname === '/changelog' || seen === null) {
			localStorage.setItem('uar:seen-version', siteVersion);
			newChanges = false;
		} else {
			newChanges = badge.notable && seen !== siteVersion;
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<svelte:window onkeydown={onWindowKeydown} />

<CommandPalette bind:this={palette} />

<AppShell navKey="uar:nav-open" navLabel="Main">
	{#snippet brand()}
		<a class="brand-home" href="/" aria-label="Undead Assault Reborn — overview">
			<span class="brand-mark">UAR</span>
		</a>
	{/snippet}

	{#snippet crumb()}
		<NavProgress />
		<!-- the page heading lives here, and it is the page's <h1>: one heading,
		     in the one place the design shows it -->
		{#if pageTitle.section}<span class="crumb-section">{pageTitle.section} /</span>{/if}
		{#if pageTitle.icon}
			<img
				class="crumb-icon"
				class:round={pageTitle.round}
				src={pageTitle.icon}
				alt=""
				use:portraitFallback={anonPortrait}
			/>
		{/if}
		{#if pageTitle.title}<h1 class="crumb-title">{pageTitle.title}</h1>{/if}
	{/snippet}

	{#snippet tools(compactChips)}
		<!-- outside the sign-in gate below: search has nothing to do with being
		     signed in, and waiting on /api/me would leave the bar's one visible
		     search affordance missing for the first moment of every visit -->
		<SearchChip onopen={() => palette?.open()} compact={compactChips} />
		<!-- also outside the gate: a replay sync does not wait on /api/me, and
		     hiding its progress until that lands would drop the chip for the
		     first moment of every page -->
		<SyncChip compact={compactChips} />
		{#if me !== undefined}
			<ReadyToPlay signedIn={me.battletag != null} compact={compactChips} />
			<div class="acct-group">
				{#if me.battletag}
					<div class="acct-chip">
						<a
							class="acct-main"
							class:on={me.toon != null && page.url.pathname === `/players/${me.toon}`}
							href={me.toon ? `/players/${me.toon}` : '/account'}
							title={me.toon ? 'Your player profile' : 'Your Battle.net account'}
						>
							<img
								class="acct-avatar"
								src={me.avatar ?? anonPortrait}
								alt=""
								use:portraitFallback={anonPortrait}
							/>
							<span class="acct-tag">{me.battletag}</span>
						</a>
						<a
							class="acct-cog"
							class:on={page.url.pathname === '/account'}
							href="/account"
							aria-label="Account settings"
							title="Account settings"
						>
							<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
								stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<circle cx="12" cy="12" r="3" />
								<path
									d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
								/>
							</svg>
						</a>
					</div>
				{:else}
					<!-- signed out the chip keeps its shape: the settings end-cap is
					     there either way, because the theme lives behind it and it
					     has nothing to do with being signed in -->
					<div class="acct-chip">
						<a
							class="acct-main connect"
							class:on={page.url.pathname === '/account'}
							href="/account"
							title="Connect your Battle.net account"
						>
							<svg class="bnet-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
								<path d="M18.94 8.296C15.9 6.892 11.534 6 7.426 6.332c.206-1.36.714-2.308 1.548-2.508 1.148-.275 2.4.48 3.594 1.854.782.102 1.71.28 2.355.429C12.747 2.013 9.828-.282 7.607.565c-1.688.644-2.553 2.97-2.448 6.094-2.2.468-3.915 1.3-5.013 2.495-.056.065-.181.227-.137.305.034.058.146-.008.194-.04 1.274-.89 2.904-1.373 5.027-1.676.303 3.333 1.713 7.56 4.055 10.952-1.28.502-2.356.536-2.946-.087-.812-.856-.784-2.318-.19-4.04a26.764 26.764 0 0 1-.807-2.254c-2.459 3.934-2.986 7.61-1.143 9.11 1.402 1.14 3.847.725 6.502-.926 1.505 1.672 3.083 2.74 4.667 3.094.084.015.287.043.332-.034.034-.06-.08-.124-.131-.149-1.408-.657-2.64-1.828-3.964-3.515 2.735-1.929 5.691-5.263 7.457-8.988 1.076.86 1.64 1.773 1.398 2.595-.336 1.131-1.615 1.84-3.403 2.185a27.697 27.697 0 0 1-1.548 1.826c4.634.16 8.08-1.22 8.458-3.565.286-1.786-1.295-3.696-4.053-5.17.696-2.139.832-4.04.346-5.588-.029-.08-.106-.27-.196-.27-.068 0-.067.13-.063.187.135 1.547-.263 3.2-1.062 5.19zm-8.533 9.869c-1.96-3.145-3.09-6.849-3.082-10.594 3.702-.124 7.474.748 10.714 2.627-1.743 3.269-4.385 6.1-7.633 7.966h.001z" />
							</svg>
							<span class="acct-tag">Connect</span>
						</a>
						<a
							class="acct-cog"
							class:on={page.url.pathname === '/account'}
							href="/account"
							aria-label="Settings"
							title="Settings"
						>
							<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
								stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<circle cx="12" cy="12" r="3" />
								<path
									d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
								/>
							</svg>
						</a>
					</div>
				{/if}
			</div>
		{/if}
	{/snippet}

	{#snippet nav(close)}
		{#each navItems as item (item.href)}
			<NavItem
				href={item.href}
				label={item.label}
				active={isActive(item.href)}
				onclick={close}
			>
				{#snippet icon()}{@html item.icon}{/snippet}
			</NavItem>
		{/each}

		{#if siteVersion}
			<!-- the release the site is running, at the foot of the list: this is
			     where the site's news lives rather than another place to go. The
			     dot is the only loud part, and only until you have read it. -->
			<NavItem
				href="/changelog"
				label="Changelog"
				active={page.url.pathname === '/changelog'}
				onclick={close}
				title={newChanges
					? `Changelog — ${siteVersion} is new`
					: `Changelog — running ${siteVersion}`}
			>
				{#snippet icon()}
					{@html changelogIcon}
					{#if newChanges}<span
							class="ver-dot"
							class:inverted={page.url.pathname === '/changelog'}
							aria-hidden="true"
						></span>{/if}
				{/snippet}
				{#snippet trailing()}{siteVersion}{/snippet}
			</NavItem>
		{/if}

		<NavSection>MOS</NavSection>
		<NavItem
			href="/mos"
			label="Compare all"
			active={page.url.pathname === '/mos'}
			onclick={close}
			title="Compare all classes"
		>
			{#snippet icon()}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
					stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
					<line x1="6" y1="20" x2="6" y2="14" />
				</svg>
			{/snippet}
		</NavItem>
		{#each mosList as m (m.id)}
			<NavItem
				href="/mos/{m.id}"
				label={m.name}
				active={page.url.pathname === `/mos/${m.id}` ||
					page.url.pathname.startsWith(`/mos/${m.id}/`)}
				dense
				onclick={close}
				title={m.mos ? `${m.name} · ${m.mos}` : m.name}
			>
				{#snippet icon()}
					{#if m.icon}
						<img src={m.icon} alt="" loading="lazy" />
					{:else}
						<span class="mos-placeholder"></span>
					{/if}
				{/snippet}
				{#snippet trailing()}{m.mos ?? ''}{/snippet}
			</NavItem>
		{/each}
	{/snippet}

	{#snippet foot()}
		<!-- the full name lives here now: the top bar keeps only the mark, so
		     the crumb and the chips get that space back -->
		<b class="foot-title">Undead Assault Reborn</b>
		<span class="foot-note">Unofficial fan reference — map by Znimu#743.</span>
		<!-- collapsed, the credit keeps only its marks: they carry the link on
		     their own, the prose does not. AppShell's --label-display and
		     --foot-dir drive that, mapped onto the component's own names in the
		     stylesheet below — the wrapper exists to give those a scoped anchor,
		     since a rule cannot cross into the component itself. -->
		<div class="credit">
			<MadeBy repo="Geptyro/uar-website" kofi={KOFI} />
		</div>
	{/snippet}

	{@render children()}
</AppShell>

<style>
	/* ---------- site metrics ----------
	   The shell's own geometry (rail width, bar height, content padding, the
	   scrim/nav layers) belongs to AppShell now. What is left is what this
	   site's content measures against. */
	:global(:root) {
		/* the brand mark's width, which AppShell subtracts when it lines the
		   page heading up with the content column below it */
		--brand-w: 32px;
		/* A rule down the rail's inner edge. The rail and the content share a
		   surface here, so without it the nav has no edge and the icons read as
		   floating in the same field as the page. AppShell leaves this off by
		   default — see its .sidebar rule. */
		--rail-border: var(--border-width) solid var(--border);
		/* inner padding of cards and panels — one place, so narrow screens
		   can claw back the width every card was spending twice over */
		--card-pad-x: 14px;
		--card-pad-y: 12px;
		/* the air above an `h2.section`, i.e. the gap between two sections */
		--section-gap: 34px;
		/* Anything floating must clear every piece of chrome or it gets sliced
		   by the rail, which is fixed and so painted late whatever the source
		   order. Read by HoverPop as well, so the top-bar pops land on the same
		   layer as our own tooltips. (Sticky table headers are not on this
		   scale: they stack inside their own scroller and never meet the
		   chrome.) */
		--z-float: 60;

		/* Changelog entry kinds — one per `type` in CHANGELOG_SCHEMA
		   ($lib/changelog), read by name by commons' ChangeChip:
		   `var(--change-<type>)`.

		   Here rather than in uar-shared/palette.css because these are not
		   colours: they are four references to colours this site already has,
		   and the mapping is this site's changelog vocabulary rather than
		   anything the map's palette knows about. Adding a fifth entry type
		   means adding a line here, or the chip renders neutral. */
		--change-feature: var(--accent);
		--change-improvement: var(--mos);
		--change-fix: var(--hostile);
		--change-data: var(--item);
	}
	/* ---------- base ---------- */
	:global(*) {
		box-sizing: border-box;
	}
	:global(html),
	:global(body) {
		height: 100%;
	}
	:global(body) {
		margin: 0;
		background: var(--bg);
		color: var(--text);
		font: 14px/1.55 var(--font-sans);
		overflow: hidden;
		-webkit-font-smoothing: antialiased;
		/* Phones flash a translucent blue box over anything tappable. Every
		   surface here draws its own press and hover states, so that box only
		   ever arrives late and in the wrong colour — and on the profile's
		   unlock tiles it lies outright, since a tap opens a card rather than
		   following the link. The property inherits, so this is the one place
		   it needs saying. */
		-webkit-tap-highlight-color: transparent;
	}
	:global(code) {
		font-family: var(--font-mono);
		font-size: 0.9em;
	}
	:global(a) {
		color: inherit;
	}
	:global(:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
		border-radius: 2px;
	}
	:global(::selection) {
		background: color-mix(in srgb, var(--accent) 25%, transparent);
	}

	/* ---------- scrollbars ---------- */
	:global(*) {
		scrollbar-width: thin;
		scrollbar-color: var(--scroll-thumb) transparent;
	}
	:global(::-webkit-scrollbar) {
		width: 10px;
		height: 10px;
	}
	:global(::-webkit-scrollbar-track) {
		background: transparent;
	}
	:global(::-webkit-scrollbar-thumb) {
		background: var(--scroll-thumb);
		border-radius: 99px;
		border: 3px solid transparent;
		background-clip: padding-box;
	}
	:global(::-webkit-scrollbar-thumb:hover) {
		background: var(--scroll-thumb-hover);
		border: 2px solid transparent;
		background-clip: padding-box;
	}
	:global(::-webkit-scrollbar-corner) {
		background: transparent;
	}

	/* ---------- shared page primitives ---------- */
	:global(.eyebrow) {
		font-family: var(--font-mono);
		font-size: 10.5px;
		font-weight: 500;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-faint);
	}
	:global(.page-title) {
		margin: 2px 0 0;
		font-size: clamp(22px, 3.2vw, 28px);
		font-weight: 650;
		letter-spacing: -0.015em;
		line-height: 1.2;
		text-wrap: balance;
	}
	:global(.note) {
		color: var(--text-dim);
		font-size: 13px;
		max-width: 72ch;
		margin: 0 0 14px;
	}
	:global(h2.section) {
		display: flex;
		align-items: center;
		gap: 10px;
		font-family: var(--font-mono);
		font-size: 11.5px;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-dim);
		/* Named because it is spacing *between* sections, and the first heading
		   on a page is not between anything — whoever leads a column has to give
		   it back, and can only do that in the same terms and at the same
		   breakpoint (the profile's overview does it by hand at 4px; the
		   collection's first row reads this). */
		margin: var(--section-gap) 0 12px;
	}
	:global(h2.section::after) {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--border);
	}

	:global(.tiles) {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	:global(.tile) {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-3);
		box-shadow: var(--shadow-1);
		padding: 10px 16px 9px;
		min-width: 96px;
	}
	:global(.tile b) {
		display: block;
		font-size: 19px;
		font-weight: 650;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.01em;
	}
	:global(.tile span) {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text-faint);
	}
	:global(a.tile) {
		text-decoration: none;
		transition: border-color 140ms ease, transform 140ms ease, box-shadow 140ms ease;
	}
	:global(a.tile:hover) {
		border-color: var(--border-strong);
		transform: translateY(-1px);
		box-shadow: var(--shadow-2);
	}

	:global(.tablewrap) {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-3);
		box-shadow: var(--shadow-1);
		overflow-x: auto;
	}
	:global(table.data) {
		border-collapse: collapse;
		width: 100%;
		font-size: 13px;
	}
	:global(table.data th) {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		text-align: left;
		color: var(--text-faint);
		background: var(--surface);
		border-bottom: 1px solid var(--border-strong);
		padding: 10px 12px;
		white-space: nowrap;
		position: sticky;
		top: 0;
		z-index: 1;
	}
	:global(table.data td) {
		border-bottom: 1px solid var(--border);
		padding: 7px 12px;
		vertical-align: top;
	}
	:global(table.data tbody tr) {
		transition: background 100ms ease;
	}
	:global(table.data tbody tr:hover) {
		background: var(--surface-raised);
	}
	:global(table.data tbody tr:last-child td) {
		border-bottom: none;
	}
	:global(table.data th.num),
	:global(table.data td.num) {
		text-align: right;
	}
	:global(table.data td.num) {
		font-family: var(--font-mono);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	:global(table.data td a) {
		text-decoration: none;
		font-weight: 550;
	}
	:global(table.data td a:hover) {
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	:global(.mono) {
		font-family: var(--font-mono);
		font-size: 11.5px;
		color: var(--text-dim);
	}

	/* ---------- board tables ----------
	   A name, a count, and a bar read against the top row. The weekly boards
	   on the front page and the career boards on a player page are the same
	   table, so the two pages read as one thing. Every column takes its own
	   width and what is left over goes to the bar — the part worth having
	   long. Bars are read against their own board's top row and never across
	   boards, so two tables not lining up column-for-column costs nothing. */
	:global(table.data.board) {
		width: 100%;
		--fig: 34px;
		--fig-x: 12px;
	}
	:global(table.data.board th),
	:global(table.data.board td) {
		width: 1%;
		white-space: nowrap;
		vertical-align: middle;
	}
	/* The bar takes everything the named columns leave — but keeps a floor.
	   It used to give all of it back when cramped, so a board with a few
	   named columns kept its bar and a board with several lost it entirely on
	   a phone: a bar an eighth of a row long says nothing. Now the bar keeps
	   room to be a bar, and a board that cannot fit scrolls in its wrapper. */
	:global(table.data.board th.barcell),
	:global(table.data.board td.barcell) {
		width: 100%;
		min-width: 56px;
	}
	/* On a phone the named columns already take most of the row, and 56px
	   beside them still read as a stub. A quarter of the screen is what a
	   bar needs to show a ranking; the board scrolls for the rest. */
	@media (max-width: 640px) {
		:global(table.data.board th.barcell),
		:global(table.data.board td.barcell) {
			min-width: 110px;
		}
	}
	/* the order is the ranking, and the number says how far down it you are */
	:global(table.data.board th.pos),
	:global(table.data.board td.pos) {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--text-faint);
		text-align: right;
		font-variant-numeric: tabular-nums;
		/* the picture carries its own inset, so the number does not pay twice */
		padding-right: 0;
	}
	/* The row's picture is drawn to the row's own height, border to border, so
	   a board reads down as a column of faces rather than one of stamps. It is
	   taken out of flow: the row keeps the height its text gives it, and the
	   cell gives the width back as padding. */
	:global(table.data.board td.figcell) {
		position: relative;
		padding-top: 0;
		padding-bottom: 0;
		padding-left: calc(var(--fig-x) + var(--fig) + 8px);
	}
	/* height rather than top+bottom: an out-of-flow <img> is a replaced box, so
	   it answers `bottom` with its own intrinsic height and stops short of the
	   row. A percentage resolves against the cell, which is the row. */
	:global(table.data.board .figimg) {
		position: absolute;
		left: var(--fig-x);
		top: 0;
		height: 100%;
		width: var(--fig);
		object-fit: cover;
		border-radius: 3px;
		border: 1px solid var(--border);
	}
	:global(table.data.board .figimg.placeholder) {
		background: var(--surface-raised);
	}
	/* One bar for every board. Wins by mode passes --bar so each row is drawn
	   in its own mode's colour, the same ramp the icons carry; the other
	   boards set nothing and stay on the accent. */
	:global(table.data.board .boardbar) {
		height: 8px;
		border-radius: 2px;
		background: var(--bar, var(--accent));
		opacity: 0.55;
		min-width: 2px;
	}

	/* ---------- list pages: /players and /entities ----------
	   One shape for the three. The toolbar and the table header stay put and
	   only the rows scroll, so the table reaches the bottom of the window
	   instead of floating above it, and runs the full width of the content
	   area. The page takes what the shell leaves; anything above the rows (a
	   toolbar, a note) keeps its own height and the rows take the rest. */
	/* Goes in a `<Page fill>` — a column that does not scroll — and takes what is
	   left in it; the rows below scroll inside that. It used to work its own
	   height out from 100dvh less the top bar less the column's padding, with a
	   negative bottom margin to give the padding back, because the shell scrolled
	   the page and there was no way to be told how much room was left. A page
	   that owns its scroller is handed the room instead. */
	:global(.datapage) {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}
	:global(.datapage .dtools) {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px 14px;
		/* breathing room between the toolbar and the table header */
		margin-bottom: 12px;
	}
	/* whatever ends the toolbar — a pager, a count — holds the right end */
	:global(.datapage .dtools .right) {
		margin-left: auto;
	}
	:global(.datapage .dtools .chips) {
		display: flex;
		flex-wrap: wrap;
		gap: 7px;
	}
	:global(.datapage .dtools .pager) {
		margin: 0;
	}
	:global(.datapage .dtools input[type='search']) {
		min-width: 240px;
	}
	:global(.datapage .rows) {
		flex: 1;
		min-height: 0;
		overflow: auto;
		margin-inline: calc(-1 * var(--content-pad-x, 36px));
		border-inline: none;
		border-radius: 0;
	}
	:global(.datapage .rows thead th) {
		position: sticky;
		top: 0;
		z-index: 2;
		background: var(--surface-raised);
	}
	/* a row's place in the current sort, not an identity: quiet */
	:global(.datapage .rownum) {
		color: var(--text-faint);
	}
	:global(.rowcount) {
		font-family: var(--font-mono);
		font-size: 11.5px;
		color: var(--text-faint);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	/* Sortable headers look and behave the same whether the sort is a link
	   (server-paged) or local state — the control fills the label, so the
	   header reads as one word you can click and tab to. */
	:global(table.data th.sortable) {
		user-select: none;
	}
	:global(table.data th.sortable:hover) {
		color: var(--text);
	}
	:global(table.data th.sortable a),
	:global(table.data th.sortable button) {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font: inherit;
		color: inherit;
		background: none;
		border: 0;
		padding: 0;
		cursor: pointer;
		text-decoration: none;
	}
	:global(table.data th .dir) {
		color: var(--accent);
		font-size: 11px;
	}

	:global(.tag) {
		display: inline-block;
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 550;
		letter-spacing: 0.04em;
		padding: 2.5px 9px;
		border-radius: 99px;
		white-space: nowrap;
		color: var(--text-dim);
		background: var(--surface-raised);
	}
	:global(.tag.t-mos) {
		color: var(--mos);
		background: var(--mos-soft);
	}
	:global(.tag.t-hostile) {
		color: var(--hostile);
		background: var(--hostile-soft);
	}
	:global(.tag.t-item) {
		color: var(--item);
		background: var(--item-soft);
	}

	:global(input[type='search']),
	:global(select) {
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-2);
		padding: 7px 12px;
		font: inherit;
		transition: border-color 120ms ease, box-shadow 120ms ease, width 160ms ease;
	}
	:global(input[type='search']:focus),
	:global(select:focus) {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-soft);
	}
	:global(input[type='search']::placeholder) {
		color: var(--text-faint);
	}

	:global(.chip) {
		background: var(--surface);
		color: var(--text-dim);
		border: 1px solid var(--border-strong);
		border-radius: 99px;
		font: 500 11.5px/1 var(--font-mono);
		letter-spacing: 0.03em;
		padding: 7px 13px;
		cursor: pointer;
		transition: all 120ms ease;
	}
	:global(.chip:hover) {
		border-color: var(--accent);
		color: var(--accent);
	}
	:global(.chip[aria-pressed='true']) {
		background: var(--accent);
		color: var(--accent-contrast);
		border-color: var(--accent);
	}

	:global(.card) {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-3);
		box-shadow: var(--shadow-1);
		padding: 14px 16px;
	}
	:global(a.card) {
		text-decoration: none;
		transition: border-color 140ms ease, transform 140ms ease, box-shadow 140ms ease;
	}
	:global(a.card:hover) {
		border-color: var(--border-strong);
		transform: translateY(-1px);
		box-shadow: var(--shadow-2);
	}

	:global(.quote) {
		background: var(--surface);
		border: 1px solid var(--border);
		border-left: 3px solid var(--accent);
		border-radius: var(--radius-2);
		padding: 13px 16px;
		white-space: pre-wrap;
		font: 13px/1.6 var(--font-sans);
		color: var(--text-dim);
		max-width: 78ch;
		overflow-x: auto;
		margin: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		:global(*) {
			transition: none !important;
		}
	}

	/* ---------- shell: topbar over (sidebar | main) ---------- */

	/* The nav has one shape in two sizes, and the whole difference is these
	   variables — declared here so the top bar can line its heading up with
	   the content under it, and animate along with the sidebar.
	   The rail is the floor: every mode either keeps it or widens it, so a
	   new label cannot forget to fold away (which is what broke the changelog
	   row when the list was maintained by hand). */
	/* ---------- UAR's own chrome ----------
	   The shell — top bar, rail, drawer, content column and the variables that
	   collapse them — is sveltekit-commons/app's AppShell. What is left here is
	   what makes it look like this site: the mark, the crumb, the account chip
	   and the sidebar's footer.

	   AppShell publishes --label-display, --nav-slot, --nav-glyph and friends,
	   so anything below that has to fold away with the rail just reads them. */

	.brand-home {
		display: flex;
		flex: none;
		text-decoration: none;
	}
	.brand-mark {
		display: grid;
		place-items: center;
		width: var(--brand-w);
		height: 32px;
		border-radius: var(--radius-2);
		background: var(--accent);
		color: var(--accent-contrast);
		font: 700 11px/1 var(--font-mono);
		letter-spacing: 0.03em;
	}

	.crumb-section {
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-dim);
		white-space: nowrap;
	}
	/* the subject's portrait, level with the heading rather than its baseline */
	.crumb-icon {
		width: 24px;
		height: 24px;
		align-self: center;
		flex: none;
		object-fit: cover;
		border-radius: var(--radius-2);
		border: var(--border-width) solid var(--border);
	}
	.crumb-icon.round {
		border-radius: 50%;
	}
	/* an <h1> in the bar: the page's one heading, sized like a crumb */
	.crumb-title {
		margin: 0;
		font-size: 15.5px;
		font-weight: 650;
		letter-spacing: -0.01em;
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.acct-group {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	/* Connect = the same chip signed out, with the swirl where the portrait
	   end-cap would be, so only the contents change between the two states */
	.acct-main.connect {
		padding-left: 13px;
		border-radius: 99px 0 0 99px;
	}
	.bnet-icon {
		flex-shrink: 0;
	}
	/* portrait = full-height circular LEFT end-cap, mirroring the cog:
	   30px like the chip, negative margins overlap its ring onto the border */
	.acct-avatar {
		width: 30px;
		height: 30px;
		flex: none;
		margin: -1px 0 -1px -1px;
		border-radius: 50%;
		object-fit: cover;
		border: 1px solid color-mix(in srgb, currentColor 40%, transparent);
	}
	/* logged-in chip in MOS blue so it stands out of the dark topbar;
	   30px tall like the ready chip so the whole row lines up */
	.acct-chip {
		display: flex;
		align-items: stretch;
		height: 30px;
		background: var(--mos);
		border: 1px solid var(--mos);
		border-radius: 99px;
	}
	.acct-main {
		display: flex;
		align-items: center;
		gap: 7px;
		color: var(--accent-contrast);
		/* left 0: the portrait end-cap sits on the chip edge;
		   right padding runs under the overlapping cog circle */
		padding: 0 24px 0 0;
		border-radius: 99px 0 0 99px;
		font: 500 12px/1 var(--font-mono);
		text-decoration: none;
		white-space: nowrap;
		transition: all 120ms ease;
	}
	.acct-main:hover,
	.acct-main.on {
		background: color-mix(in srgb, currentColor 12%, transparent);
	}
	/* cog = darker circular end-cap overlapping the chip, like the ready chip */
	.acct-cog {
		display: flex;
		align-items: center;
		justify-content: center;
		align-self: stretch;
		flex: none;
		width: 30px;
		position: relative;
		margin: -1px -1px -1px -15px;
		/* frosted: text color over chip color, opaque to mask the tint below */
		background: color-mix(in srgb, var(--accent-contrast) 18%, var(--mos));
		color: var(--accent-contrast);
		border: 1px solid color-mix(in srgb, currentColor 40%, transparent);
		border-radius: 50%;
		transition: all 120ms ease;
	}
	.acct-cog:hover,
	.acct-cog.on {
		background: color-mix(in srgb, var(--accent-contrast) 30%, var(--mos));
	}

	/* unread release: a dot on the icon — visible in the rail too, and gone for
	   good once the changelog has been opened. The ring is the rail's own
	   colour rather than following the row's hover, because the row belongs to
	   NavItem and reaching into another component's classes to track its state
	   is exactly the coupling this extraction was meant to remove. */
	.ver-dot {
		position: absolute;
		top: -1px;
		right: 0;
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 0 2px var(--surface-sunken);
	}
	/* on the selected row the dot inverts, or it would vanish into the accent */
	.ver-dot.inverted {
		background: var(--accent-contrast);
		box-shadow: 0 0 0 2px var(--accent);
	}

	/* A class with no portrait yet still holds the tile, or the rail reads as a
	   column of pictures with a hole in it. --nav-tile is the square NavItem
	   draws a real portrait at, so this follows it rather than measuring the
	   result. */
	.mos-placeholder {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: var(--nav-tile);
		height: var(--nav-tile);
		border-radius: var(--radius-2);
		background: var(--surface-raised);
	}

	/* ---------- sidebar footer ---------- */
	.foot-title {
		display: var(--label-display);
		font-size: 12px;
		font-weight: 650;
		color: var(--text-dim);
	}
	.foot-note {
		display: var(--label-display);
	}
	/* The credit row is cedricdessalles-commons' MadeBy now, shared with the
	   personal site. Scoped rules stop at a component boundary, so its
	   geometry is set through the custom properties it publishes rather than
	   by styling its insides — a :global(.author) reaching past the boundary
	   would break silently the next time that package renamed a class.
	   Stacked with the words, side by side without them: the same AppShell
	   variables the rest of the rail already reads.

	   The colours are the deliberate exception. The signature keeps its brand
	   accent on hover instead of this site's --accent-dim, because it is the
	   one thing down here that is mine rather than UAR's. At rest it still
	   takes --text-dim, so it reads as part of the footer and not as a badge
	   someone embedded. */
	.credit :global(.made-by) {
		--madeby-label-display: var(--label-display);
		--madeby-dir: var(--foot-dir);
		--madeby-align: var(--foot-align);
		--madeby-glyph: calc(var(--nav-glyph) - 3px);
		--madeby-ink: var(--text-dim);
		margin-top: 6px;
	}

	/* On a phone every nested box was charging desktop padding: the content
	   column, then the card, then the table cell. Trim the shared ones — the
	   components that use --card-pad-* follow along. */
	@media (max-width: 899.98px) {
		:global(:root) {
			--card-pad-x: 10px;
			--card-pad-y: 10px;
			--section-gap: 24px;
		}
		:global(.card) {
			padding: var(--card-pad-y) var(--card-pad-x);
		}
		:global(.tile) {
			padding: 9px 12px 8px;
			min-width: 78px;
		}
		:global(table.data th) {
			padding: 9px 9px;
		}
		:global(table.data td) {
			padding: 6px 9px;
		}
		/* the picture follows the cell's own inset in */
		:global(table.data.board) {
			--fig: 30px;
			--fig-x: 9px;
		}
		:global(h2.section) {
			margin: var(--section-gap) 0 10px;
		}
		:global(.quote) {
			padding: 11px 12px;
		}
	}

	/* the account chip keeps its portrait, the battletag goes */
	@media (max-width: 700px) {
		.acct-tag {
			display: none;
		}
		.acct-main {
			gap: 0;
			/* The cog overlaps the chip by 15px, so this padding buys nothing
			   until it passes that — at exactly 15px the portrait and the swirl
			   ended up flush against the cog's edge with no air at all. Keep the
			   9px of clearance the wide chip has. */
			padding-right: 24px;
		}
		/* with the word gone the swirl carries the button, centred in its half */
		.acct-main.connect {
			padding-left: 11px;
		}
	}
</style>
