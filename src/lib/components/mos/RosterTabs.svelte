<script lang="ts">
	/**
	 * The bar over the two roster tables at /mos. Both pages render it rather
	 * than a shared +layout, because a layout under /mos would also wrap every
	 * class page, which has a tab bar of its own.
	 */
	import { goto, preloadData } from '$app/navigation';
	import { TabBar, TabSwipe } from 'sveltekit-commons';

	import { MOS_VIEWS, mosViewHref } from '$lib/mosViews';

	let { active = '' }: { active?: string } = $props();

	const tabs = MOS_VIEWS.map((v) => ({
		href: mosViewHref(v.key),
		label: v.label,
		icon: v.icon,
		key: v.key
	}));

	const navigate = (to: string) => void goto(to, { noScroll: true });
</script>

<!--
	The same move by hand, for the screen the shortcuts cannot reach — the
	career section's frame does this too, and the settings match so the two
	bars feel like one thing.
-->
<TabSwipe {tabs} {active} onnavigate={navigate} preload={preloadData} middle />

<!--
	`shortcuts` is on for the reason the career bar has them: this is a
	reference browsed with a mouse, and flipping between what a class costs and
	what it does is the repeated move.
-->
<TabBar
	docked
	{tabs}
	{active}
	label="Class comparisons"
	shortcuts
	gestures="both"
	onnavigate={navigate}
/>
