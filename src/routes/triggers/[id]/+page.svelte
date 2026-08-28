<script lang="ts">
	/**
	 * A trigger group's overview, drawn from the map script and nothing
	 * else: the places its triggers name on the minimap, the units in play,
	 * and trigger by trigger what fires it, what it puts in front of the
	 * player and what it pays. The chain is the flow tab's.
	 */
	import { Page } from 'sveltekit-commons';
	import Seo from '$lib/components/Seo.svelte';
	import { AoMap, Area, Dots, Icon, Path, Pin, Rect, type MapLegendEntry, type MapTone } from '$lib/components/map';
	import type { HoverInfo } from '$lib/components/map/context';
	import { units as allUnits } from '$lib/units';
	import GuideShell from '$lib/components/GuideShell.svelte';
	import { eventLabel, fmtDuration, triggerRole, type FlowNode } from '$lib/flow';
	import { triggerHref } from '$lib/triggerTabs';
	import { mapRegions, regionCategory, regionCenter, regionSizeLabel } from '$lib/map';
	import { GROUP_TYPES, groupHref, groupXp } from '$lib/groups';

	let { data } = $props();

	const group = $derived(data.group);
	const kind = $derived(GROUP_TYPES.find((t) => t.type === group.type)!);
	const flow = $derived(data.flow as FlowNode[]);

	/** `DestructibleCityDebris2x4Vertical` → `Destructible City Debris 2x4 Vertical`. */
	const prettify = (id: string) => id.replace(/(?<=[a-z0-9])(?=[A-Z])/g, ' ');
	const unitName = (type: string) => data.unitNames[type] ?? prettify(type);
	const unitIcon = (type: string): string | null => data.unitIcons[type] ?? null;
	const entityIds = new Set(allUnits.map((u) => u.id));

	/* ---------- the units in play: the named unit variables the triggers drive ---------- */
	const actors = $derived.by(() => {
		const seen = new Map<string, { name: string; type: string | null; triggers: string[] }>();
		for (const n of flow)
			for (const a of n.refs?.actors ?? []) {
				const e = seen.get(a.var) ?? { name: a.name, type: a.type, triggers: [] };
				if (!e.triggers.includes(n.name)) e.triggers.push(n.name);
				seen.set(a.var, e);
			}
		return [...seen.values()];
	});

	/* ---------- the map: every place the mission's triggers name ---------- */
	type MapArea = { x: number; y: number; r: number; tone: MapTone; label?: string; info?: HoverInfo };
	type MapRect = { x1: number; y1: number; x2: number; y2: number; tone: MapTone; label?: string; info?: HoverInfo };
	type MapPin = {
		x: number;
		y: number;
		tone: MapTone;
		label?: string;
		icon?: string | null;
		info?: HoverInfo;
		spread?: number;
		spreadOf?: number;
	};
	type MapDots = { points: [number, number][]; tone: MapTone };
	const regionById = new Map(mapRegions.map((r) => [r.id, r]));
	const places = $derived.by(() => {
		const namedBy = new Map<number, string[]>();
		for (const n of flow)
			for (const id of n.refs?.regions ?? []) (namedBy.get(id) ?? namedBy.set(id, []).get(id)!).push(n.name);
		const areas: MapArea[] = [];
		const rects: MapRect[] = [];
		for (const [id, by] of namedBy) {
			const r = regionById.get(id);
			if (!r || regionCategory(r) === 'boundary') continue;
			const c = regionCenter(r);
			const info: HoverInfo = {
				title: r.name,
				kind: `${regionCategory(r)} region`,
				lines: [`${r.type}, ${regionSizeLabel(r)} at ${Math.round(c.x)},${Math.round(c.y)}`, `named by ${by.join(', ')}`]
			};
			if (r.type === 'rect')
				rects.push({ x1: r.x1!, y1: r.y1!, x2: r.x2!, y2: r.y2!, tone: 'accent', label: r.name, info });
			else if (r.type === 'circle') areas.push({ x: r.cx!, y: r.cy!, r: r.r!, tone: 'accent', label: r.name, info });
			else areas.push({ ...c, r: Math.max(r.w ?? 1, r.h ?? 1) / 2, tone: 'accent', label: r.name, info });
		}
		const pins: MapPin[] = [];
		const pointBy = new Map<number, { p: { id: number; name: string; x: number; y: number }; by: string[] }>();
		for (const n of flow)
			for (const p of n.refs?.points ?? []) {
				const e = pointBy.get(p.id) ?? { p, by: [] };
				e.by.push(n.name);
				pointBy.set(p.id, e);
			}
		for (const { p, by } of pointBy.values())
			pins.push({
				x: p.x,
				y: p.y,
				tone: 'gold',
				label: p.name,
				info: { title: p.name, kind: 'point the script names', lines: [`at ${Math.round(p.x)},${Math.round(p.y)}`, `in ${by.join(', ')}`] }
			});
		/* pre-placed units: a type that appears a few times is pinned by name,
		   one that appears many times (debris, street lights) becomes dots */
		const byType = new Map<string, { x: number; y: number; by: string[] }[]>();
		const seenUnit = new Map<number, { x: number; y: number; by: string[] }>();
		for (const n of flow)
			for (const u of n.refs?.units ?? []) {
				const e = seenUnit.get(u.id);
				if (e) {
					e.by.push(n.name);
					continue;
				}
				const entry = { x: u.x, y: u.y, by: [n.name] };
				seenUnit.set(u.id, entry);
				(byType.get(u.type) ?? byType.set(u.type, []).get(u.type)!).push(entry);
			}
		const dots: MapDots[] = [];
		const dotTypes: string[] = [];
		for (const [type, us] of byType) {
			if (us.length <= 3)
				for (const u of us)
					pins.push({
						x: u.x,
						y: u.y,
						tone: 'item',
						label: unitName(type),
						icon: unitIcon(type),
						info: {
							title: unitName(type),
							kind: 'pre-placed unit',
							icon: unitIcon(type),
							lines: [`at ${Math.round(u.x)},${Math.round(u.y)}`, `used by ${u.by.join(', ')}`]
						}
					});
			else {
				dots.push({ points: us.map((u) => [u.x, u.y]), tone: 'item' });
				dotTypes.push(`${unitName(type)} ×${us.length}`);
			}
		}
		/* what the script creates, where the call says where */
		const seenSpawn = new Set<string>();
		for (const n of flow)
			for (const s of n.refs?.spawns ?? []) {
				const at = s.point
					? flow.flatMap((m) => m.refs?.points ?? []).find((p) => p.id === s.point)
					: s.region
						? (() => {
								const r = regionById.get(s.region);
								return r ? regionCenter(r) : null;
							})()
						: null;
				if (!at) continue;
				const key = `${s.type}@${at.x},${at.y}`;
				if (seenSpawn.has(key)) continue;
				seenSpawn.add(key);
				/* a unit created right on a point named after it: one pin, the unit's */
				const same = (a: string, b: string) => a.replace(/\W/g, '').toLowerCase() === b.replace(/\W/g, '').toLowerCase();
				const twin = pins.findIndex((p) => p.x === at.x && p.y === at.y && p.label && same(p.label, unitName(s.type)));
				if (twin >= 0) pins.splice(twin, 1);
				const where = s.point
					? `at ${(flow.flatMap((m) => m.refs?.points ?? []).find((p) => p.id === s.point) ?? { name: 'a point' }).name}`
					: `in ${regionById.get(s.region!)?.name ?? 'a region'}`;
				pins.push({
					x: at.x,
					y: at.y,
					tone: s.kind === 'prop' ? 'item' : 'mos',
					label: unitName(s.type),
					icon: s.kind === 'prop' ? null : unitIcon(s.type),
					info: {
						title: unitName(s.type),
						kind: s.kind === 'prop' ? 'prop the script places' : 'unit the script creates',
						icon: s.kind === 'prop' ? null : unitIcon(s.type),
						lines: [where, `by ${n.name}`]
					}
				});
			}
		/* markers on one spot fan out sideways */
		const spots = new Map<string, MapPin[]>();
		for (const p of pins) (spots.get(`${p.x},${p.y}`) ?? spots.set(`${p.x},${p.y}`, []).get(`${p.x},${p.y}`)!).push(p);
		for (const group of spots.values())
			if (group.length > 1)
				group.forEach((p, i) => {
					p.spread = i;
					p.spreadOf = group.length;
				});
		/* routes and stretches */
		const paths = flow.flatMap((n) =>
			(n.refs?.paths ?? []).map((p) => ({
				points: p.points,
				label: p.var === 'orders' ? `${n.name}: moves` : p.name,
				info: {
					title: p.var === 'orders' ? 'moves, in order' : p.name,
					kind: 'route',
					lines: [`${p.points.length} points, ${p.points[0].name} to ${p.points[p.points.length - 1].name}`, `in ${n.name}`]
				} as HoverInfo
			}))
		);
		const segments = flow.flatMap((n) =>
			(n.refs?.segments ?? []).map((sg) => ({
				...sg,
				info: { title: `${sg.a.name} to ${sg.b.name}`, kind: 'a stretch it may appear along', lines: [`in ${n.name}`] } as HoverInfo
			}))
		);
		const legend: MapLegendEntry[] = [];
		if (areas.length || rects.length) legend.push({ tone: 'accent', shape: 'ring', label: 'region the script names' });
		if (paths.length) legend.push({ tone: 'lobby', shape: 'dot', label: 'route, in order' });
		if (segments.length) legend.push({ tone: 'warn', shape: 'dot', label: 'a stretch it may appear along' });
		if (pins.some((p) => p.tone === 'gold')) legend.push({ tone: 'gold', shape: 'pin', label: 'point the script names' });
		if (pins.some((p) => p.tone === 'item') || dots.length)
			legend.push({ tone: 'item', shape: dots.length ? 'dot' : 'pin', label: `pre-placed unit${dotTypes.length ? ': ' + dotTypes.join(', ') : ''}` });
		if (pins.some((p) => p.tone === 'mos')) legend.push({ tone: 'mos', shape: 'pin', label: 'unit the script creates here, by its icon when it has one' });
		return {
			areas,
			rects,
			pins,
			dots,
			paths,
			segments,
			legend,
			empty: !areas.length && !rects.length && !pins.length && !dots.length && !paths.length && !segments.length
		};
	});

	/* ---------- the triggers, one by one ---------- */
	const SHOW_KIND: Record<string, string> = {
		mission: 'mission text',
		message: 'message',
		objective: 'objective',
		tag: 'over the unit',
		ping: 'ping'
	};
	const regionName = (id: number) => regionById.get(id)?.name ?? `region ${id}`;
	const spawnsOf = (n: FlowNode) => [
		...(n.refs?.spawns.map((s) => ({ type: s.type, name: unitName(s.type), icon: s.kind === 'prop' ? null : unitIcon(s.type) })) ?? []),
		...(n.refs?.items.map((i) => ({ type: i, name: unitName(i), icon: unitIcon(i) })) ?? [])
	];
	const xp = $derived(groupXp(group));
