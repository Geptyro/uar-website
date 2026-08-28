<script lang="ts">
	/**
	 * An entity page's frame: its bar of tabs (the sheet, and the comments),
	 * the same bar a class page and a profile have, for the same reasons; see
	 * those layouts for the settings. The name and the portrait are the
	 * shell's crumb, read off the route, so nothing is repeated here.
	 */
	import { goto, preloadData } from '$app/navigation';
	import { page } from '$app/state';
	import { TabBar, TabSwipe } from 'sveltekit-commons';
	import { ENTITY_TABS, entityHref, entityTabSegment } from '$lib/entityTabs';
	import { displayName } from '$lib/ogcard';

	let { data, children } = $props();

	const active = $derived(entityTabSegment(page.route.id) ?? '');
	const barTabs = $derived(
		ENTITY_TABS.map((t) => ({
			href: entityHref(data.unit.id, t.segment),
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
	label="{displayName(data.unit.name) || data.unit.id} sections"
	shortcuts
	gestures="both"
	onnavigate={(to) => void goto(to, { noScroll: true })}
/>

{@render children()}
