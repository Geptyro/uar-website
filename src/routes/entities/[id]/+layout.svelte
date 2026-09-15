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
	import { holdData } from '$lib/heldData';

	let { data, children } = $props();
	// the next route's data can reach this before it unmounts: read the last own one ($lib/heldData)
	const hold = holdData((d: typeof data) => !!d.unit);
	const view = $derived(hold(data));

	const active = $derived(entityTabSegment(page.route.id) ?? '');
	const barTabs = $derived(
		ENTITY_TABS.map((t) => ({
			href: entityHref(view.unit.id, t.segment),
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
	label="{displayName(view.unit.name) || view.unit.id} sections"
	shortcuts
	gestures="both"
	onnavigate={(to) => void goto(to, { noScroll: true })}
/>

{@render children()}
