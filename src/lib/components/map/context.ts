/**
 * What a marker needs from the map it is drawn on: the flip from game
 * coordinates (origin bottom-left) to SVG ones, and `k`, how many map units
 * one screen pixel is worth compared with the unzoomed map. A marker
 * multiplies its radii, its font and its offsets by `k`, so it keeps its size
 * on screen while the ground under it grows.
 *
 * Handed down by AoMap through Svelte context, so a marker is written as
 * `<Pin x y tone />` in game coordinates and knows nothing of the viewport.
 */
import type { LabelRequest } from './labelLayout';

export const MAP_CTX = Symbol('aomap');

/** What a tooltip over the map says about a marker. */
export interface HoverInfo {
	title: string;
	/** What kind of thing it is, as an eyebrow. */
	kind?: string;
	lines?: string[];
	/** The thing's picture, when it has one (a unit's icon). */
	icon?: string | null;
}

export interface MapCtx {
	/** Reactive: reads the map's current zoom scale. */
	readonly k: number;
	/** Game y (origin bottom-left) → SVG y (origin top-left). */
	flip: (y: number) => number;
	/** The map's side, in map units. */
	size: number;
	/** Show `info` in a tooltip by the pointer, or hide it with null. */
	hover: (info: HoverInfo | null, e?: { clientX: number; clientY: number }) => void;
	/** Ask for a name to be written by a point (see labelLayout), or withdraw it with null. */
	label: (id: string, req: LabelRequest | null) => void;
}

/* the text size and the width estimate live with the layout, which a plain
   node test loads; they are re-exported here for the markers */
export { FONT, textWidth } from './labelLayout';

/** `v` moved inside [lo, hi] when that range exists. */
export const within = (v: number, lo: number, hi: number) =>
	lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v));

/**
 * A colour a marker can take. Names, not values: each maps to one of the
 * palette's semantic tokens, so a page says "the city is item-coloured" and
 * never picks a hex of its own.
 */
export type MapTone = 'accent' | 'item' | 'mos' | 'hostile' | 'gold' | 'warn' | 'lobby';

export interface MapLegendEntry {
	tone: MapTone;
	/** 'ring' draws the swatch as an outline, the way areas are drawn. */
	shape?: 'dot' | 'ring' | 'pin';
	label: string;
}
