/**
 * Build-time changelog data (Vite glob imports — not loadable by plain
 * node:test; the parse/render logic lives in changelog.ts). Importing this
 * pulls every entry's text into the chunk, so keep it to the changelog
 * route's server load and the overview page. The layout badge reads version
 * folder names through its own cheap release.json glob instead.
 */
import { buildChangelog, groupByMonth } from './changelog';

const entryFiles = import.meta.glob('/changelog/v*/*.md', {
	eager: true,
	query: '?raw',
	import: 'default'
}) as Record<string, string>;

const releaseFiles = import.meta.glob('/changelog/v*/release.json', {
	eager: true,
	import: 'default'
}) as Record<string, { date?: string }>;

export const releases = buildChangelog(entryFiles, releaseFiles);
export const latestRelease = releases[0] ?? null;
/** The same releases cut by the month they shipped — what /changelog pages by. */
export const months = groupByMonth(releases);
