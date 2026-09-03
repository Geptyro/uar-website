<script lang="ts">
	/**
	 * A class page's frame: its bar of tabs, and — on the overview alone — the
	 * rail with the identity card. The same frame a player profile has, for
	 * the same reasons; see $lib/mosTabs.ts for what the tabs are and why.
	 *
	 * The name and the portrait are not repeated here: the shell's own crumb
	 * reads them off the route, so they sit in the top bar on every tab.
	 *
	 * The rail stands beside the overview and nowhere else. The gear tab is
	 * four wide tables that want the full column, the players tab a board, the
	 * guide a map beside a list, and the vehicle tab is a class page of its own
	 * with its own rail — on none of them is a restatement of the pilot's life
	 * and armour what the reader came for. The abilities are the overview's
	 * own, laid out in full in its main column; the rail keeps to the facts —
	 * identity, unlock, handling, model, description, SIs.
	 */
	import { goto, preloadData } from '$app/navigation';
	import { page } from '$app/state';
	import { Page, TabBar, TabSwipe } from 'sveltekit-commons';

	import { mosTabHref, tabSegment } from '$lib/mosTabs';
	import MosInfobox from '$lib/components/mos/MosInfobox.svelte';
	import ClassFrame from '$lib/components/mos/ClassFrame.svelte';
	import BuildBar from '$lib/components/builds/BuildBar.svelte';
	import type { BuildStatus } from '$lib/builds';

	let { data, children } = $props();

	const mos = $derived(data.mos);
	// mission items (supply) are objective props, not class gear — keep them off class pages
	const usableCount = $derived(data.items.filter((i) => i.type !== 'supply').length);

	const active = $derived(tabSegment(page.route.id, page.params) ?? '');
	const onOverview = $derived(active === '');

	/* A guide page is below the class: its own bar (a way back, View, Edit,
	   the actions) stands in for the class's tabs there. The guide itself is
	   the guide layout's data, which this layout sees through the page. */
	const onBuild = $derived(page.route.id?.startsWith('/mos/[id]/guides/[slug]') ?? false);
	const buildData = $derived(
		page.data as {
			build?: { slug: string; title: string; status: BuildStatus; comments?: number };
			viewer?: { isAuthor: boolean; admin: boolean };
		}
	);

	const barTabs = $derived(
		data.tabs.map((t) => ({
			href: mosTabHref(mos.id, t.segment),
			label: t.label,
			icon: t.icon,
			key: t.segment
		}))
	);
</script>

<!--
	The same move by hand, for the screen the shortcuts cannot reach — see the
	player profile's layout for the reasoning; the settings match it so the two
	frames feel like one.
-->
{#if onBuild && buildData.build && buildData.viewer}
	<BuildBar
		{mos}
		build={buildData.build}
		viewer={buildData.viewer}
		active={page.route.id?.endsWith('/edit') ? 'edit' : page.route.id?.endsWith('/comments') ? 'comments' : ''}
	/>
{:else}
	<TabSwipe
		tabs={barTabs}
		{active}
		onnavigate={(to) => void goto(to, { noScroll: true })}
		preload={preloadData}
		middle
	/>

	<TabBar
		docked
		tabs={barTabs}
		{active}
		label="{mos.name} sections"
		shortcuts
		gestures="both"
		onnavigate={(to) => void goto(to, { noScroll: true })}
	/>
{/if}

{#if onOverview}
	<Page>
		<ClassFrame>
			{@render children()}
			{#snippet rail()}
				<MosInfobox {mos} si={data.si} {usableCount} abilities={false} />
			{/snippet}
		</ClassFrame>
	</Page>
{:else}
	{@render children()}
{/if}