</script>

<!-- no gutters, no scrolling: the map sits on the page's edge and is as
     tall as the page; only the column beside it scrolls -->
<Page fill style="--content-pad-top: 0; --content-pad-x: 0; --content-pad-bottom: 0">
	<Seo
		title="{group.name} — {kind.label}"
		description="{group.name} in Undead Assault Reborn, a {kind.label} of {flow.length} triggers: where it happens on the map, how the script runs it, what the player sees and what it pays, read from the map file."
	/>

	<div class="top">
		{#if places.empty}
			<div class="nomap card">
				<div class="eyebrow">AO Thalim</div>
				<p>These triggers name no place on the map: they fire on time, on a unit, or anywhere.</p>
			</div>
		{:else}
			<AoMap
				fill
				alt="The minimap with the regions, points and units the group's triggers name"
				legend={places.legend}
				caption="Regions and points are the ones the triggers name; units are the map's own placed objects. All read from the map file. Point at a marker for what it is."
			>
				{#each places.rects as r (r.label ?? `${r.x1},${r.y1}`)}
					<Rect x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} tone={r.tone} label={r.label} info={r.info} />
				{/each}
				{#each places.areas as a (a.label ?? `${a.x},${a.y}`)}
					<Area x={a.x} y={a.y} r={a.r} tone={a.tone} label={a.label} info={a.info} />
				{/each}
				{#each places.dots as d, i (i)}
					<Dots points={d.points} tone={d.tone} />
				{/each}
				{#each places.segments as sg, i (i)}
					<Path points={[sg.a, sg.b]} tone="warn" dashed numbered={false} info={sg.info} />
				{/each}
				{#each places.paths as pa, i (i)}
					<Path points={pa.points} tone="lobby" label={pa.label} info={pa.info} />
				{/each}
				{#each places.pins as p, i (`${i}:${p.x},${p.y},${p.label}`)}
					{#if p.icon}
						<Icon x={p.x} y={p.y} href={p.icon} tone={p.tone} label={p.label} info={p.info} spread={p.spread} spreadOf={p.spreadOf} />
					{:else}
						<Pin x={p.x} y={p.y} tone={p.tone} label={p.label} info={p.info} spread={p.spread} spreadOf={p.spreadOf} />
					{/if}
				{/each}
			</AoMap>
		{/if}
		<div class="side">
			<div class="side-scroll">
				<div class="card about">
					<div class="about-head">
						<span class="kind k-{group.type}">{kind.label}</span>
						<span class="dim">{flow.length} trigger{flow.length === 1 ? '' : 's'}{#if xp} · up to <b>{xp} XP</b>{/if}</span>
					</div>
					{#if data.armedBy.length}
						<div class="ctx">
							<span class="sub-label">Armed by</span>
							{#each data.armedBy as a, i (a.id)}{#if i > 0}, {/if}{#if a.group}<a href={groupHref(a.group)}>{a.name}</a>{:else}<b>{a.name}</b>{/if}{#if a.events.length}{' '}<span class="dim">({eventLabel(a.events[0])})</span>{/if}{/each}
						</div>
					{/if}
					{#if data.waits.length}
						<div class="ctx">
							<span class="sub-label">Waits for</span>
							{#each data.waits as w, i (w.from.id + w.via)}{#if i > 0}, {/if}{#if w.from.group}<a href={groupHref(w.from.group)}>{w.from.name}</a>{:else}<b>{w.from.name}</b>{/if}{#if w.from.events.length}{' '}<span class="dim">({eventLabel(w.from.events[0])})</span>{/if} to set <span class="mono">{w.via.replace('gv_', '')}</span>{/each}
						</div>
					{/if}
					{#if actors.length}
						<div class="ctx actors">
							<span class="sub-label">Units in play</span>
							{#each actors as a (a.name)}
								<span class="actor" title={a.triggers.join(' · ')}>
									{#if a.type && unitIcon(a.type)}<img class="uicon" src={unitIcon(a.type)} alt="" />{/if}
									<b>{a.name}</b>
									{#if a.type}
										{#if entityIds.has(a.type)}<a href="/entities/{encodeURIComponent(a.type)}">{unitName(a.type)}</a>{:else}<span class="dim">{unitName(a.type)}</span>{/if}
									{/if}
								</span>
							{/each}
						</div>
					{/if}
				</div>
				<a class="card flowlink" href={triggerHref(group.id, 'flow')}>
					<span class="eyebrow">How the script runs it</span>
					<b>The chain of {flow.length} trigger{flow.length === 1 ? '' : 's'}</b>
					<span class="dim">Which arms which, what loops, what pays and what shuts down, on a canvas of its own.</span>
				</a>
				<GuideShell>
					<div class="eyebrow">Trigger by trigger</div>
					<div class="cards one">
			{#each flow as n (n.id)}
				<article class="card d" id={n.id}>
					<h3>{n.name} <span class="role">{triggerRole(n)}</span></h3>
					<ul class="pts">
						{#if n.events.length}
							<li><b>Fires when</b> {n.events.map(eventLabel).join(', or ')}{#if !n.armed}, once armed{/if}</li>
						{:else if !n.armed}
							<li><b>Runs</b> when another trigger calls it</li>
						{/if}
						{#each n.refs?.shows ?? [] as s (s.kind + s.text)}
							<li><b>{SHOW_KIND[s.kind] ?? s.kind}</b> "{s.text}"</li>
						{/each}
						{#if n.refs?.pings && !n.refs.shows.some((s) => s.kind === 'ping')}
							<li><b>Pings</b> the map{n.refs.pings > 1 ? ` ×${n.refs.pings}` : ''}</li>
						{/if}
						{#each n.succeed as m (m.id)}
							<li class="gain"><b>+{m.xp} XP</b> {m.name}</li>
						{/each}
						{#each n.fail as m (m.id)}
							<li class="loss"><b>−{m.xp} XP</b> {m.name}</li>
						{/each}
						{#each n.timers as t (t.var + t.dur)}
							<li><b>Starts a timer</b> {t.var.replace('gv_', '')}, {fmtDuration(t.dur)}</li>
						{/each}
						{#if spawnsOf(n).length}
							<li>
								<b>Creates</b>
								{#each spawnsOf(n) as sp, i (sp.type + i)}{#if i > 0}, {/if}<span class="made">{#if sp.icon}<img class="uicon" src={sp.icon} alt="" />{/if}{#if entityIds.has(sp.type)}<a href="/entities/{encodeURIComponent(sp.type)}">{sp.name}</a>{:else}{sp.name}{/if}</span>{/each}
							</li>
						{/if}
						{#if n.refs?.regions.length}
							<li><b>Places</b> {n.refs.regions.map(regionName).join(', ')}</li>
						{/if}
					</ul>
				</article>
			{/each}
					</div>
				</GuideShell>
				<p class="fine">
		Read from the map's trigger script. How the triggers were grouped and typed is written in the extractor;
		a grouping that reads wrong is worth <a href="/feedback">saying so</a>. Every named region of the AO is
		on the <a href="/map">Map</a>.
				</p>
			</div>
		</div>
	</div>
</Page>

<style>
	/* the map at seven tenths, and beside it the triggers in a column of its
	   own that scrolls: the column is sized by the map, not by the cards, so
	   its inside is taken out of flow and told to scroll */
	/* a flex row, not a grid: the map is as tall as the page and as wide as
	   it is tall, which a row item with a set height and an aspect ratio gives
	   and a grid column cannot work out; the column takes the rest */
	.top {
		height: 100%;
		display: flex;
		gap: 20px;
		align-items: stretch;
		min-height: 0;
	}
	.top > :global(.aomap) {
		flex: none;
		height: 100%;
		aspect-ratio: 1;
		max-width: 70%;
		min-width: 0;
	}
	.top > .nomap {
		flex: 0 0 38%;
		align-self: flex-start;
		margin: 16px 0 0 24px;
	}
	.side {
		flex: 1;
	}
	/* the map on the edge; the column and the footnote keep a gutter */
	.side-scroll {
		padding-right: 24px;
	}
	.side .about,
	.side .flowlink {
		margin-top: 16px;
	}
	.side .flowlink {
		margin-top: 0;
	}
	.about-head {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 12.5px;
		color: var(--text-dim);
	}
	.about-head b {
		color: var(--text);
	}
	.ctx {
		margin-top: 10px;
		font-size: 12.5px;
		line-height: 1.5;
		color: var(--text);
	}
	.ctx .sub-label {
		display: block;
		font-family: var(--font-mono);
		font-size: 9.5px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text-faint);
		margin-bottom: 2px;
	}
	.ctx.actors {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.ctx.actors .sub-label {
		flex-basis: 100%;
	}
	.side {
		position: relative;
		min-width: 0;
	}
	.side-scroll {
		position: absolute;
		inset: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding-right: 4px;
	}
	.side .eyebrow {
		margin: 6px 0 0;
	}
	:global(.guide .cards.one) {
		grid-template-columns: 1fr;
		gap: 10px;
	}
	@media (max-width: 900px) {
		.top {
			flex-direction: column;
			height: auto;
		}
		.top > :global(.aomap) {
			height: auto;
			max-width: none;
			width: 100%;
		}
		.side-scroll {
			position: static;
			overflow: visible;
		}
	}
	.flowlink {
		display: flex;
		flex-direction: column;
		gap: 6px;
		color: var(--text);
		text-decoration: none;
		transition: border-color 120ms ease;
	}
	.flowlink:hover {
		border-color: var(--accent);
	}
	.flowlink b {
		font-size: 14px;
		font-weight: 650;
	}
	.flowlink .dim {
		font-size: 12.5px;
		line-height: 1.5;
		color: var(--text-dim);
	}
	.actor {
		display: inline-flex;
		align-items: baseline;
		gap: 6px;
		font-size: 12.5px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-2);
		padding: 4px 9px;
	}
	.actor b {
		font-weight: 650;
	}
	.uicon {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		object-fit: cover;
		vertical-align: -4px;
		border: 1px solid var(--border-strong);
		background: #0b0d10;
	}
	.actor .uicon {
		align-self: center;
		margin-right: 2px;
	}
	:global(.guide .pts .made) {
		white-space: nowrap;
	}
	:global(.guide .pts .made .uicon) {
		width: 16px;
		height: 16px;
		margin-right: 3px;
	}
	.actor .dim {
		color: var(--text-faint);
	}
	.nomap {
		min-width: 0;
	}
	.nomap p {
		margin: 0;
		font-size: 12.5px;
		color: var(--text-dim);
	}
	.eyebrow {
		margin: 0 0 8px;
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-faint);
	}
	.kind {
		display: inline-block;
		font-family: var(--font-mono);
		font-size: 9.5px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		padding: 2px 7px;
		border-radius: var(--radius-2);
		border: 1px solid var(--tone, var(--border-strong));
		color: var(--tone, var(--text-dim));
		margin-right: 6px;
		vertical-align: 1px;
	}
	.k-mission {
		--tone: var(--accent);
	}
	.k-mechanic {
		--tone: var(--mos);
	}
	.k-event {
		--tone: var(--gold);
	}
	.k-world {
		--tone: var(--item);
	}
	:global(.guide .card.d h3 .role) {
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 500;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text-faint);
		margin-left: 6px;
	}
	.mono {
		font-family: var(--font-mono);
		font-size: 0.92em;
	}
	:global(.guide .pts li.gain b) {
		color: var(--accent);
	}
	:global(.guide .pts li.loss b) {
		color: var(--hostile);
	}
	.fine {
		margin: 14px 0 0;
		font-size: 11px;
		line-height: 1.5;
		color: var(--text-faint);
		padding: 0 0 24px;
	}
</style>
