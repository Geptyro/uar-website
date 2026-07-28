<script lang="ts">
	import { mosList } from '$lib/mos';
	import { jamRangeFor, mechanicsFor, shotsPerJam } from '$lib/mechanics';
	import Seo from '$lib/components/Seo.svelte';

	type Row = {
		id: string;
		name: string;
		role: string;
		icon: string | null;
		mag: number | null;
		reload: number | null;
		/** worst-case per-shot jam chance; null when the class cannot jam */
		jam: number | null;
		panel: number;
	};

	const rows: Row[] = mosList.map((m) => {
		const mech = mechanicsFor(m.id);
		return {
			id: m.id,
			name: m.name,
			role: m.role,
			icon: m.icon,
			mag: mech?.ammo.mag ?? null,
			reload: mech?.ammo.reload ?? null,
			jam: jamRangeFor(m.id)?.max ?? null,
			panel: mech?.panel.length ?? 0
		};
	});

	type Col = {
		key: string;
		label: string;
		num?: boolean;
		value: (r: Row) => number | string | null;
	};
	const columns: Col[] = [
		{ key: 'name', label: 'Class', value: (r) => r.name },
		{ key: 'mag', label: 'Magazine', num: true, value: (r) => r.mag },
		{ key: 'reload', label: 'Reload (s)', num: true, value: (r) => r.reload },
		{ key: 'jam', label: 'Jam risk per shot', num: true, value: (r) => r.jam },
		{ key: 'panel', label: 'Panel keys', num: true, value: (r) => r.panel }
	];

	let sortKey = $state('jam');
	let sortDir = $state(-1);

	function setSort(key: string) {
		if (sortKey === key) sortDir *= -1;
		else {
			sortKey = key;
			sortDir = key === 'name' ? 1 : -1;
		}
	}

	const sorted = $derived.by(() => {
		const col = columns.find((c) => c.key === sortKey) ?? columns[0];
		const out = [...rows];
		out.sort((a, b) => {
			const x = col.value(a);
			const y = col.value(b);
			// classes with no value for this column sort last, whichever way it points
			if (x === null && y === null) return a.name.localeCompare(b.name);
			if (x === null) return 1;
			if (y === null) return -1;
			const cmp = typeof x === 'number' ? x - (y as number) : String(x).localeCompare(String(y));
			return cmp * sortDir || a.name.localeCompare(b.name);
		});
		return out;
	});

	// bars share one scale per column so lengths are comparable down the table
	const max = $derived({
		mag: Math.max(...rows.map((r) => r.mag ?? 0)),
		reload: Math.max(...rows.map((r) => r.reload ?? 0)),
		jam: Math.max(...rows.map((r) => r.jam ?? 0)),
		panel: Math.max(...rows.map((r) => r.panel))
	});

	/** several classes carry a "role" that is just their name respaced — not worth showing twice */
	const sameAsName = (role: string, name: string) =>
		!role || role.replace(/\s+/g, '').toLowerCase() === name.replace(/\s+/g, '').toLowerCase();

	const n = (v: number) => Math.round(v).toLocaleString('en-US');
	const pct = (v: number | null, m: number) => (v && m ? (100 * v) / m : 0);
</script>

<Seo
	title="Classes compared — MOS"
	description="Weapon handling across every player class in Undead Assault Reborn: magazine size, reload, worst-case jam risk per shot and panel count, from the map script."
/>

<h2 class="section">Classes compared</h2>
<p class="note">
	Weapon handling across all {rows.length} classes, from the map's trigger script. Jam risk is the worst-case
	chance that any single shot jams — it is set by the magazine size the class spawns with, so small-magazine
	classes jam far more often per shot. Click a column to sort.
</p>

<div class="tablewrap">
	<table class="data" style="min-width: 720px">
		<thead>
			<tr>
				{#each columns as col (col.key)}
					<th class:num={col.num} class="sortable" onclick={() => setSort(col.key)}>
						{col.label}
						<span class="dir">{sortKey === col.key ? (sortDir > 0 ? '↑' : '↓') : ''}</span>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each sorted as r (r.id)}
				<tr>
					<td class="namecell">
						{#if r.icon}<img class="row-icon" src={r.icon} alt="" loading="lazy" />{/if}
						<a href="/mos/{r.id}">{r.name}</a>
						{#if !sameAsName(r.role, r.name)}<span class="role">{r.role}</span>{/if}
					</td>

					<td class="num barcell">
						{#if r.mag}
							<span class="v">{r.mag}</span>
							<span class="bar"><span class="fill" style="width: {pct(r.mag, max.mag)}%"></span></span>
						{:else}
							<span class="v none" title="Burns fuel instead of magazines">fuel</span>
						{/if}
					</td>

					<td class="num barcell">
						{#if r.reload}
							<span class="v">{+r.reload.toFixed(2)}</span>
							<span class="bar"
								><span class="fill" style="width: {pct(r.reload, max.reload)}%"></span></span
							>
						{:else}
							<span class="v none">—</span>
						{/if}
					</td>

					<td class="num barcell">
						{#if r.jam}
							<span class="v">1 in {n(shotsPerJam(r.jam))}</span>
							<span class="bar"
								><span class="fill risk" style="width: {pct(r.jam, max.jam)}%"></span></span
							>
						{:else}
							<span class="v none" title="This class can never jam">never</span>
						{/if}
					</td>

					<td class="num">{r.panel || ''}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<p class="note foot">
	A longer bar means a higher chance per shot, so jams arrive after fewer shots. Because the roll
	scales with magazine size, every class averages roughly one jam per six magazines — a small
	magazine just reaches that point sooner. Reload time dominates actual downtime either way.
</p>

<style>
	th.sortable {
		cursor: pointer;
		user-select: none;
	}
	th.sortable:hover {
		color: var(--ink);
	}
	.dir {
		color: var(--accent);
		font-size: 11px;
	}
	td.namecell {
		white-space: nowrap;
	}
	.row-icon {
		width: 20px;
		height: 20px;
		object-fit: cover;
		border-radius: 4px;
		vertical-align: -5px;
		margin-right: 7px;
	}
	.role {
		margin-left: 8px;
		font-size: 11px;
		color: var(--ink-3);
	}
	td.barcell {
		min-width: 132px;
	}
	.v {
		display: block;
		font-variant-numeric: tabular-nums;
	}
	.v.none {
		color: var(--ink-3);
	}
	/* one hue per column — the categories are nominal, so bar length is the only encoding */
	.bar {
		display: block;
		margin-top: 3px;
		height: 3px;
		border-radius: 99px;
		background: var(--surface-2);
		overflow: hidden;
	}
	.fill {
		display: block;
		height: 100%;
		min-width: 2px;
		border-radius: inherit;
		background: var(--accent);
	}
	.fill.risk {
		background: var(--hostile);
	}
	.foot {
		max-width: 78ch;
	}
</style>
