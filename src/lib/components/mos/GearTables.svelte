<script lang="ts">
	/**
	 * Everything a class can carry that is not a weapon, one table per kind —
	 * armor, equipment, consumables and deployables — with the effect each
	 * piece has *on this class* (a mod scoped to other carriers is left out).
	 */
	import { allowedLabel, itemTypeLabels, itemTypeOrder, modsFor, type Item } from '$lib/mos';

	let {
		mosId,
		items
	}: {
		mosId: string;
		/** The class's usable items; weapons and mission props are filtered here. */
		items: Item[];
	} = $props();

	const groups = $derived(
		itemTypeOrder
			.filter((t) => t !== 'weapon' && t !== 'supply')
			.map((t) => ({ type: t, label: itemTypeLabels[t], items: items.filter((i) => i.type === t) }))
			.filter((g) => g.items.length)
	);
</script>

{#each groups as group (group.type)}
	<h2 class="section">{group.label} · {group.items.length}</h2>
	<div class="tablewrap">
		<table class="data items" style="min-width: 640px">
			<thead>
				<tr>
					<th>Item</th>
					<th class="num">Charges</th>
					<th>Effect</th>
					<th>Who can use it</th>
					<th>Conflicts</th>
				</tr>
			</thead>
			<tbody>
				{#each group.items as item (item.id)}
					<tr>
						<td class="namecell">
							{#if item.icon}<img class="row-icon" src={item.icon} alt="" loading="lazy" />{:else}<span
									class="row-icon placeholder"
								></span>{/if}
							{#if item.unit}
								<a href="/entities/{item.unit}">{item.name}</a>
							{:else}
								<span>{item.name}</span>
							{/if}
						</td>
						<td class="num">{item.charges ? `${item.charges.start ?? '?'}/${item.charges.max}` : ''}</td>
						<td class="mono effect">{modsFor(item, mosId).join(', ')}</td>
						<td>
							{#if item.allowed !== null}
								<span class="tag t-mos">{allowedLabel(item)}</span>
							{:else}
								<span class="tag">everyone</span>
							{/if}
						</td>
						<td class="mono effect">{item.conflicts.join(' · ')}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/each}

<style>
	/* the same row-picture rule WeaponTable carries — see the note there */
	table.items {
		--fig: 36px;
		--fig-x: 12px;
	}
	td.namecell {
		position: relative;
		white-space: nowrap;
		padding-left: calc(var(--fig-x) + var(--fig) + 8px);
	}
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
	td.effect {
		overflow-wrap: anywhere;
		min-width: 140px;
	}
	@media (max-width: 899.98px) {
		table.items {
			--fig: 34px;
			--fig-x: 9px;
		}
	}
</style>
