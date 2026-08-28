<script lang="ts">
	/**
	 * The career section's frame: its bar of tabs, and nothing else. A class
	 * page and a profile keep a rail beside their overview; there is no
	 * overview here and no identity to restate, so every tab is the whole of
	 * its column and brings its own <Page>. See $lib/careerTabs.ts for what
	 * the tabs are and why they share a frame.
	 *
	 * The heading is not repeated here: the shell's own crumb reads "Career"
	 * off the route, so it sits in the top bar on every tab, and the tab bar
	 * names the tab.
	 */
	import { goto, preloadData } from '$app/navigation';
	import { page } from '$app/state';
	import { TabBar, TabSwipe } from 'sveltekit-commons';

	import { CAREER_TABS, careerHref, tabSegment } from '$lib/careerTabs';

	let { children } = $props();

	const active = $derived(tabSegment(page.route.id) ?? '');

	const barTabs = CAREER_TABS.map((t) => ({
		href: careerHref(t.segment),
		label: t.label,
		icon: t.icon,
		key: t.segment
	}));
</script>

<!--
	The same move by hand, for the screen the shortcuts cannot reach — see the
	player profile's layout for the reasoning; the settings match it so the
	frames feel like one.
-->
<TabSwipe
	tabs={barTabs}
	{active}
	onnavigate={(to) => void goto(to, { noScroll: true })}
	preload={preloadData}
	middle
/>

<!--
	`shortcuts` is on: this is a reference people browse with a mouse, and
	flipping between the ranks and the SIs they unlock is the repeated action.
	`docked`, and a sibling of the page rather than the first thing inside it,
	for the reason the profile's layout gives.
-->
<TabBar
	docked
	tabs={barTabs}
	{active}
	label="Career sections"
	shortcuts
	gestures="both"
	onnavigate={(to) => void goto(to, { noScroll: true })}
/>

{@render children()}
