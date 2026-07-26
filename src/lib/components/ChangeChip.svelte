<script lang="ts">
	import type { EntryType } from '$lib/changelog';

	let { type }: { type: EntryType } = $props();
</script>

<span class="chip {type}">{type}</span>

<style>
	.chip {
		flex-shrink: 0;
		font-family: var(--mono);
		font-size: 10px;
		font-weight: 650;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 2px 7px;
		border-radius: 999px;
	}
	.chip.feature {
		background: var(--accent-soft);
		color: var(--accent);
	}
	.chip.improvement {
		background: var(--mos-soft);
		color: var(--mos);
	}
	.chip.fix {
		background: var(--hostile-soft);
		color: var(--hostile);
	}
	.chip.data {
		background: var(--item-soft);
		color: var(--item);
	}
</style>
