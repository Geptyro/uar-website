/**
 * Shared paging helpers. Dependency-free so plain node:test can load them
 * (see CLAUDE.md) and both the server loads and the pager component agree
 * on what a page is.
 */

export const PER_PAGE = 50;

export interface Paged<T> {
	rows: T[];
	page: number;
	pages: number;
	total: number;
	perPage: number;
}

/** Clamps a ?page value from a URL to something that exists. */
export function pageNumber(raw: string | null, pages: number): number {
	const n = Number(raw);
	if (!Number.isFinite(n) || n < 1) return 1;
	return Math.min(Math.floor(n), Math.max(1, pages));
}

export function paginate<T>(all: T[], rawPage: string | null, perPage = PER_PAGE): Paged<T> {
	const total = all.length;
	const pages = Math.max(1, Math.ceil(total / perPage));
	const page = pageNumber(rawPage, pages);
	return { rows: all.slice((page - 1) * perPage, page * perPage), page, pages, total, perPage };
}

/**
 * Page numbers to show around the current one, with nulls marking gaps:
 * 1 … 4 5 [6] 7 8 … 20
 */
export function pageWindow(page: number, pages: number, span = 2): (number | null)[] {
	if (pages <= 1) return [1];
	const wanted = new Set<number>([1, pages]);
	for (let p = page - span; p <= page + span; p++) if (p >= 1 && p <= pages) wanted.add(p);
	const sorted = [...wanted].sort((a, b) => a - b);
	const out: (number | null)[] = [];
	let previous = 0;
	for (const p of sorted) {
		if (previous && p - previous > 1) out.push(null);
		out.push(p);
		previous = p;
	}
	return out;
}
