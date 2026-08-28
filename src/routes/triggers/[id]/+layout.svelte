<script lang="ts">
	/**
	 * A trigger group's frame: its bar of tabs. The same frame a class page
	 * and a player profile have; see $lib/triggerTabs.ts for what the tabs
	 * are. The group's name and type sit in the top bar's crumb, read off the
	 * route by the shell, so they are not repeated here.
	 */
	import { goto, preloadData } from '$app/navigation';
	import { page } from '$app/state';
	import { TabBar, TabSwipe } from 'sveltekit-commons';
	import { TRIGGER_TABS, triggerHref, tabSegment } from '$lib/triggerTabs';

	let { data, children } = $props();

	const active = $derived(tabSegment(page.route.id) ?? '');
	const barTabs = $derived(
		TRIGGER_TABS.map((t) => ({
			href: triggerHref(data.group.id, t.segment),
			label: t.label,
			icon: t.icon,
			key: t.segment
		}))
	);
</script>

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
	label="{data.group.name} sections"
	shortcuts
	gestures="both"
	onnavigate={(to) => void goto(to, { noScroll: true })}
/>

{@render children()}
