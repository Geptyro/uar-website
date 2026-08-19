<script lang="ts">
	/**
	 * A class's weapons in one table: what it is issued, and what it can pick
	 * up. Either half may be empty — the overview passes only the issued
	 * weapons and the gear tab only the items — and the Source column exists
	 * only while there is more than one kind of row to tell apart.
	 *
	 * An item's card is its entity page; the handful that have no entity of
	 * their own (mission props) are named but not linked.
	 */
	import { allowedLabel, modsFor, type Item } from '$lib/mos';
	import { applyText, type Weapon } from '$lib/units';

	let {
		mosId,
		weapons = [],
		items = []
	}: {
		mosId: string;
		/** Standard-issue weapons, from the unit's own weapon array. */
		weapons?: Weapon[];
		/** Weapon items the class can use — granting rows and buff-type ones. */
		items?: Item[];
	} = $props();

	function dps(dmg: number | null, period: number | null): string {
		return dmg && period ? String(Math.round(dmg / period)) : '?';
	}

	function itemNote(item: Item): string {
		const parts = modsFor(item, mosId);
		if (item.allowed !== null) {
			const label = allowedLabel(item);
			if (label && item.allowed.length > 1) parts.push(label);
		}
		return parts.join(' · ');
	}

	const kinds = $derived(
		new Set([
			...(weapons.length ? ['issue'] : []),
			...items.map((i) => (i.grants.length ? 'item' : 'buff'))
		])
	);
	const showSource = $derived(kinds.size > 1);
	const cols = $derived(showSource ? 7 : 6);
</script>

{#snippet itemName(item: Item)}
	{#if item.unit}
		<a href="/entities/{item.unit}">{item.name}</a>
	{:else}
		<span>{item.name}</span>
	{/if}
{/snippet}

{#snippet itemCell(item: Item)}
	<td class="wname namecell">
		{#if item.icon}<img class="row-icon" src={item.icon} alt="" loading="lazy" />{:else}<span
				class="row-icon placeholder"
			></span>{/if}
		{@render itemName(item)}
	</td>
{/snippet}

<div class="tablewrap">
	<table class="data items" style="min-width: {showSource ? 660 : 580}px">
		<thead>
			<tr>
				<th>Weapon</th>
				{#if showSource}<th>Source</th>{/if}
				<th class="num">Damage</th>
				<th class="num">Range</th>
				<th class="num">Period (s)</th>
				<th class="num">DPS</th>
				<th>Notes</th>
			</tr>
		</thead>
		<tbody>
			{#each weapons as w (w.id)}
				<tr>
					<td class="wname">{w.id}</td>
					{#if showSource}<td><span class="tag">standard issue</span></td>{/if}
					<td class="num">{w.dmg ?? '?'}</td>
					<td class="num">{w.range ?? '?'}</td>
					<td class="num">{w.period ?? '?'}</td>
					<td class="num">{dps(w.dmg, w.period)}</td>
					<td class="mono notes">{(w.applies ?? []).map(applyText).join(' · ')}</td>
				</tr>
			{/each}
			{#each items as item (item.id)}
				{#if item.grants.length}
					{#each item.grants as g (g.id)}
						<tr>
							{@render itemCell(item)}
							{#if showSource}<td><span class="tag t-item">item</span></td>{/if}
							<td class="num">{g.dmg ?? '?'}</td>
							<td class="num">{g.range ?? '?'}</td>
							<td class="num">{g.period ?? '?'}</td>
							<td class="num">{dps(g.dmg, g.period)}</td>
							<td class="mono notes"
								>{[itemNote(item), ...(g.applies ?? []).map(applyText)]
									.filter(Boolean)
									.join(' · ')}</td
							>
						</tr>
					{/each}
				{:else}
					<tr>
						{@render itemCell(item)}
						{#if showSource}<td><span class="tag t-item">weapon buff</span></td>{/if}
						<td class="num" colspan={cols - 3}></td>
						<td class="mono notes">{itemNote(item)}</td>
					</tr>
				{/if}
			{/each}
		</tbody>
	</table>
</div>

<style>
	.wname {
		font-weight: 550;
	}
	td.notes {
		max-width: 240px;
		overflow-wrap: anywhere;
	}

	/* The item's picture is drawn to the row, the way the boards draw a
	   portrait: pinned to the cell so a row whose effect text wraps keeps the
	   height that text gives it, with the cell handing the width back as
	   padding. GearTables carries the same rule, so the two read as one. */
	table.items {
		--fig: 36px;
		--fig-x: 12px;
	}
	td.namecell {
		position: relative;
		white-space: nowrap;
		padding-left: calc(var(--fig-x) + var(--fig) + 8px);
	}
	/* --fig is a shade taller than a one-line row, so an ordinary row is filled
	   top to bottom and the cap never bites. It bites on the rows whose effect
	   text runs to three lines: there the picture stays square beside the name
	   it belongs to instead of being stretched into a stripe. */
	.row-icon {
		position: absolute;
		left: var(--fig-x);
		top: 0;
		height: 100%;
		max-height: var(--fig);
		width: var(--fig);
		object-fit: cover;
		border-radius: 4px;
	}
	.row-icon.placeholder {
		background: var(--surface-raised);
	}
	@media (max-width: 899.98px) {
		/* the picture follows the cell's own inset in, and the row is a little
		   shorter here, so the cap comes down with it */
		table.items {
			--fig: 34px;
			--fig-x: 9px;
		}
	}
</style>
