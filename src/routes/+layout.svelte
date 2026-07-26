<script lang="ts">
	import '@fontsource-variable/inter';
	import '@fontsource-variable/jetbrains-mono';
	import favicon from '$lib/assets/favicon.svg';
	import anonPortrait from '$lib/assets/anon-portrait.svg';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { mosList, mosById } from '$lib/mos';
	import { latestVersion } from '$lib/changelog';

	let { children } = $props();

	// Feather-style stroke icons, same visual language as the account cog.
	const icon = (paths: string) =>
		`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

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
			href: '/items',
			label: 'Items',
			icon: icon(
				'<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>'
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
		if (p === '/items') return { section: '', title: 'Items & equipment' };
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
			return { section: 'Players', title: pl?.name ?? p.slice(9) };
		}
		if (p === '/map') return { section: '', title: 'Map & missions' };
		if (p === '/flow') return { section: '', title: 'Mission flow' };
		if (p === '/changelog') return { section: '', title: 'Changelog' };
		if (p === '/feedback') return { section: '', title: 'Feedback' };
		if (p === '/account') return { section: '', title: 'Account' };
		if (p.startsWith('/mos/')) {
			const m = mosById.get(decodeURIComponent(p.slice(5)));
			return { section: 'MOS', title: m?.name ?? p.slice(5) };
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
	});

	// Changelog badge: latest released version + a dot when it's new to this visitor.
	const siteVersion = latestVersion(
		Object.keys(import.meta.glob('/changelog/v*/release.json', { eager: true }))
	);
	let newChanges = $state(false);
	$effect(() => {
		if (!siteVersion) return;
		const seen = localStorage.getItem('uar:seen-version');
		if (page.url.pathname === '/changelog' || seen === null) {
			localStorage.setItem('uar:seen-version', siteVersion);
			newChanges = false;
		} else {
			newChanges = seen !== siteVersion;
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="shell">
	<header class="topbar">
		<div class="brand">
			<a class="brand-home" href="/" aria-label="Overview">
				<span class="brand-mark">UAR</span>
			</a>
			<span class="brand-text">
				<a class="brand-title" href="/">Undead Assault Reborn</a>
				{#if siteVersion}
					<a class="brand-sub ver" href="/changelog" title="Changelog">
						{siteVersion}
						{#if newChanges}<span class="ver-dot" aria-hidden="true"></span>{/if}
					</a>
				{:else}
					<span class="brand-sub">Field reference · EU</span>
				{/if}
			</span>
		</div>
		<div class="page-crumb">
			{#if pageTitle.section}<span class="crumb-section">{pageTitle.section} /</span>{/if}
			<span class="crumb-title">{pageTitle.title}</span>
		</div>
		{#if me !== undefined}
			<div class="acct-group">
				{#if me.battletag}
					<a
						class="account-btn"
						class:on={me.toon != null && page.url.pathname === `/players/${me.toon}`}
						href={me.toon ? `/players/${me.toon}` : '/account'}
						title={me.toon ? 'Your player profile' : 'Your Battle.net account'}
					>
						<img class="acct-avatar" src={me.avatar ?? anonPortrait} alt="" />
						{me.battletag}
					</a>
					<a
						class="cog-btn"
						class:on={page.url.pathname === '/account'}
						href="/account"
						aria-label="Account settings"
						title="Account settings"
					>
						<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
							stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<circle cx="12" cy="12" r="3" />
							<path
								d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
							/>
						</svg>
					</a>
				{:else}
					<a
						class="account-btn"
						class:on={page.url.pathname === '/account'}
						href="/account"
						title="Sign in with Battle.net"
					>
						Sign in
					</a>
				{/if}
			</div>
		{/if}
	</header>

	<div class="body">
		<aside class="sidebar">
			<nav aria-label="Main">
				{#each nav as item (item.href)}
					<a href={item.href} class:active={isActive(item.href)}>
						<span class="nav-icon">{@html item.icon}</span>
						{item.label}
					</a>
				{/each}
			</nav>

			<div class="side-label">MOS · Classes</div>
			<nav class="mos-nav" aria-label="MOS classes">
				{#each mosList as m (m.id)}
					<a href="/mos/{m.id}" class:active={page.url.pathname === `/mos/${m.id}`}>
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
				Unofficial fan reference — map by Znimu#743.
				<a class="author" href="https://cedricdessalles.dev" target="_blank" rel="noopener">
					Built by Cédric Dessalles ↗
				</a>
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
	/* ---------- design tokens ---------- */
	:global(:root) {
		--bg: #f1efe8;
		--surface: #faf9f4;
		--surface-2: #eae7dc;
		--sidebar: #23281c;
		--sidebar-2: #2b3122;
		--sidebar-ink: #d8d6c6;
		--sidebar-ink-2: #8f957d;
		--sidebar-line: #3a4130;
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
		--scroll-thumb: #b9b3a0;
		--scroll-thumb-hover: #9b9480;
		--shadow-1: 0 1px 2px rgb(30 32 24 / 0.05), 0 1px 1px rgb(30 32 24 / 0.03);
		--shadow-2: 0 2px 8px rgb(30 32 24 / 0.08), 0 1px 2px rgb(30 32 24 / 0.05);
		--r-sm: 5px;
		--r: 8px;
		--r-lg: 12px;
		--topbar-h: 52px;
		--sans: 'Inter Variable', system-ui, -apple-system, 'Segoe UI', sans-serif;
		--mono: 'JetBrains Mono Variable', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
	}
	@media (prefers-color-scheme: dark) {
		:global(:root) {
			--bg: #14170f;
			--surface: #1b1f16;
			--surface-2: #23281c;
			--sidebar: #101309;
			--sidebar-2: #1a1e12;
			--sidebar-ink: #d3d1bf;
			--sidebar-ink-2: #7c8269;
			--sidebar-line: #262c1c;
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
			--scroll-thumb: #3c4430;
			--scroll-thumb-hover: #4f5940;
			--shadow-1: 0 1px 2px rgb(0 0 0 / 0.35);
			--shadow-2: 0 2px 10px rgb(0 0 0 / 0.45);
		}
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
	.shell {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100dvh;
	}

	.topbar {
		flex: 0 0 var(--topbar-h);
		display: flex;
		align-items: center;
		gap: 18px;
		padding: 0 18px 0 14px;
		background: var(--sidebar);
		color: var(--sidebar-ink);
		border-bottom: 1px solid var(--sidebar-line);
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 226px;
		flex-shrink: 0;
	}
	.brand-home {
		display: flex;
		text-decoration: none;
	}
	.brand-mark {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: var(--r-sm);
		background: var(--accent);
		color: var(--on-accent);
		font: 700 11px/1 var(--mono);
		letter-spacing: 0.03em;
	}
	.brand-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.brand-title {
		font-size: 13px;
		font-weight: 650;
		color: #fff;
		white-space: nowrap;
		text-decoration: none;
	}
	.brand-sub {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		align-self: flex-start;
		font-family: var(--mono);
		font-size: 9px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--sidebar-ink-2);
		text-decoration: none;
	}
	a.brand-sub:hover {
		color: var(--sidebar-ink);
	}
	.page-crumb {
		display: flex;
		align-items: baseline;
		gap: 7px;
		min-width: 0;
		flex: 1;
	}
	.crumb-section {
		font-family: var(--mono);
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--sidebar-ink-2);
		white-space: nowrap;
	}
	.crumb-title {
		font-size: 15.5px;
		font-weight: 650;
		letter-spacing: -0.01em;
		color: #fff;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.acct-group {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.account-btn {
		display: flex;
		align-items: center;
		gap: 7px;
		background: var(--sidebar-2);
		color: var(--sidebar-ink);
		border: 1px solid var(--sidebar-line);
		border-radius: 99px;
		padding: 5px 14px 5px 6px;
		font: 500 12px/1 var(--mono);
		text-decoration: none;
		white-space: nowrap;
		transition: all 120ms ease;
	}
	.account-btn:not(:has(.acct-avatar)) {
		padding-left: 14px;
	}
	.acct-avatar {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		object-fit: cover;
		border: 1px solid var(--sidebar-line);
	}
	.cog-btn {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		flex-shrink: 0;
		background: var(--sidebar-2);
		color: var(--sidebar-ink);
		border: 1px solid var(--sidebar-line);
		border-radius: 99px;
		transition: all 120ms ease;
	}
	.account-btn:hover,
	.account-btn.on,
	.cog-btn:hover,
	.cog-btn.on {
		color: var(--accent-hover);
		border-color: var(--accent);
	}

	.body {
		flex: 1;
		display: flex;
		min-height: 0;
	}

	.sidebar {
		flex: 0 0 240px;
		display: flex;
		flex-direction: column;
		background: var(--sidebar);
		color: var(--sidebar-ink);
		overflow-y: auto;
		padding: 14px 12px;
		scrollbar-color: var(--sidebar-line) transparent;
	}

	nav {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	nav a {
		display: flex;
		align-items: center;
		gap: 9px;
		font-size: 13px;
		font-weight: 500;
		text-decoration: none;
		color: var(--sidebar-ink);
		padding: 7px 10px;
		border-radius: var(--r-sm);
		transition: background 120ms ease, color 120ms ease;
	}
	nav a:hover {
		background: var(--sidebar-2);
	}
	nav a.active {
		background: var(--sidebar-2);
		color: #fff;
		box-shadow: inset 2.5px 0 0 var(--accent);
	}

	/* 22px slot matches .mos-icon so labels in both nav groups line up */
	.nav-icon {
		display: grid;
		place-items: center;
		width: 22px;
		flex-shrink: 0;
		color: var(--sidebar-ink-2);
		transition: color 120ms ease;
	}
	.nav-icon :global(svg) {
		width: 16px;
		height: 16px;
	}
	nav a:hover .nav-icon {
		color: var(--sidebar-ink);
	}
	nav a.active .nav-icon {
		color: var(--accent);
	}

	.side-label {
		font-family: var(--mono);
		font-size: 9.5px;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--sidebar-ink-2);
		padding: 18px 10px 6px;
	}
	.mos-nav a {
		padding: 4.5px 10px;
		font-weight: 450;
	}
	.mos-icon {
		width: 22px;
		height: 22px;
		object-fit: cover;
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
		color: var(--accent);
	}

	.side-foot {
		margin-top: auto;
		padding: 18px 10px 0;
		font-size: 10.5px;
		color: var(--sidebar-ink-2);
		line-height: 1.5;
	}
	.side-foot .author {
		display: block;
		margin-top: 6px;
		color: var(--sidebar-ink);
		text-decoration: none;
		font-weight: 550;
		transition: color 120ms ease;
	}
	.side-foot .author:hover {
		color: var(--accent-hover);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.ver-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--accent);
	}

	main {
		flex: 1;
		min-width: 0;
		overflow-y: auto;
	}
	.content {
		padding: 26px 36px 72px;
	}

	@media (max-width: 820px) {
		:global(body) {
			overflow: auto;
		}
		.shell {
			height: auto;
		}
		.topbar {
			flex-wrap: wrap;
			padding: 10px 14px;
			gap: 10px;
		}
		.page-crumb {
			order: 3;
			flex-basis: 100%;
		}
		.body {
			flex-direction: column;
		}
		.sidebar {
			flex: none;
			max-height: 40dvh;
		}
		main {
			overflow: visible;
		}
		.content {
			padding: 20px 16px 48px;
		}
	}
</style>
