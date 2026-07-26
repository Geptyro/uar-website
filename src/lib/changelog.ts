/**
 * Changelog entries: one markdown file per user-visible change under
 * changelog/vX.Y.Z/ (see changelog/unreleased/README.md for the format).
 * Dependency-free so plain node:test can load it without Vite.
 */

export const ENTRY_TYPES = ['feature', 'improvement', 'fix', 'data'] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export const ENTRY_AREAS = ['wiki', 'players', 'replays', 'site'] as const;
export type EntryArea = (typeof ENTRY_AREAS)[number];

// Display order: major leads its release, minor trails (and renders compact).
export const ENTRY_IMPACTS = ['major', 'normal', 'minor'] as const;
export type EntryImpact = (typeof ENTRY_IMPACTS)[number];

export interface ChangelogEntry {
	title: string;
	type: EntryType;
	area: EntryArea;
	impact: EntryImpact;
	html: string;
}

export interface ChangelogRelease {
	version: string;
	date: string;
	entries: ChangelogEntry[];
}

const VERSION_RE = /\/changelog\/(v\d+\.\d+\.\d+)\//;

export function compareVersions(a: string, b: string): number {
	const pa = a.replace(/^v/, '').split('.').map(Number);
	const pb = b.replace(/^v/, '').split('.').map(Number);
	for (let i = 0; i < 3; i++) {
		const d = (pa[i] ?? 0) - (pb[i] ?? 0);
		if (d) return d;
	}
	return 0;
}

/** Latest released version from glob keys like /changelog/v0.7.1/release.json. */
export function latestVersion(paths: string[]): string | null {
	let best: string | null = null;
	for (const p of paths) {
		const v = VERSION_RE.exec(p)?.[1];
		if (v && (!best || compareVersions(v, best) > 0)) best = v;
	}
	return best;
}

export interface VersionBadge {
	version: string | null;
	/** false when the latest release holds only minor entries — no dot then */
	notable: boolean;
}

/** Badge data from a release.json glob map. Releases from before the impact
 * field lack `notable` and count as notable. */
export function latestVersionInfo(
	files: Record<string, { date?: string; notable?: number }>
): VersionBadge {
	const version = latestVersion(Object.keys(files));
	if (!version) return { version: null, notable: false };
	const json = Object.entries(files).find(([p]) => p.includes(`/changelog/${version}/`))?.[1];
	return { version, notable: json?.notable === undefined ? true : json.notable > 0 };
}

export interface ParsedEntry {
	title: string;
	type: EntryType;
	area: EntryArea;
	impact: EntryImpact;
	body: string;
}

export function parseEntry(raw: string): ParsedEntry {
	const meta: Record<string, string> = {};
	let body = raw;
	const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
	if (fm) {
		body = raw.slice(fm[0].length);
		for (const line of fm[1].split(/\r?\n/)) {
			const kv = line.match(/^(\w+):\s*(.*)$/);
			if (kv) meta[kv[1]] = kv[2].trim();
		}
	}
	const type = (ENTRY_TYPES as readonly string[]).includes(meta.type ?? '')
		? (meta.type as EntryType)
		: 'improvement';
	const area = (ENTRY_AREAS as readonly string[]).includes(meta.area ?? '')
		? (meta.area as EntryArea)
		: 'site';
	const impact = (ENTRY_IMPACTS as readonly string[]).includes(meta.impact ?? '')
		? (meta.impact as EntryImpact)
		: 'normal';
	return { title: meta.title ?? '', type, area, impact, body: body.trim() };
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function inline(text: string): string {
	return escapeHtml(text)
		.split(/(`[^`]+`)/)
		.map((part) => {
			if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) {
				return `<code>${part.slice(1, -1)}</code>`;
			}
			return part
				.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
				.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label: string, href: string) =>
					/^(https?:\/\/|\/)/.test(href) ? `<a href="${href}">${label}</a>` : m
				);
		})
		.join('');
}

/** Entry bodies use a small markdown subset: paragraphs, "- " lists, **bold**, `code`, links. */
export function renderMarkdown(md: string): string {
	return md
		.trim()
		.split(/\n\s*\n/)
		.map((block) => block.split('\n').map((l) => l.trim()).filter(Boolean))
		.filter((lines) => lines.length)
		.map((lines) => {
			if (lines.every((l) => l.startsWith('- '))) {
				return `<ul>${lines.map((l) => `<li>${inline(l.slice(2))}</li>`).join('')}</ul>`;
			}
			return `<p>${inline(lines.join(' '))}</p>`;
		})
		.join('\n');
}

const typeRank = (t: EntryType) => ENTRY_TYPES.indexOf(t);
const areaRank = (a: EntryArea) => ENTRY_AREAS.indexOf(a);
const impactRank = (i: EntryImpact) => ENTRY_IMPACTS.indexOf(i);

/**
 * Assemble releases (newest first) from raw glob maps:
 * entryFiles = path -> raw markdown, releaseFiles = path -> release.json content.
 */
export function buildChangelog(
	entryFiles: Record<string, string>,
	releaseFiles: Record<string, { date?: string }>
): ChangelogRelease[] {
	const byVersion = new Map<string, ChangelogEntry[]>();
	for (const [path, raw] of Object.entries(entryFiles)) {
		const v = VERSION_RE.exec(path)?.[1];
		if (!v) continue;
		const e = parseEntry(raw);
		const title = e.title || (path.split('/').pop() ?? '').replace(/\.md$/, '');
		let list = byVersion.get(v);
		if (!list) byVersion.set(v, (list = []));
		list.push({ title, type: e.type, area: e.area, impact: e.impact, html: renderMarkdown(e.body) });
	}
	const dates = new Map<string, string>();
	for (const [path, json] of Object.entries(releaseFiles)) {
		const v = VERSION_RE.exec(path)?.[1];
		if (v && json?.date) dates.set(v, json.date);
	}
	return [...byVersion.entries()]
		.sort(([a], [b]) => compareVersions(b, a))
		.map(([version, entries]) => ({
			version,
			date: dates.get(version) ?? '',
			entries: entries.sort(
				(x, y) =>
					impactRank(x.impact) - impactRank(y.impact) ||
					typeRank(x.type) - typeRank(y.type) ||
					areaRank(x.area) - areaRank(y.area) ||
					x.title.localeCompare(y.title)
			)
		}));
}
