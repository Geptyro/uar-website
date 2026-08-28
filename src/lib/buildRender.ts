/**
 * A guide's document, drawn: each block turned into what the page (and the
 * editor's preview, which is the same code in the browser) needs to show it.
 * Markdown becomes HTML through the allow-list renderer; table cells the
 * same, inline; a map's marks become the map component's own inputs, with a
 * named region looked up in the map data at this moment, so a re-extraction
 * that moves a cave moves the pin.
 *
 * Not `$lib/server`: the editor renders its preview with this, and nothing
 * here needs the database.
 */

import { renderBuildInline, renderBuildMarkdown, type RefResolver } from './buildMarkdown';
import { mapRegions, mapSize, regionCenter } from './map';
import placedRaw from '$lib/data/placed.json';
import type {
	MapArea,
	MapDots,
	MapLabel,
	MapLegend,
	MapPin
} from '$lib/components/ObjectiveMap.svelte';
import type { Block, MapMark, TableColumn } from './builds';

const placed = placedRaw as Record<string, number[][]>;

export type Rendered =
	| { type: 'section'; title: string; children: Rendered[] }
	| { type: 'columns'; columns: Rendered[][] }
	| { type: 'markdown'; html: string }
	| { type: 'table'; columns: TableColumn[]; rows: string[][] }
	| {
			type: 'map';
			title: string;
			caption: string;
			alt: string;
			areas: MapArea[];
			pins: MapPin[];
			dots: MapDots[];
			labels: MapLabel[];
			legend: MapLegend[];
	  };

/** Names of every region a mark may sit on, for the editor's picker and validation. */
export const regionNames: string[] = mapRegions.map((r) => r.name).filter(Boolean);
/** Kinds of pre-placed object dots may show, with how many there are. */
export const placedKinds: { key: string; count: number }[] = Object.entries(placed).map(
	([key, pts]) => ({ key, count: pts.length })
);

const regionByName = new Map(mapRegions.map((r) => [r.name, r]));

function place(m: MapMark): { x: number; y: number; r: number } | null {
	if (!m.at) return null;
	if ('region' in m.at) {
		const r = regionByName.get(m.at.region);
		if (!r) return null;
		const c = regionCenter(r);
		// a ring the size of the place: mean of a rectangle's sides over four, a circle's own radius
		const size =
			r.type === 'rect'
				? ((r.x2 ?? 0) - (r.x1 ?? 0) + ((r.y2 ?? 0) - (r.y1 ?? 0))) / 4
				: (r.r ?? r.w ?? 6);
		return { ...c, r: m.r ?? Math.max(3, size) };
	}
	return { x: m.at.x, y: m.at.y, r: m.r ?? 8 };
}

function renderMap(b: Extract<Block, { type: 'map' }>): Extract<Rendered, { type: 'map' }> {
	const areas: MapArea[] = [];
	const pins: MapPin[] = [];
	const dots: MapDots[] = [];
	const labels: MapLabel[] = [];
	const legend: MapLegend[] = [];
	const seenLegend = new Set<string>();
	for (const m of b.marks) {
		if (m.kind === 'dots') {
			const pts = (m.placed && placed[m.placed]) || [];
			dots.push({ points: pts.map(([x, y]) => [x, y]), tone: m.tone });
			const key = `dot:${m.tone}:${m.label}`;
			if (m.label && !seenLegend.has(key)) {
				seenLegend.add(key);
				legend.push({ tone: m.tone, shape: 'dot', label: `${m.label} (${pts.length})` });
			}
			continue;
		}
		const p = place(m);
		if (!p) continue;
		if (m.kind === 'pin') {
			pins.push({
				x: p.x,
				y: p.y,
				tone: m.tone,
				label: m.label || undefined,
				// the label goes away from the nearer edge, so it stays on the map
				side: m.side ?? (p.x > mapSize / 2 ? 'left' : 'right')
			});
		} else if (m.kind === 'area') {
			areas.push({ x: p.x, y: p.y, r: p.r, tone: m.tone, label: m.label || undefined });
		} else {
			labels.push({
				x: p.x,
				y: p.y,
				text: m.label,
				tone: m.tone,
				anchor: p.x > mapSize / 2 ? 'end' : 'start'
			});
		}
	}
	const named = b.marks.filter((m) => m.kind !== 'dots' && m.label).map((m) => m.label);
	return {
		type: 'map',
		title: b.title || 'The map',
		caption: b.caption,
		alt: named.length ? `The minimap with ${named.join(', ')} marked` : 'The minimap',
		areas,
		pins,
		dots,
		labels,
		legend
	};
}

export function renderBlocks(blocks: Block[], refs: RefResolver | null): Rendered[] {
	return blocks.map((b): Rendered => {
		switch (b.type) {
			case 'section':
				return { type: 'section', title: b.title, children: renderBlocks(b.children, refs) };
			case 'columns':
				return { type: 'columns', columns: b.columns.map((col) => renderBlocks(col, refs)) };
			case 'markdown':
				return { type: 'markdown', html: renderBuildMarkdown(b.text, refs) };
			case 'table':
				return {
					type: 'table',
					columns: b.columns,
					rows: b.rows.map((r) => r.map((c) => renderBuildInline(c, refs)))
				};
			case 'map':
				return renderMap(b);
		}
	});
}
