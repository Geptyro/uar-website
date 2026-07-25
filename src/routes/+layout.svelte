<script lang="ts">
	import '@fontsource-variable/inter';
	import '@fontsource-variable/jetbrains-mono';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { mosList, mosById } from '$lib/mos';

	let { children } = $props();

	const nav = [
		{ href: '/', label: 'Overview' },
		{ href: '/entities', label: 'Entities' },
		{ href: '/items', label: 'Items' },
		{ href: '/si', label: 'Skill IDs' },
		{ href: '/ranks', label: 'Ranks' },
		{ href: '/players', label: 'Players' },
		{ href: '/map', label: 'Map & missions' },
		{ href: '/flow', label: 'Mission flow' }
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
		if (p === '/players') return { section: '', title: 'Players' };
		if (p === '/map') return { section: '', title: 'Map & missions' };
		if (p === '/flow') return { section: '', title: 'Mission flow' };
		if (p.startsWith('/mos/')) {
			const m = mosById.get(decodeURIComponent(p.slice(5)));
			return { section: 'MOS', title: m?.name ?? p.slice(5) };
		}
		return { section: '', title: '' };
	});

	// theme toggle: auto -> light -> dark
	let theme = $state<'auto' | 'light' | 'dark'>('auto');
	$effect(() => {
		if (!browser) return;
		const saved = localStorage.getItem('theme');
		if (saved === 'light' || saved === 'dark') theme = saved;
	});
	function cycleTheme() {
		theme = theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto';
		if (theme === 'auto') {
			delete document.documentElement.dataset.theme;
			localStorage.removeItem('theme');
		} else {
			document.documentElement.dataset.theme = theme;
			localStorage.setItem('theme', theme);
		}
	}
	const themeIcon = $derived(theme === 'light' ? '☀' : theme === 'dark' ? '☾' : '◐');

	let quick = $state('');
	function quickSearch(e: SubmitEvent) {
		e.preventDefault();
		const q = quick.trim();
		goto(q ? `/entities?q=${encodeURIComponent(q)}` : '/entities');
		quick = '';
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="shell">
	<header class="topbar">
		<a class="brand" href="/">
			<span class="brand-mark">UAR</span>
			<span class="brand-text">
				<span class="brand-title">Undead Assault Reborn</span>
				<span class="brand-sub">Field reference · EU</span>
			</span>
		</a>
		<div class="page-crumb">
			{#if pageTitle.section}<span class="crumb-section">{pageTitle.section} /</span>{/if}
			<span class="crumb-title">{pageTitle.title}</span>
		</div>
		<form class="quick" onsubmit={quickSearch}>
			<input
				type="search"
				placeholder="Quick search entities…"
				aria-label="Quick search entities"
				bind:value={quick}
			/>
		</form>
		<button
			class="theme-btn"
			onclick={cycleTheme}
			title="Theme: {theme}"
			aria-label="Cycle theme (current: {theme})"
		>
			{themeIcon}
			<span class="theme-label">{theme}</span>
		</button>
	</header>

	<div class="body">
		<aside class="sidebar">
			<nav aria-label="Main">
				{#each nav as item (item.href)}
					<a href={item.href} class:active={isActive(item.href)}>{item.label}</a>
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
	/* explicit user choice via the top-bar toggle overrides the OS preference */
	:global(:root[data-theme='light']) {
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
		--on-accent: #fff;
		--mos: #3d6483;
		--hostile: #a84632;
		--item: #91702c;
		--scroll-thumb: #b9b3a0;
		--scroll-thumb-hover: #9b9480;
		--shadow-1: 0 1px 2px rgb(30 32 24 / 0.05), 0 1px 1px rgb(30 32 24 / 0.03);
		--shadow-2: 0 2px 8px rgb(30 32 24 / 0.08), 0 1px 2px rgb(30 32 24 / 0.05);
	}
	:global(:root[data-theme='dark']) {
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
		text-decoration: none;
		width: 226px;
		flex-shrink: 0;
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
	}
	.brand-sub {
		font-family: var(--mono);
		font-size: 9px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--sidebar-ink-2);
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
	.quick input {
		width: 190px;
		padding: 5px 11px;
		font-size: 12.5px;
		background: var(--sidebar-2);
		border-color: var(--sidebar-line);
		color: var(--sidebar-ink);
	}
	.quick input:focus {
		width: 250px;
	}
	.theme-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		background: var(--sidebar-2);
		color: var(--sidebar-ink);
		border: 1px solid var(--sidebar-line);
		border-radius: 99px;
		padding: 5px 12px;
		font: 500 12px/1 var(--mono);
		cursor: pointer;
		transition: all 120ms ease;
	}
	.theme-btn:hover {
		color: var(--accent-hover);
		border-color: var(--accent);
	}
	.theme-label {
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-size: 10px;
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
