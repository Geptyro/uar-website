/**
 * This site's changelog vocabulary.
 *
 * The parser, the markdown subset and the sort moved to
 * `sveltekit-commons/changelog` when the STALZONE database grew a changelog of
 * its own and copied this file wholesale. What is left here is the part that
 * was ever about UAR: what kinds of change it files, and which parts of the
 * site they land in. See changelog/unreleased/README.md for the file format.
 *
 * Both lists are ORDERED and the order is the display order, so `feature` first
 * is what puts features at the top of a release.
 *
 * The re-exports below are not ceremony: every call site here (the layout
 * badge, /changelog, the overview rail, scripts/release.ts) used to import from
 * this module, and keeping that true means the move is one file rather than
 * seven. Dependency-free apart from commons, so node:test still loads it.
 */
export {
	ENTRY_IMPACTS,
	compareVersions,
	latestVersion,
	latestVersionInfo,
	renderMarkdown,
	type ChangelogEntry,
	type ChangelogProblem,
	type ChangelogRelease,
	type EntryImpact,
	type VersionBadge
} from 'sveltekit-commons/changelog';

import {
	buildChangelog as build,
	lintEntry as lint,
	parseEntry as parse,
	type ChangelogProblem,
	type ChangelogRelease,
	type ChangelogSchema,
	type ParsedEntry
} from 'sveltekit-commons/changelog';

export const CHANGELOG_SCHEMA = {
	types: ['feature', 'improvement', 'fix', 'data'],
	areas: ['wiki', 'players', 'replays', 'site'],
	// what this site filed before `type` had a default worth naming
	defaultType: 'improvement',
	defaultArea: 'site'
} as const satisfies ChangelogSchema;

export const ENTRY_TYPES = CHANGELOG_SCHEMA.types;
export const ENTRY_AREAS = CHANGELOG_SCHEMA.areas;

export type EntryType = (typeof CHANGELOG_SCHEMA.types)[number];
export type EntryArea = (typeof CHANGELOG_SCHEMA.areas)[number];
export type Release = ChangelogRelease<EntryType, EntryArea>;

/** This site's schema, applied — the two wrappers every call site already used. */
export function parseEntry(raw: string): ParsedEntry<EntryType, EntryArea> {
	return parse(raw, CHANGELOG_SCHEMA);
}

/**
 * Everything wrong with an entry file, empty when it is clean. `parseEntry`
 * above falls back instead of complaining, so `tests/changelog-entries.test.ts`
 * runs this over every committed entry to keep a typo from shipping quietly.
 */
export function lintEntry(raw: string): ChangelogProblem[] {
	return lint(raw, CHANGELOG_SCHEMA);
}

export function buildChangelog(
	entryFiles: Record<string, string>,
	releaseFiles: Record<string, { date?: string }>
): Release[] {
	return build(entryFiles, releaseFiles, CHANGELOG_SCHEMA);
}
