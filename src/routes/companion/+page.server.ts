/**
 * Latest UAR Companion release, read from the GitHub API so the download
 * buttons always point at the current build without a site deploy.
 * Cached for an hour: the API allows 60 unauthenticated calls per hour and
 * a release changes far less often than the page is viewed.
 */
import type { PageServerLoad } from './$types';

export const prerender = false;

const REPO = 'Geptyro/uar-companion';
const TTL_MS = 60 * 60 * 1000;

export interface CompanionAsset {
	name: string;
	url: string;
	size: number;
}

export interface CompanionRelease {
	version: string | null;
	publishedAt: string | null;
	windows: CompanionAsset | null;
	linux: CompanionAsset | null;
	mac: CompanionAsset | null;
}

let cache: { at: number; value: CompanionRelease } | null = null;

const EMPTY: CompanionRelease = {
	version: null,
	publishedAt: null,
	windows: null,
	linux: null,
	mac: null
};

function pick(
	assets: { name: string; browser_download_url: string; size: number }[],
	test: (name: string) => boolean
): CompanionAsset | null {
	const a = assets.find((x) => test(x.name.toLowerCase()));
	return a ? { name: a.name, url: a.browser_download_url, size: a.size } : null;
}

export const load: PageServerLoad = async () => {
	if (cache && Date.now() - cache.at < TTL_MS) return { release: cache.value };
	try {
		const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
			headers: { accept: 'application/vnd.github+json' },
			signal: AbortSignal.timeout(5000)
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const body = (await res.json()) as {
			tag_name?: string;
			published_at?: string;
			assets?: { name: string; browser_download_url: string; size: number }[];
		};
		const assets = body.assets ?? [];
		const value: CompanionRelease = {
			version: body.tag_name ?? null,
			publishedAt: body.published_at ?? null,
			windows: pick(assets, (n) => n.endsWith('.exe')),
			linux: pick(assets, (n) => n.endsWith('.appimage')),
			mac: pick(assets, (n) => n.endsWith('.zip'))
		};
		cache = { at: Date.now(), value };
		return { release: value };
	} catch {
		// GitHub unreachable or rate-limited: the page falls back to linking
		// the releases index, which always works
		return { release: cache?.value ?? EMPTY };
	}
};
