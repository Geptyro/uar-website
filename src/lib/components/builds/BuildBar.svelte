<script lang="ts">
	/**
	 * The bar a guide page gets in place of the class's tab bar: a way back to
	 * the class's builds, the guide's own tabs (View, Comments, and Edit for
	 * its author), and at the far end, where the class bar shows its shortcut
	 * hint, what can be done to the guide. The class's tabs are one click away
	 * through the arrow; on this page the guide is the subject.
	 *
	 * Drawn to the tab bar's own measurements (sveltekit-commons TabBar: the
	 * 36px docked strip, mono uppercase tabs with a Feather icon each, the
	 * inset accent rule under the current one, icons alone below 900px) so the
	 * two bars read as one thing in two states. Copied rather than reused
	 * because that bar has no slot for actions; the day it grows one, this
	 * becomes a call to it.
	 */
	import type { Mos } from '$lib/mos';
	import { buildHref, type BuildStatus } from '$lib/builds';
	import { confirmSubmit } from '$lib/confirm';
	import Confirm from '$lib/components/Confirm.svelte';

	let {
		mos,
		build,
		viewer,
		active
	}: {
		mos: Mos;
		build: { slug: string; title: string; status: BuildStatus; comments?: number };
		viewer: { isAuthor: boolean; admin: boolean };
		/** '' for the view, 'comments', 'edit' for the editor */
		active: string;
	} = $props();

	/* Feather strokes, the sidebar's and the class tabs' own language (see nav.ts) */
	const icon = (paths: string) =>
		`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
	const I = {
		back: icon('<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>'),
		view: icon('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'),
		comments: icon('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
		edit: icon('<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>'),
		export: icon(
			'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'
		),
		publish: icon('<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>'),
		unpublish: icon(
			'<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>'
		),
		hide: icon(
			'<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
		),
		unhide: icon('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'),
		delete: icon(
			'<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>'
		)
	};

	const href = $derived(buildHref(mos.id, build.slug));
	const tabs = $derived([
		{ href, label: 'View', key: '', icon: I.view, count: 0 },
		{ href: `${href}/comments`, label: 'Comments', key: 'comments', icon: I.comments, count: build.comments ?? 0 },
		...(viewer.isAuthor ? [{ href: buildHref(mos.id, build.slug, true), label: 'Edit', key: 'edit', icon: I.edit, count: 0 }] : [])
	]);

	let confirmBox = $state<Confirm>();
	const askDelete = () =>
		confirmBox!.ask({
			title: 'Delete this guide?',
			message: 'For good: its text, its pictures and its comments go with it.',
			yes: 'Delete the guide'
		});
</script>

<nav class="tabs" aria-label="{build.title} sections">
	<a class="back" href="/mos/{mos.id}/guides" title="All {mos.name} guides" aria-label="All {mos.name} guides">
		{@html I.back}
		<span class="label">Guides</span>
	</a>
	{#each tabs as t (t.key)}
		<a
			href={t.href}
			aria-current={t.key === active ? 'page' : undefined}
			aria-label={t.count ? `${t.label} (${t.count})` : t.label}
			title={t.count ? `${t.label} · ${t.count}` : t.label}
		>
			{@html t.icon}
			<span class="label">{t.label}</span>
			{#if t.count}<span class="count">{t.count}</span>{/if}
		</a>
	{/each}
	<span class="controls">
		<a
			class="act"
			href="{href}.json"
			download="{mos.id}-{build.slug}.json"
			data-sveltekit-reload
			title="Save this guide as a JSON document"
			aria-label="Export JSON"
		>
			{@html I.export}<span class="label">Export JSON</span>
		</a>
		{#if viewer.isAuthor}
			{#if build.status === 'draft'}
				<form method="POST" action="{href}?/publish">
					<button class="act primary" title="Publish" aria-label="Publish">{@html I.publish}<span class="label">Publish</span></button>
				</form>
			{:else if build.status === 'published'}
				<form method="POST" action="{href}?/unpublish">
					<button class="act" title="Unpublish: back to a draft" aria-label="Unpublish">{@html I.unpublish}<span class="label">Unpublish</span></button>
				</form>
			{/if}
		{/if}
		{#if viewer.admin}
			{#if build.status === 'hidden'}
				<form method="POST" action="{href}?/unhide">
					<button class="act" title="Unhide" aria-label="Unhide">{@html I.unhide}<span class="label">Unhide</span></button>
				</form>
			{:else}
				<form method="POST" action="{href}?/hide">
					<button class="act" title="Hide from everyone but its author" aria-label="Hide">{@html I.hide}<span class="label">Hide</span></button>
				</form>
			{/if}
		{/if}
		{#if viewer.isAuthor || viewer.admin}
			<form method="POST" action="{href}?/delete" use:confirmSubmit={askDelete}>
				<button class="act danger" title="Delete for good" aria-label="Delete">{@html I.delete}<span class="label">Delete</span></button>
			</form>
		{/if}
	</span>
</nav>
<Confirm bind:this={confirmBox} />

<style>
	/* the tab bar's strip, to the pixel: see sveltekit-commons TabBar */
	.tabs {
		position: static;
		z-index: 20;
		display: flex;
		align-items: stretch;
		gap: var(--space-1);
		height: 36px;
		overflow-x: auto;
		scrollbar-width: none;
		margin: 0;
		padding: 0 var(--content-pad-x, 36px);
		background: var(--surface-sunken);
		border-bottom: var(--border-width) solid var(--border);
	}
	.tabs::-webkit-scrollbar {
		display: none;
	}
	.tabs > a {
		flex: none;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-3);
		color: var(--text-dim);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		text-decoration: none;
		white-space: nowrap;
	}
	.tabs :global(svg) {
		width: 15px;
		height: 15px;
		flex: none;
	}
	.tabs > a:hover {
		color: var(--text);
	}
	.tabs > a[aria-current='page'] {
		box-shadow: inset 0 -2px 0 var(--accent);
		color: var(--text);
	}
	/* how many comments, beside the word; beside the icon alone when the word folds */
	.count {
		min-width: 16px;
		padding: 0 4px;
		border-radius: 99px;
		background: var(--surface-raised);
		border: 1px solid var(--border);
		font-size: 10px;
		line-height: 15px;
		text-align: center;
		letter-spacing: 0;
		color: var(--text-dim);
	}
	a[aria-current='page'] .count {
		border-color: var(--accent);
		color: var(--accent);
	}
	/* the way back stands apart from the tabs: a rule after it, like a crumb's slash */
	.back {
		margin-right: var(--space-2);
		border-right: var(--border-width) solid var(--border);
		padding-right: var(--space-3);
	}

	/* the actions, at the far end where the class bar keeps its hint: the
	   tabs' own type, each with its sign, lit on hover; the one that
	   changes who sees the guide in the accent, the one that ends it in red */
	.controls {
		margin-left: auto;
		align-self: center;
		padding-left: var(--space-3);
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: 2px;
	}
	.controls form {
		display: contents;
	}
	.act {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 26px;
		padding: 0 9px;
		border: 1px solid transparent;
		border-radius: 99px;
		background: none;
		color: var(--text-dim);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		text-decoration: none;
		white-space: nowrap;
		cursor: pointer;
	}
	.act:hover {
		color: var(--text);
		background: var(--surface-raised);
		border-color: var(--border);
	}
	.act.primary {
		color: var(--accent);
		border-color: var(--accent-soft);
		background: var(--accent-soft);
	}
	.act.primary:hover {
		color: var(--accent-contrast);
		background: var(--accent);
		border-color: var(--accent);
	}
	.act.danger:hover {
		color: var(--hostile);
		border-color: var(--hostile);
		background: none;
	}

	/* icons only, at the width where the rest of the chrome folds */
	@media (max-width: 899.98px) {
		.tabs > a {
			justify-content: center;
			gap: 3px;
			padding: 0;
			min-width: 44px;
		}
		.back {
			padding-right: 0;
			margin-right: 0;
		}
		.label {
			display: none;
		}
		.tabs :global(svg) {
			width: 18px;
			height: 18px;
		}
		.act {
			width: 32px;
			padding: 0;
			justify-content: center;
		}
		.act :global(svg) {
			width: 16px;
			height: 16px;
		}
	}
</style>
