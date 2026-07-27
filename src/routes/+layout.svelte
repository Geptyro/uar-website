<script lang="ts">
	import '@fontsource-variable/inter';
	import '@fontsource-variable/jetbrains-mono';
	import favicon from '$lib/assets/favicon.svg';
	import anonPortrait from '$lib/assets/anon-portrait.svg';
	import cdMark from '$lib/assets/cd-mark.svg';
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { mosList, mosById } from '$lib/mos';
	import { latestVersionInfo } from '$lib/changelog';
	import ReadyToPlay from '$lib/components/ReadyToPlay.svelte';

	let { children } = $props();

	/* Nav: one burger at every width. Wide screens dock the sidebar and
	   remember whether you collapsed it; narrow ones slide it in over the
	   content and close it again on navigation. `navOpen === null` means
	   "not decided yet" — the CSS default (docked when wide) then holds, so
	   the prerendered markup can't flash the wrong state. */
	const WIDE = '(min-width: 900px)';
	/* Below this the chips go icon + count, so the bar stays on one line. */
	const COMPACT_CHIPS = '(max-width: 1100px)';
	const NAV_KEY = 'uar:nav-open';

	let wide = $state(true);
	let compactChips = $state(false);
	let navOpen = $state<boolean | null>(null);
	const drawer = $derived(navOpen === true && !wide);

	onMount(() => {
		const wideMq = matchMedia(WIDE);
		const chipsMq = matchMedia(COMPACT_CHIPS);
		const syncNav = () => {
			wide = wideMq.matches;
			// a phone always starts closed; a desktop restores your last choice
			navOpen = wide ? localStorage.getItem(NAV_KEY) !== '0' : false;
		};
		const syncChips = () => (compactChips = chipsMq.matches);
		syncNav();
		syncChips();
		wideMq.addEventListener('change', syncNav);
		chipsMq.addEventListener('change', syncChips);
		return () => {
			wideMq.removeEventListener('change', syncNav);
			chipsMq.removeEventListener('change', syncChips);
		};
	});

	function toggleNav() {
		navOpen = !(navOpen ?? wide);
		if (wide) localStorage.setItem(NAV_KEY, navOpen ? '1' : '0');
	}

	/* The rail's edge hints: which way there is more to see. Reading it from
	   the scroll position (rather than letting the content wipe a cover layer
	   off, as this used to) is what lets CSS fade each edge in and out — the
	   two numbers are the only state the stylesheet needs. */
	let sideEl = $state<HTMLElement | null>(null);
	let hintUp = $state(0);
	let hintDown = $state(0);
	function syncHints() {
		if (!sideEl) return;
		const max = sideEl.scrollHeight - sideEl.clientHeight;
		hintUp = sideEl.scrollTop > 1 ? 1 : 0;
		hintDown = max > 1 && sideEl.scrollTop < max - 1 ? 1 : 0;
	}
	onMount(() => {
		if (!sideEl) return;
		// the box for viewport and collapse changes, the children for the
		// content growing or folding under them
		const ro = new ResizeObserver(syncHints);
		ro.observe(sideEl);
		for (const child of sideEl.children) ro.observe(child);
		return () => ro.disconnect();
	});

	// picking a destination closes the overlay; the docked sidebar stays put.
	// Both hooks earn their keep: afterNavigate catches links inside the page,
	// the click handler catches a tap on the page you are already on.
	const closeDrawer = () => {
		if (!wide) navOpen = false;
	};
	afterNavigate(closeDrawer);

	// Feather-style stroke icons, same visual language as the account cog.
	const icon = (paths: string) =>
		`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

	const changelogIcon = icon(
		'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'
	);

	const nav = [
		{
			href: '/',
			label: 'Overview',
			icon: icon(
				'<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'
			)
		},
		{
			href: '/entities',
			label: 'Entities',
			icon: icon(
				'<circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/>'
			)
		},
		{
			href: '/si',
			label: 'Skill IDs',
			icon: icon(
				'<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>'
			)
		},
		{
			href: '/ranks',
			label: 'Ranks',
			icon: icon('<polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/>')
		},
		{
			href: '/medals',
			label: 'Medals & decals',
			icon: icon(
				'<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>'
			)
		},
		{
			href: '/camos',
			label: 'Camouflages',
			icon: icon('<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>')
		},
		{
			href: '/players',
			label: 'Players',
			icon: icon(
				'<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'
			)
		},
		{
			href: '/clans',
			label: 'Clans',
			icon: icon(
				'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
			)
		},
		{
			href: '/replays',
			label: 'Replays',
			icon: icon('<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>')
		},
		{
			href: '/map',
			label: 'Map & missions',
			icon: icon(
				'<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>'
			)
		},
		{
			href: '/flow',
			label: 'Mission flow',
			icon: icon(
				'<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>'
			)
		},
		{
			href: '/companion',
			label: 'Companion app',
			icon: icon(
				'<rect x=\'2\' y=\'3\' width=\'20\' height=\'14\' rx=\'2\'/><line x1=\'8\' y1=\'21\' x2=\'16\' y2=\'21\'/><line x1=\'12\' y1=\'17\' x2=\'12\' y2=\'21\'/>'
			)
		},
		{
			href: '/feedback',
			label: 'Feedback',
			icon: icon('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>')
		}
	];

	function isActive(href: string): boolean {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname === href || page.url.pathname.startsWith(href + '/');
	}

	const pageTitle = $derived.by(() => {
		const p = page.url.pathname;
		if (p === '/') return { section: '', title: 'Overview' };
		if (p === '/entities') return { section: '', title: 'All entities' };
		if (p.startsWith('/entities/')) {
			const id = decodeURIComponent(p.slice(7));
			return { section: 'Entities', title: id };
		}
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
			const m = mosById.get(decodeURIComponent(p.slice(5)));
			return { section: 'MOS', title: m?.name ?? p.slice(5), icon: m?.icon };
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

<div class="shell" class:nav-open={navOpen === true} class:nav-closed={navOpen === false}>
	<header class="topbar">
		<button
			class="burger"
			onclick={toggleNav}
			aria-label={(navOpen ?? wide) ? 'Close menu' : 'Open menu'}
			aria-expanded={navOpen ?? wide}
			aria-controls="site-nav"
			title="Menu"
		>
			<!-- one glyph, not two icons swapped: the bars fold into the cross and
			     the whole mark turns with them, so opening and closing read as the
			     same motion run both ways. Which end it rests at comes from the
			     shell in CSS, like the rail itself, so the prerendered markup
			     cannot flash the wrong icon before the nav state is known. -->
			<span class="burger-glyph" aria-hidden="true">
				<span class="bar"></span><span class="bar"></span><span class="bar"></span>
			</span>
		</button>
		<a class="brand-home" href="/" aria-label="Undead Assault Reborn — overview">
			<span class="brand-mark">UAR</span>
		</a>
		<!-- the page heading lives here, and it is the page's <h1>: one heading,
		     in the one place the design shows it -->
		<div class="page-crumb">
			{#if pageTitle.section}<span class="crumb-section">{pageTitle.section} /</span>{/if}
			{#if pageTitle.icon}
				<img class="crumb-icon" class:round={pageTitle.round} src={pageTitle.icon} alt="" />
			{/if}
			{#if pageTitle.title}<h1 class="crumb-title">{pageTitle.title}</h1>{/if}
		</div>
		{#if me !== undefined}
			<div class="top-right">
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
								<img class="acct-avatar" src={me.avatar ?? anonPortrait} alt="" />
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
			</div>
		{/if}
	</header>

	<div class="body">
		{#if drawer}
			<button class="scrim" aria-label="Close menu" onclick={() => (navOpen = false)}></button>
		{/if}
		<aside
			class="sidebar"
			id="site-nav"
			bind:this={sideEl}
			onscroll={syncHints}
			ontransitionend={syncHints}
			style="--hint-up: {hintUp}; --hint-down: {hintDown}"
		>
			<nav aria-label="Main">
				{#each nav as item (item.href)}
					<!-- title, not just text: collapsed to the rail the label is gone
					     from the box and from the accessibility tree with it -->
					<a
						href={item.href}
						class:active={isActive(item.href)}
						onclick={closeDrawer}
						title={item.label}
					>
						<span class="nav-icon">{@html item.icon}</span>
						<span class="nav-label">{item.label}</span>
					</a>
				{/each}
				{#if siteVersion}
					<!-- the release the site is running, at the foot of the list: the
					     dot is the only loud part, and only until you have read it -->
					<a
						class="nav-ver"
						href="/changelog"
						class:active={page.url.pathname === '/changelog'}
						onclick={closeDrawer}
						title={newChanges
							? `Changelog — ${siteVersion} is new`
							: `Changelog — running ${siteVersion}`}
					>
						<span class="nav-icon">
							{@html changelogIcon}
							{#if newChanges}<span class="ver-dot" aria-hidden="true"></span>{/if}
						</span>
						<span class="nav-label">Changelog</span>
						<span class="ver-code">{siteVersion}</span>
					</a>
				{/if}
			</nav>

			<div class="side-label">MOS</div>
			<nav class="mos-nav" aria-label="MOS classes">
				<a
					class="mos-all"
					href="/mos"
					class:active={page.url.pathname === '/mos'}
					onclick={closeDrawer}
					title="Compare all classes"
				>
					<span class="nav-icon">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
							stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
							<line x1="6" y1="20" x2="6" y2="14" />
						</svg>
					</span>
					<span class="nav-label">Compare all</span>
				</a>
				{#each mosList as m (m.id)}
					<a
						href="/mos/{m.id}"
						class:active={page.url.pathname === `/mos/${m.id}`}
						onclick={closeDrawer}
						title={m.mos ? `${m.name} · ${m.mos}` : m.name}
					>
						{#if m.icon}
							<img class="mos-icon" src={m.icon} alt="" loading="lazy" />
						{:else}
							<span class="mos-icon placeholder"></span>
						{/if}
						<span class="mos-name">{m.name}</span>
						{#if m.mos}<span class="mos-code">{m.mos}</span>{/if}
					</a>
				{/each}
			</nav>

			<div class="side-foot">
				<!-- the full name lives here now: the top bar keeps only the mark, so
				     the crumb and the chips get that space back -->
				<b class="foot-title">Undead Assault Reborn</b>
				<span class="foot-note">Unofficial fan reference — map by Znimu#743.</span>
				<!-- collapsed, the credit keeps only its two marks: they carry the
				     link on their own, the prose does not -->
				<div class="foot-links">
					<a
						class="author"
						href="https://cedricdessalles.dev"
						target="_blank"
						rel="noopener"
						title="Built by Cédric Dessalles"
					>
						<img class="cd-mark" src={cdMark} alt="" />
						<span class="author-label">Built by Cédric Dessalles ↗</span>
					</a>
					<a
						class="gh"
						href="https://github.com/Geptyro/uar-website"
						target="_blank"
						rel="noopener"
						title="Source on GitHub"
					>
						<svg viewBox="0 0 16 16" aria-hidden="true">
							<path
								fill-rule="evenodd"
								d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
							/>
						</svg>
						<span class="gh-label">Source on GitHub ↗</span>
					</a>
				</div>
			</div>
		</aside>

		<main>
			<div class="content">
				{@render children()}
			</div>
		</main>
	</div>
</div>

<style>
	/* ---------- design tokens ----------
	   Light is the base. Dark arrives two ways and the list is the same in
	   both: the device asks for it and you have not overridden it, or you
	   picked Dark on /account (app.html pins data-theme on <html> before the
	   first paint). Plain declarations rather than light-dark(), because the
	   dev server ships the CSS as written and a browser without light-dark()
	   would leave the switch doing nothing at all. Keep the two dark blocks
	   identical — a token added to one and not the other goes wrong in only
	   one of the two ways of being dark, which is a miserable thing to find. */
	:global(:root) {
		color-scheme: light;
		--bg: #f1efe8;
		--surface: #faf9f4;
		--surface-2: #eae7dc;
		/* The rail and the top bar are chrome, so they sit a step *below* the
		   page rather than above it — the same relationship the dark theme has,
		   read the other way up. They used to be dark green in both themes,
		   which is what made light mode look half-finished. */
		--sidebar: #e5e1d3;
		--sidebar-2: #d8d3c1;
		--sidebar-ink: #333829;
		--sidebar-ink-2: #5f6550;
		--sidebar-line: #ccc7b3;
		/* the bar's strongest ink — the page heading and a hovered burger */
		--sidebar-title: #1b1f14;
		--border: #ddd8c9;
		--border-strong: #b9b3a0;
		--ink: #23271c;
		--ink-2: #5c6151;
		--ink-3: #8d927f;
		--accent: #52713d;
		--accent-hover: #46612f;
		--accent-soft: color-mix(in srgb, var(--accent) 12%, transparent);
		--on-accent: #fff;
		--mos: #3d6483;
		--mos-soft: color-mix(in srgb, var(--mos) 11%, transparent);
		--hostile: #a84632;
		--hostile-soft: color-mix(in srgb, var(--hostile) 11%, transparent);
		--item: #91702c;
		--item-soft: color-mix(in srgb, var(--item) 13%, transparent);
		/* prestige, and nothing else: the one place the site goes gold */
		--gold: #96731d;
		--gold-soft: color-mix(in srgb, var(--gold) 13%, transparent);
		--gold-line: color-mix(in srgb, var(--gold) 55%, transparent);
		--scroll-thumb: #b9b3a0;
		--scroll-thumb-hover: #9b9480;
		--shadow-1: 0 1px 2px rgb(30 32 24 / 0.05), 0 1px 1px rgb(30 32 24 / 0.03);
		--shadow-2: 0 2px 8px rgb(30 32 24 / 0.08), 0 1px 2px rgb(30 32 24 / 0.05);
		--r-sm: 5px;
		--r: 8px;
		--r-lg: 12px;
		--topbar-h: 52px;
		/* shell metrics the top bar and the content both measure against */
		--rail-w: 58px;
		--content-pad-x: 36px;
		/* inner padding of cards and panels — one place, so narrow screens
		   can claw back the width every card was spending twice over */
		--card-pad-x: 14px;
		--card-pad-y: 12px;
		--top-gap: 10px;
		--top-pad-x: 14px;
		--burger-w: 34px;
		--mark-w: 32px;
		/* The three layers that overlap each other, in one place and in order.
		   Anything floating must clear every piece of chrome or it gets sliced
		   by the rail, which is fixed and so painted late whatever the source
		   order. --z-float is read by uar-shared's HoverPop as well, so the
		   top-bar pops land on the same layer as our own tooltips. (Sticky
		   table headers are not on this scale: they stack inside their own
		   scroller and never meet the chrome.) */
		--z-scrim: 45;
		--z-nav: 50;
		--z-float: 60;
		--sans: 'Inter Variable', system-ui, -apple-system, 'Segoe UI', sans-serif;
		--mono: 'JetBrains Mono Variable', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
	}
	/* dark because the device asks for it — unless you have said otherwise */
	@media (prefers-color-scheme: dark) {
		:global(:root:not([data-theme='light'])) {
			color-scheme: dark;
			--bg: #14170f;
			--surface: #1b1f16;
			--surface-2: #23281c;
			--sidebar: #101309;
			--sidebar-2: #1a1e12;
			--sidebar-ink: #d3d1bf;
			--sidebar-ink-2: #7c8269;
			--sidebar-line: #262c1c;
			--sidebar-title: #fff;
			--border: #2d3324;
			--border-strong: #454d38;
			--ink: #e2e0d1;
			--ink-2: #a3a891;
			--ink-3: #757b65;
			--accent: #8db566;
			--accent-hover: #a0c77c;
			--on-accent: #131608;
			--mos: #7fadd1;
			--hostile: #d97f61;
			--item: #cfa95c;
			--gold: #e2b757;
			--scroll-thumb: #3c4430;
			--scroll-thumb-hover: #4f5940;
			--shadow-1: 0 1px 2px rgb(0 0 0 / 0.35);
			--shadow-2: 0 2px 10px rgb(0 0 0 / 0.45);
		}
	}
	/* dark because you picked it on /account, whatever the device says */
	:global(:root[data-theme='dark']) {
		color-scheme: dark;
		--bg: #14170f;
		--surface: #1b1f16;
		--surface-2: #23281c;
		--sidebar: #101309;
		--sidebar-2: #1a1e12;
		--sidebar-ink: #d3d1bf;
		--sidebar-ink-2: #7c8269;
		--sidebar-line: #262c1c;
		--sidebar-title: #fff;
		--border: #2d3324;
		--border-strong: #454d38;
		--ink: #e2e0d1;
		--ink-2: #a3a891;
		--ink-3: #757b65;
		--accent: #8db566;
		--accent-hover: #a0c77c;
		--on-accent: #131608;
		--mos: #7fadd1;
		--hostile: #d97f61;
		--item: #cfa95c;
		--gold: #e2b757;
		--scroll-thumb: #3c4430;
		--scroll-thumb-hover: #4f5940;
		--shadow-1: 0 1px 2px rgb(0 0 0 / 0.35);
		--shadow-2: 0 2px 10px rgb(0 0 0 / 0.45);
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
		color: var(--ink);
		font: 14px/1.55 var(--sans);
		overflow: hidden;
		-webkit-font-smoothing: antialiased;
	}
	:global(code) {
		font-family: var(--mono);
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
		font-family: var(--mono);
		font-size: 10.5px;
		font-weight: 500;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--ink-3);
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
		color: var(--ink-2);
		font-size: 13px;
		max-width: 72ch;
		margin: 0 0 14px;
	}
	:global(h2.section) {
		display: flex;
		align-items: center;
		gap: 10px;
		font-family: var(--mono);
		font-size: 11.5px;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--ink-2);
		margin: 34px 0 12px;
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
		border-radius: var(--r);
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
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-3);
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
		border-radius: var(--r);
		box-shadow: var(--shadow-1);
		overflow-x: auto;
	}
	:global(table.data) {
		border-collapse: collapse;
		width: 100%;
		font-size: 13px;
	}
	:global(table.data th) {
		font-family: var(--mono);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		text-align: left;
		color: var(--ink-3);
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
		background: var(--surface-2);
	}
	:global(table.data tbody tr:last-child td) {
		border-bottom: none;
	}
	:global(table.data th.num),
	:global(table.data td.num) {
		text-align: right;
	}
	:global(table.data td.num) {
		font-family: var(--mono);
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
		font-family: var(--mono);
		font-size: 11.5px;
		color: var(--ink-2);
	}

	/* ---------- list pages: /players and /entities ----------
	   One shape for the three. The toolbar and the table header stay put and
	   only the rows scroll, so the table reaches the bottom of the window
	   instead of floating above it, and runs the full width of the content
	   area. The page takes what the shell leaves; anything above the rows (a
	   toolbar, a note) keeps its own height and the rows take the rest. */
	:global(.datapage) {
		display: flex;
		flex-direction: column;
		/* exactly what the shell leaves, and the negative margin gives back the
		   column's bottom padding: the last row ends on the window edge, with
		   no strip of page under it */
		height: calc(100dvh - var(--topbar-h) - var(--content-pad-top, 26px));
		margin-bottom: calc(-1 * var(--content-pad-bottom, 72px));
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
		background: var(--surface-2);
	}
	/* a row's place in the current sort, not an identity: quiet */
	:global(.datapage .rownum) {
		color: var(--ink-3);
	}
	:global(.rowcount) {
		font-family: var(--mono);
		font-size: 11.5px;
		color: var(--ink-3);
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
		color: var(--ink);
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
		font-family: var(--mono);
		font-size: 10px;
		font-weight: 550;
		letter-spacing: 0.04em;
		padding: 2.5px 9px;
		border-radius: 99px;
		white-space: nowrap;
		color: var(--ink-2);
		background: var(--surface-2);
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
		color: var(--ink);
		border: 1px solid var(--border-strong);
		border-radius: var(--r-sm);
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
		color: var(--ink-3);
	}

	:global(.chip) {
		background: var(--surface);
		color: var(--ink-2);
		border: 1px solid var(--border-strong);
		border-radius: 99px;
		font: 500 11.5px/1 var(--mono);
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
		color: var(--on-accent);
		border-color: var(--accent);
	}

	:global(.card) {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--r);
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
		border-radius: var(--r-sm);
		padding: 13px 16px;
		white-space: pre-wrap;
		font: 13px/1.6 var(--sans);
		color: var(--ink-2);
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
	.shell {
		--side-w: var(--rail-w);
		--side-pad-x: 8px;
		--label-display: none;
		--nav-justify: center;
		--nav-pad-x: 0px;
		--nav-pad-y: 5px;
		--label-align: center;
		--foot-dir: row;
		--side-scrollbar: none;
		--side-sb-w: 0px;
		/* with no labels to line up against, the icons take the room back */
		--nav-slot: 28px;
		--nav-glyph: 20px;

		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100dvh;
	}
	/* Expanded, in two halves: wide screens unless you collapsed the nav,
	   narrow screens only while the drawer is open. Keep them in step. */
	@media (min-width: 900px) {
		.shell:not(.nav-closed) {
			--side-w: 240px;
			--side-pad-x: 12px;
			--label-display: block;
			--nav-justify: flex-start;
			--nav-pad-x: 10px;
			--nav-pad-y: 7px;
			--label-align: left;
			--foot-dir: column;
			--side-scrollbar: thin;
			--side-sb-w: 10px;
			--nav-slot: 22px;
			--nav-glyph: 16px;
			/* the button says what it does next: close */
			--burger-turn: 180deg;
			--burger-fold: 6px;
			--burger-cross: 45deg;
			--burger-mid: 0;
		}
	}
	@media (max-width: 899.98px) {
		.shell {
			--content-pad-x: 16px;
		}
		/* --side-w stays the rail: the panel overlays the content, so the
		   gutter under it must not move */
		.shell.nav-open {
			--side-pad-x: 12px;
			--label-display: block;
			--nav-justify: flex-start;
			--nav-pad-x: 10px;
			--nav-pad-y: 7px;
			--label-align: left;
			--foot-dir: column;
			--side-scrollbar: thin;
			--side-sb-w: 10px;
			--nav-slot: 22px;
			--nav-glyph: 16px;
			--burger-turn: 180deg;
			--burger-fold: 6px;
			--burger-cross: 45deg;
			--burger-mid: 0;
		}
	}

	/* one line, always: only the crumb may shrink, everything else is nowrap
	   and flex:none, and the chips go compact before the bar runs out of room */
	.topbar {
		flex: 0 0 var(--topbar-h);
		display: flex;
		align-items: center;
		gap: var(--top-gap);
		padding: 0 var(--top-pad-x);
		background: var(--sidebar);
		color: var(--sidebar-ink);
		border-bottom: 1px solid var(--sidebar-line);
	}
	/* The presence and ready chips (uar-shared) pick their own light/dark
	   tones from prefers-color-scheme, which follows the root's color-scheme —
	   so they turn with the bar they sit on, and need nothing from us. */
	.burger {
		display: grid;
		place-items: center;
		flex: none;
		width: var(--burger-w);
		height: 34px;
		padding: 0;
		background: none;
		color: var(--sidebar-ink);
		border: 1px solid transparent;
		border-radius: var(--r-sm);
		cursor: pointer;
		transition: background 120ms ease, color 120ms ease;
	}
	.burger:hover {
		background: var(--sidebar-2);
		color: var(--sidebar-title);
	}
	/* Closed is the base state written here; the shell overrides these four
	   variables while the nav is open, and the glyph takes the trip between
	   them — the outer bars swing into the cross, the middle one goes, and
	   the mark turns half a revolution on the way. */
	.burger-glyph {
		position: relative;
		width: 20px;
		height: 14px;
		transform: rotate(var(--burger-turn, 0deg));
		transition: transform 260ms cubic-bezier(0.2, 0.7, 0.3, 1);
	}
	.burger-glyph .bar {
		position: absolute;
		left: 0;
		right: 0;
		height: 2px;
		border-radius: 2px;
		background: currentColor;
		transition: transform 260ms cubic-bezier(0.2, 0.7, 0.3, 1), opacity 160ms ease;
	}
	.burger-glyph .bar:nth-child(1) {
		top: 0;
		transform: translateY(var(--burger-fold, 0px)) rotate(var(--burger-cross, 0deg));
	}
	.burger-glyph .bar:nth-child(2) {
		top: 6px;
		opacity: var(--burger-mid, 1);
		transform: scaleX(var(--burger-mid, 1));
	}
	.burger-glyph .bar:nth-child(3) {
		top: 12px;
		transform: translateY(calc(-1 * var(--burger-fold, 0px)))
			rotate(calc(-1 * var(--burger-cross, 0deg)));
	}
	.brand-home {
		display: flex;
		flex: none;
		text-decoration: none;
	}
	.top-right {
		display: flex;
		align-items: center;
		flex: none;
		/* holds the bar's right end even when the crumb is hidden */
		margin-left: auto;
		gap: 10px;
	}
	.brand-mark {
		display: grid;
		place-items: center;
		width: var(--mark-w);
		height: 32px;
		border-radius: var(--r-sm);
		background: var(--accent);
		color: var(--on-accent);
		font: 700 11px/1 var(--mono);
		letter-spacing: 0.03em;
	}
	/* The only elastic item in the bar — and it starts where the page content
	   starts, so the heading sits directly above its own column. What is
	   already spent on the left of it (padding, burger, mark, the gaps) comes
	   off; max() keeps it honest when the rail is narrower than that. */
	.page-crumb {
		display: flex;
		align-items: baseline;
		gap: 7px;
		min-width: 0;
		flex: 1 1 auto;
		margin-left: max(
			0px,
			calc(
				var(--side-w) + var(--content-pad-x) - var(--top-pad-x) - var(--burger-w) -
					var(--mark-w) - var(--top-gap) * 2
			)
		);
		transition: margin-left 180ms ease;
	}
	.crumb-section {
		font-family: var(--mono);
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--sidebar-ink-2);
		white-space: nowrap;
	}
	/* the subject's portrait, level with the heading rather than its baseline */
	.crumb-icon {
		width: 24px;
		height: 24px;
		align-self: center;
		flex: none;
		object-fit: cover;
		border-radius: var(--r-sm);
		border: 1px solid var(--sidebar-line);
	}
	.crumb-icon.round {
		border-radius: 50%;
	}
	/* an <h1> in the bar: the page's one heading, sized like a crumb. The
	   brightest ink the bar has, whichever way the bar goes — a literal white
	   only worked while the bar was always dark. */
	.crumb-title {
		margin: 0;
		font-size: 15.5px;
		font-weight: 650;
		letter-spacing: -0.01em;
		color: var(--sidebar-title);
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
		color: var(--on-accent);
		/* left 0: the portrait end-cap sits on the chip edge;
		   right padding runs under the overlapping cog circle */
		padding: 0 24px 0 0;
		border-radius: 99px 0 0 99px;
		font: 500 12px/1 var(--mono);
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
		background: color-mix(in srgb, var(--on-accent) 18%, var(--mos));
		color: var(--on-accent);
		border: 1px solid color-mix(in srgb, currentColor 40%, transparent);
		border-radius: 50%;
		transition: all 120ms ease;
	}
	.acct-cog:hover,
	.acct-cog.on {
		background: color-mix(in srgb, var(--on-accent) 30%, var(--mos));
	}

	.body {
		flex: 1;
		display: flex;
		min-height: 0;
	}
	/* dims the content behind the open drawer; tapping it closes */
	.scrim {
		position: fixed;
		inset: var(--topbar-h) 0 0 0;
		z-index: var(--z-scrim);
		border: 0;
		padding: 0;
		background: rgb(10 12 8 / 0.5);
		cursor: pointer;
	}

	/* The rail's two scroll hints, registered so they can be transitioned:
	   an unregistered custom property flips from one value to the next with
	   nothing in between, and the edge would blink on. As numbers they
	   interpolate, so the glow arrives and leaves. */
	@property --hint-up {
		syntax: '<number>';
		inherits: false;
		initial-value: 0;
	}
	@property --hint-down {
		syntax: '<number>';
		inherits: false;
		initial-value: 0;
	}
	.sidebar {
		flex: 0 0 var(--side-w);
		display: flex;
		flex-direction: column;
		/* Once the scrollbar is hidden the rail gives no sign that it scrolls,
		   so its edges carry it: a soft highlight pinned to the top and bottom
		   of the box, each shown only while there is more content that way
		   (syncHints sets the two variables from the scroll position). */
		background:
			linear-gradient(
					color-mix(in srgb, var(--accent) calc(var(--hint-up, 0) * 45%), transparent),
					transparent
				)
				scroll top / 100% 16px no-repeat,
			linear-gradient(
					transparent,
					color-mix(in srgb, var(--accent) calc(var(--hint-down, 0) * 45%), transparent)
				)
				scroll bottom / 100% 16px no-repeat,
			var(--sidebar);
		color: var(--sidebar-ink);
		overflow-y: auto;
		/* the labels are clipped by the box as it narrows, so the collapse
		   reads as the words sliding away behind the icons */
		overflow-x: hidden;
		padding: 14px var(--side-pad-x);
		scrollbar-color: var(--sidebar-line) transparent;
		scrollbar-width: var(--side-scrollbar);
		transition: flex-basis 180ms ease, width 180ms ease, padding 180ms ease,
			--hint-up 220ms ease, --hint-down 220ms ease;
	}
	.nav-label,
	.ver-code,
	.mos-name,
	.mos-code,
	.foot-title,
	.foot-note,
	.author-label,
	.gh-label {
		display: var(--label-display);
	}
	/* three characters — the group keeps its heading even in the rail */
	.side-label {
		text-align: var(--label-align);
	}

	nav {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	nav a {
		display: flex;
		align-items: center;
		justify-content: var(--nav-justify);
		gap: 9px;
		font-size: 13px;
		font-weight: 500;
		text-decoration: none;
		color: var(--sidebar-ink);
		padding: var(--nav-pad-y) var(--nav-pad-x);
		border-radius: var(--r-sm);
		/* a row never wraps or reflows mid-animation; it just gets cut off */
		overflow: hidden;
		white-space: nowrap;
		transition: background 120ms ease, color 120ms ease, padding 180ms ease;
	}
	nav a:hover {
		background: var(--sidebar-2);
	}
	nav a.active {
		background: var(--accent);
		color: var(--on-accent);
	}

	/* the slot matches .mos-icon so labels in both nav groups line up */
	.nav-icon {
		display: grid;
		place-items: center;
		width: var(--nav-slot);
		transition: width 180ms ease;
		flex-shrink: 0;
		color: var(--sidebar-ink-2);
		transition: color 120ms ease;
	}
	.nav-icon :global(svg) {
		width: var(--nav-glyph);
		height: var(--nav-glyph);
		transition: width 180ms ease, height 180ms ease;
	}
	nav a:hover .nav-icon {
		color: var(--sidebar-ink);
	}
	nav a.active .nav-icon {
		color: inherit;
	}

	.side-label {
		font-family: var(--mono);
		font-size: 9.5px;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--sidebar-ink-2);
		padding: calc(var(--nav-pad-y) * 2 + 4px) var(--nav-pad-x) 6px;
		transition: padding 180ms ease;
	}
	.mos-nav a {
		padding: calc(var(--nav-pad-y) - 2.5px) var(--nav-pad-x);
		font-weight: 450;
	}
	.mos-icon {
		width: var(--nav-slot);
		height: var(--nav-slot);
		object-fit: cover;
		transition: width 180ms ease, height 180ms ease;
		border-radius: var(--r-sm);
		flex-shrink: 0;
	}
	.mos-icon.placeholder {
		display: inline-block;
		background: var(--sidebar-2);
	}
	.mos-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
	}
	.mos-code {
		font-family: var(--mono);
		font-size: 9.5px;
		color: var(--sidebar-ink-2);
		flex-shrink: 0;
	}
	.mos-nav a.active .mos-code {
		color: color-mix(in srgb, currentColor 75%, transparent);
	}

	.side-foot {
		margin-top: auto;
		padding: calc(var(--nav-pad-y) * 2 + 4px) var(--nav-pad-x) 0;
		font-size: 10.5px;
		color: var(--sidebar-ink-2);
		line-height: 1.5;
	}
	.foot-title {
		display: block;
		font-size: 12px;
		font-weight: 650;
		color: var(--sidebar-ink);
	}
	/* stacked with the words, side by side without them */
	.foot-links {
		display: flex;
		flex-direction: var(--foot-dir);
		align-items: var(--nav-justify);
		justify-content: var(--nav-justify);
		gap: 8px;
		margin-top: 6px;
	}
	.side-foot .author {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--sidebar-ink);
		text-decoration: none;
		font-weight: 550;
		transition: color 120ms ease;
	}
	.cd-mark {
		width: calc(var(--nav-glyph) - 3px);
		height: calc(var(--nav-glyph) - 3px);
		border-radius: 3px;
		flex-shrink: 0;
		transition: width 180ms ease, height 180ms ease;
	}
	.side-foot .author:hover {
		color: var(--accent-hover);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.side-foot .gh {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--sidebar-ink);
		text-decoration: none;
		font-weight: 550;
		transition: color 120ms ease;
	}
	.side-foot .gh:hover {
		color: var(--accent-hover);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.side-foot .gh svg {
		width: calc(var(--nav-glyph) - 3px);
		height: calc(var(--nav-glyph) - 3px);
		transition: width 180ms ease, height 180ms ease;
		fill: currentColor;
		flex-shrink: 0;
	}
	/* changelog row: quiet by default, the version reading like a MOS code */
	.nav-label {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	/* a step below the destinations: it is where the site's news lives, not
	   another place to go */
	.nav-ver {
		margin-top: 5px;
	}
	.ver-code {
		font-family: var(--mono);
		font-size: 9.5px;
		color: var(--sidebar-ink-2);
		flex-shrink: 0;
	}
	.nav-ver.active .ver-code {
		color: color-mix(in srgb, currentColor 75%, transparent);
	}
	/* unread release: a dot on the icon — visible in the rail too, and gone
	   for good once the changelog has been opened */
	.nav-icon {
		position: relative;
	}
	.ver-dot {
		position: absolute;
		top: -1px;
		right: 0;
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 0 2px var(--sidebar);
	}
	nav a:hover .ver-dot {
		box-shadow: 0 0 0 2px var(--sidebar-2);
	}
	/* on the selected row the dot inverts, or it would vanish into the accent */
	nav a.active .ver-dot {
		background: var(--on-accent);
		box-shadow: 0 0 0 2px var(--accent);
	}

	main {
		flex: 1;
		min-width: 0;
		overflow-y: auto;
	}
	.content {
		--content-pad-top: 26px;
		--content-pad-bottom: 72px;
		padding: var(--content-pad-top) var(--content-pad-x) var(--content-pad-bottom);
	}

	/* On a phone every nested box was charging desktop padding: the content
	   column, then the card, then the table cell. Trim the shared ones — the
	   components that use --card-pad-* follow along. */
	@media (max-width: 899.98px) {
		:global(:root) {
			--card-pad-x: 10px;
			--card-pad-y: 10px;
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
		:global(h2.section) {
			margin: 24px 0 10px;
		}
		:global(.quote) {
			padding: 11px 12px;
		}
	}

	/* Narrow: the rail stays put and opening it lays the full panel over the
	   content, so the gutter under it never moves and the page does not
	   reflow behind the drawer. */
	@media (max-width: 899.98px) {
		.body {
			padding-left: var(--rail-w);
		}
		.sidebar {
			position: fixed;
			top: var(--topbar-h);
			bottom: 0;
			left: 0;
			z-index: var(--z-nav);
			width: var(--side-w);
		}
		.shell.nav-open .sidebar {
			width: min(280px, 82vw);
			border-right: 1px solid var(--sidebar-line);
			box-shadow: var(--shadow-2);
		}
		.content {
			--content-pad-top: 16px;
			--content-pad-bottom: 24px;
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

	/* Phone: the bar takes a second row. The burger drops to it and sits in a
	   rail-wide slot — directly above the rail's icons, with the heading
	   starting on the content's own left edge — which leaves the whole first
	   row to the mark and the status chips. */
	@media (max-width: 620px) {
		:global(:root) {
			--topbar-h: 78px;
		}
		.topbar {
			flex-wrap: wrap;
			align-content: center;
			column-gap: 0;
			row-gap: 2px;
			padding: 5px var(--top-pad-x) 5px 0;
		}
		.brand-home {
			order: 1;
			margin-left: var(--top-pad-x);
		}
		.top-right {
			order: 1;
			gap: 8px;
		}
		/* the row break */
		.topbar::after {
			content: '';
			order: 2;
			flex-basis: 100%;
			height: 0;
		}
		.burger {
			order: 3;
			width: var(--rail-w);
		}
		.page-crumb {
			order: 4;
			margin-left: 0;
			padding-left: var(--content-pad-x);
		}
	}
</style>
