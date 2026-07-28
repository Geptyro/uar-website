/**
 * Sitemap XML. Kept free of imports so plain `node --test` can load it (see
 * CLAUDE.md) — the route gathers the paths, this only serialises them.
 */

export interface SitemapUrl {
	/** Root-relative, leading slash, already percent-encoded. */
	path: string;
	/** ISO date the page last changed, where we know it. */
	lastmod?: string;
	/** 0..1, relative to the rest of this sitemap only. */
	priority?: number;
}

const ESCAPE: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&apos;'
};

export function xmlEscape(s: string): string {
	return s.replace(/[&<>"']/g, (c) => ESCAPE[c]);
}

export function sitemapXml(origin: string, urls: SitemapUrl[]): string {
	const entries = urls.map((u) => {
		const lines = [`\t\t<loc>${xmlEscape(origin + u.path)}</loc>`];
		if (u.lastmod) lines.push(`\t\t<lastmod>${xmlEscape(u.lastmod)}</lastmod>`);
		if (u.priority !== undefined) lines.push(`\t\t<priority>${u.priority.toFixed(1)}</priority>`);
		return `\t<url>\n${lines.join('\n')}\n\t</url>`;
	});
	return (
		'<?xml version="1.0" encoding="UTF-8"?>\n' +
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
		entries.join('\n') +
		'\n</urlset>\n'
	);
}

/** `lastmod` wants a date, and the profiles carry a full timestamp. */
export function sitemapDate(iso: string | undefined | null): string | undefined {
	if (!iso) return undefined;
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}
