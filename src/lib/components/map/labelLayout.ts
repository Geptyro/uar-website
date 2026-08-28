/**
 * Placing the names on the map so they can be read.
 *
 * Every marker asks for its name to be written near its point; this lays
 * them all out together. A name tries a ring of places around its point,
 * near first, then further out, and takes the first that overlaps no other
 * name, no marker and not the map's edge. A name placed away from its point
 * gets a leader line. A name that fits nowhere is left out, and the map says
 * how many, so a reader knows to zoom in: closer, the same names fit.
 *
 * Sizes are in map units at the current zoom (`k`), the way the markers
 * size themselves, so the result reads the same at every width. Pure, so it
 * runs in a plain node test.
 */
import type { MapTone } from './context';

/** The markers' text size, in map units at zoom 1. */
export const FONT = 6.4;

/**
 * A label's width in map units, from its length: the mono face runs about
 * 0.62 em per glyph, and the letter-spacing adds a little. An estimate, for
 * laying names out; nothing is measured.
 */
export const textWidth = (text: string, k: number) => text.length * FONT * 0.66 * k;

export interface LabelRequest {
	id: string;
	/** The point it names, in SVG units. */
	x: number;
	y: number;
	text: string;
	tone: MapTone;
	/** The marker's radius around the point, kept clear. */
	r: number;
	/** Higher goes first, and so gets the better place. */
	priority?: number;
	/** Text size, as a multiple of the map's font. */
	scale?: number;
	/** Already placed: written where asked, and only counted as an obstacle. */
	fixed?: { x: number; y: number; anchor: 'start' | 'middle' | 'end' };
}

export interface PlacedLabel {
	id: string;
	text: string;
	tone: MapTone;
	/** The text's baseline start, and how it hangs from it. */
	tx: number;
	ty: number;
	anchor: 'start' | 'middle' | 'end';
	fontSize: number;
	/** From the point to the name, when the name sits away from it. */
	lead: { x1: number; y1: number; x2: number; y2: number } | null;
}

interface Box {
	x: number;
	y: number;
	w: number;
	h: number;
}

const overlaps = (a: Box, b: Box, m: number) =>
	a.x < b.x + b.w + m && a.x + a.w + m > b.x && a.y < b.y + b.h + m && a.y + a.h + m > b.y;

/** The box a text takes, hanging from its baseline start by its anchor. */
function boxOf(tx: number, ty: number, w: number, h: number, anchor: 'start' | 'middle' | 'end'): Box {
	const x = anchor === 'start' ? tx : anchor === 'end' ? tx - w : tx - w / 2;
	return { x, y: ty - h * 0.8, w, h };
}

/** The point of the box nearest to (px, py). */
function nearest(b: Box, px: number, py: number) {
	return { x: Math.min(Math.max(px, b.x), b.x + b.w), y: Math.min(Math.max(py, b.y), b.y + b.h) };
}

/* the ring of places a name tries, as (unit vector, how the text hangs) */
const DIRS: { dx: number; dy: number; anchor: 'start' | 'middle' | 'end'; vy: number }[] = [
	{ dx: 1, dy: 0, anchor: 'start', vy: 0.35 },
	{ dx: -1, dy: 0, anchor: 'end', vy: 0.35 },
	{ dx: 0.7, dy: -0.7, anchor: 'start', vy: 0 },
	{ dx: -0.7, dy: -0.7, anchor: 'end', vy: 0 },
	{ dx: 0.7, dy: 0.7, anchor: 'start', vy: 0.8 },
	{ dx: -0.7, dy: 0.7, anchor: 'end', vy: 0.8 },
	{ dx: 0, dy: -1, anchor: 'middle', vy: -0.2 },
	{ dx: 0, dy: 1, anchor: 'middle', vy: 1 }
];

export function layoutLabels(
	reqs: LabelRequest[],
	k: number,
	size: number
): { placed: PlacedLabel[]; hidden: number } {
	const margin = 1.2 * k;
	const pad = 1 * k;
	const taken: Box[] = [];
	const anchors = reqs.map((r) => ({ x: r.x, y: r.y, r: r.r }));
	const placed: PlacedLabel[] = [];
	let hidden = 0;

	/* names grow with the zoom, but slower than the ground: by its square
	   root, so a name at 4× reads twice as large as at 1× rather than four
	   times, and zooming out shrinks it back */
	const tk = Math.sqrt(k);
	const metrics = (q: LabelRequest) => {
		const s = q.scale ?? 1;
		return { w: textWidth(q.text, tk) * s, h: FONT * tk * s, fontSize: FONT * tk * s };
	};
	const clearOfMarkers = (b: Box, self: LabelRequest) =>
		anchors.every((a) => {
			if (a.x === self.x && a.y === self.y) return true;
			const n = nearest(b, a.x, a.y);
			return Math.hypot(n.x - a.x, n.y - a.y) > a.r + 0.5 * k;
		});
	const inMap = (b: Box) => b.x >= pad && b.y >= pad && b.x + b.w <= size - pad && b.y + b.h <= size - pad;

	const order = [...reqs].sort(
		(a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.y - b.y || a.x - b.x
	);

	// fixed names first: they are where they are, and everything else avoids them
	for (const q of order) {
		if (!q.fixed) continue;
		const { w, h, fontSize } = metrics(q);
		taken.push(boxOf(q.fixed.x, q.fixed.y, w, h, q.fixed.anchor));
		placed.push({ id: q.id, text: q.text, tone: q.tone, tx: q.fixed.x, ty: q.fixed.y, anchor: q.fixed.anchor, fontSize, lead: null });
	}

	for (const q of order) {
		if (q.fixed) continue;
		const { w, h, fontSize } = metrics(q);
		const near = q.r + 2.5 * k;
		const dists = [near, q.r + 10 * k, q.r + 20 * k];
		let done = false;
		for (const d of dists) {
			for (const dir of DIRS) {
				const tx = q.x + dir.dx * d;
				const ty = q.y + dir.dy * d + dir.vy * h;
				const b = boxOf(tx, ty, w, h, dir.anchor);
				if (!inMap(b)) continue;
				if (taken.some((t) => overlaps(b, t, margin))) continue;
				if (!clearOfMarkers(b, q)) continue;
				taken.push(b);
				const away = d > near;
				const n = nearest(b, q.x, q.y);
				placed.push({
					id: q.id,
					text: q.text,
					tone: q.tone,
					tx,
					ty,
					anchor: dir.anchor,
					fontSize,
					lead: away ? { x1: q.x, y1: q.y, x2: n.x, y2: n.y } : null
				});
				done = true;
				break;
			}
			if (done) break;
		}
		if (!done) hidden++;
	}
	return { placed, hidden };
}
