<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { mosList } from '$lib/mos';

	let { children } = $props();

	const nav = [
		{ href: '/', label: 'Overview' },
		{ href: '/units', label: 'Units' },
		{ href: '/items', label: 'Items' }
	];

	function isActive(href: string): boolean {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname === href || page.url.pathname.startsWith(href + '/');
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="shell">
	<aside class="sidebar">
		<a class="brand" href="/">
			<span class="brand-eyebrow">Field reference · EU</span>
			<span class="brand-title">Undead Assault<br />Reborn</span>
		</a>

		<nav aria-label="Main">
			{#each nav as item (item.href)}
				<a href={item.href} class:active={isActive(item.href)}>{item.label}</a>
			{/each}
		</nav>

		<div class="side-label">MOS — Classes</div>
		<nav class="mos-nav" aria-label="MOS classes">
			{#each mosList as m (m.id)}
				<a href="/mos/{m.id}" class:active={page.url.pathname === `/mos/${m.id}`}>
					<span class="mos-name">{m.name}</span>
					{#if m.mos}<span class="mos-code">{m.mos}</span>{/if}
				</a>
			{/each}
		</nav>

		<div class="side-foot">
			Unofficial fan reference.<br />Map by Znimu#743.
		</div>
	</aside>

	<main>
		<div class="content">
			{@render children()}
		</div>
	</main>
</div>

<style>
	:global(:root) {
		--paper: #edeade;
		--panel: #e3dfcf;
		--side: #e0dbc8;
		--ink: #23281c;
		--ink-soft: #5a6050;
		--line: #c8c2ab;
		--accent: #4d6b34;
		--accent-ink: #fff;
		--hostile: #a03c28;
		--mos: #37556e;
		--item: #8a6d2f;
		--chip-bg: #dcd7c2;
		--mono: ui-monospace, 'Cascadia Code', 'JetBrains Mono', Menlo, Consolas, monospace;
	}
	@media (prefers-color-scheme: dark) {
		:global(:root) {
			--paper: #181b14;
			--panel: #20241a;
			--side: #14170f;
			--ink: #dcd9c8;
			--ink-soft: #8f957f;
			--line: #363b2c;
			--accent: #7fa35c;
			--accent-ink: #141710;
			--hostile: #d06a52;
			--mos: #7ba3c4;
			--item: #c2a35a;
			--chip-bg: #2a2f21;
		}
	}

	:global(*) {
		box-sizing: border-box;
	}
	:global(html),
	:global(body) {
		height: 100%;
	}
	:global(body) {
		margin: 0;
		background: var(--paper);
		color: var(--ink);
		font: 15px/1.5 system-ui, sans-serif;
		overflow: hidden;
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
		outline-offset: 1px;
	}

	.shell {
		display: flex;
		width: 100%;
		height: 100dvh;
	}

	.sidebar {
		flex: 0 0 232px;
		display: flex;
		flex-direction: column;
		background: var(--side);
		border-right: 2px solid var(--ink);
		overflow-y: auto;
		padding: 18px 0 14px;
	}
	.brand {
		text-decoration: none;
		padding: 0 18px 14px;
		border-bottom: 1px solid var(--line);
	}
	.brand-eyebrow {
		display: block;
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--ink-soft);
	}
	.brand-title {
		display: block;
		font-size: 17px;
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		line-height: 1.25;
		margin-top: 3px;
	}

	nav {
		display: flex;
		flex-direction: column;
		padding: 10px 10px 0;
	}
	nav a {
		font-family: var(--mono);
		font-size: 12px;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		text-decoration: none;
		padding: 7px 9px;
		border-left: 3px solid transparent;
	}
	nav a:hover {
		background: var(--chip-bg);
	}
	nav a.active {
		border-left-color: var(--accent);
		background: var(--chip-bg);
		color: var(--accent);
	}

	.side-label {
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--ink-soft);
		padding: 18px 19px 4px;
		border-bottom: 1px solid var(--line);
		margin: 0 0 4px;
	}
	.mos-nav {
		padding-top: 2px;
	}
	.mos-nav a {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
		text-transform: none;
		letter-spacing: 0;
		font-family: inherit;
		font-size: 13px;
		padding: 4px 9px;
	}
	.mos-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.mos-code {
		font-family: var(--mono);
		font-size: 10px;
		color: var(--ink-soft);
		flex-shrink: 0;
	}
	.mos-nav a.active .mos-code {
		color: var(--accent);
	}

	.side-foot {
		margin-top: auto;
		padding: 16px 18px 0;
		font-size: 11px;
		color: var(--ink-soft);
		line-height: 1.5;
	}

	main {
		flex: 1;
		min-width: 0;
		overflow-y: auto;
	}
	.content {
		padding: 26px 30px 60px;
		max-width: 1280px;
	}

	@media (max-width: 820px) {
		:global(body) {
			overflow: auto;
		}
		.shell {
			flex-direction: column;
			height: auto;
		}
		.sidebar {
			flex: none;
			border-right: none;
			border-bottom: 2px solid var(--ink);
			max-height: 45dvh;
		}
		main {
			overflow: visible;
		}
		.content {
			padding: 20px 16px 48px;
		}
	}
</style>
