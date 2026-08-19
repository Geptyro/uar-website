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
	 * and armour what the reader came for. The abilities and the handling
	 * cards are the overview's own, in its main column, so the rail keeps to
	 * the facts: identity, unlock, model, description, SIs.
	 */
	import { goto, preloadData } from '$app/navigation';
	import { page } from '$app/state';
	import { Page, TabBar, TabSwipe } from 'sveltekit-commons';

	import { mosTabHref, tabSegment } from '$lib/mosTabs';
	import MosInfobox from '$lib/components/mos/MosInfobox.svelte';
	import ClassFrame from '$lib/components/mos/ClassFrame.svelte';

	let { data, children } = $props();

	const mos = $derived(data.mos);
	// mission items (supply) are objective props, not class gear — keep them off class pages
	const usableCount = $derived(data.items.filter((i) => i.type !== 'supply').length);

	const active = $derived(tabSegment(page.route.id, page.params) ?? '');
	const onOverview = $derived(active === '');

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

{#if onOverview}
	<Page>
		<ClassFrame>
			{@render children()}
			{#snippet rail()}
				<MosInfobox {mos} si={data.si} {usableCount} abilities={false} handling={false} />
			{/snippet}
		</ClassFrame>
	</Page>
{:else}
	{@render children()}
{/if}
