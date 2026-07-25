<script module lang="ts">
	import type { StatIconName } from './StatIcon.svelte';

	export type Fact = {
		icon: StatIconName;
		label: string;
		value: string | number;
		/** render the value small + mono (ids, source lists) */
		mono?: boolean;
	};
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import StatIcon from './StatIcon.svelte';

	let {
		portrait = null,
		title,
		chip = null,
		facts,
		link = null,
		tags = null
	}: {
		portrait?: string | null;
		title: string;
		chip?: string | null;
		facts: Fact[];
		link?: { href: string; label: string } | null;
		/** optional tag row rendered under the title (parent-scoped markup) */
		tags?: Snippet | null;
	} = $props();
</script>

<div class="card box">
	{#if portrait}
		<img class="portrait" src={portrait} alt="{title} portrait" />
	{/if}
	<div class="box-title">
		<b>{title}</b>
		{#if chip}<span>{chip}</span>{/if}
	</div>
	{#if tags}
		<div class="box-tags">{@render tags()}</div>
	{/if}
	<dl class="facts">
		{#each facts as f (f.label)}
			<dt><StatIcon name={f.icon} />{f.label}</dt>
			<dd class:small={f.mono}>{f.value}</dd>
		{/each}
	</dl>
	{#if link}
		<a class="unit-link" href={link.href}>{link.label}</a>
	{:else}
		<div class="box-pad"></div>
	{/if}
</div>

<style>
	.box {
		padding: 0;
		overflow: hidden;
	}
	.portrait {
		display: block;
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
	}
	.box-title {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
		padding: 12px 14px 4px;
	}
	.box-title b {
		font-size: 15px;
		font-weight: 650;
		letter-spacing: -0.01em;
	}
	.box-title span {
		font-family: var(--mono);
		font-size: 10px;
		color: var(--mos);
		letter-spacing: 0.06em;
		overflow-wrap: anywhere;
	}
	.box-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 4px 14px 0;
	}
	.facts {
		margin: 8px 0 0;
		padding: 0 14px;
	}
	.facts dt {
		float: left;
		clear: left;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-3);
		line-height: 2.1;
	}
	.facts dd {
		margin: 0;
		text-align: right;
		font-variant-numeric: tabular-nums;
		font-size: 13px;
		font-weight: 550;
		line-height: 2.1;
		border-bottom: 1px solid var(--border);
	}
	.facts dd:last-of-type {
		border-bottom: none;
	}
	.facts dd.small {
		font-family: var(--mono);
		font-size: 11px;
		color: var(--ink-2);
	}
	.unit-link {
		display: block;
		text-align: center;
		font-family: var(--mono);
		font-size: 11px;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		text-decoration: none;
		color: var(--ink-2);
		border-top: 1px solid var(--border);
		padding: 10px 12px;
		margin-top: 10px;
		transition: all 120ms ease;
	}
	.unit-link:hover {
		color: var(--accent);
		background: var(--surface-2);
	}
	.box-pad {
		height: 12px;
	}

	@media (max-width: 1080px) {
		.portrait {
			aspect-ratio: auto;
			max-height: 220px;
		}
	}
</style>
