/**
 * The reusable AO Thalim map: `AoMap` owns the minimap and the viewport
 * (pan, zoom, legend, caption); the markers are its children, written in
 * game coordinates, and keep their size on screen as the map zooms.
 *
 *     <AoMap alt="…" legend={[…]}>
 *       <Rect x1 y1 x2 y2 tone="accent" label="Thalim" />
 *       <Pin x y tone="gold" label="MULE spawn" />
 *     </AoMap>
 *
 * The class guides' ObjectiveMap and the /map page predate this and still
 * draw their own SVG; they are to move here one at a time.
 */
export { default as AoMap } from './AoMap.svelte';
export { default as Pin } from './Pin.svelte';
export { default as Area } from './Area.svelte';
export { default as Rect } from './Rect.svelte';
export { default as Dots } from './Dots.svelte';
export { default as Label } from './Label.svelte';
export { default as Path } from './Path.svelte';
export { default as Icon } from './Icon.svelte';
export type { MapTone, MapLegendEntry } from './context';
