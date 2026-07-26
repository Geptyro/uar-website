/**
 * Latest UAR Companion release for the download buttons.
 *
 * Read from the auto-update manifests the app itself uses
 * (releases/latest/download/latest*.yml) rather than the GitHub API: those
 * are plain asset downloads with no rate limit, whereas the API allows 60
 * calls per hour per IP and fails on shared egress. Cached for an hour;
 * if GitHub is unreachable the page falls back to linking the releases
 * index, which always works.
 */
import type { PageServerLoad } from './$types';

export const prerender = false;

const REPO = 'Geptyro/uar-companion';
const LATEST = `https://github.com/${REPO}/releases/latest/download`;
const TTL_MS = 60 * 60 * 1000;

export interface CompanionAsset {
	name: string;
	url: string;
	size: number;
}

export interface CompanionRelease {
	version: string | null;
	windows: CompanionAsset | null;
	linux: CompanionAsset | null;
	mac: CompanionAsset | null;
}

const EMPTY: CompanionRelease = { version: null, windows: null, linux: null, mac: null };
let cache: { at: number; value: CompanionRelease } | null = null;

/** Pulls version + primary file out of an electron-updater manifest. */
function parseManifest(yml: string): { version: string; asset: CompanionAsset } | null {
	const version = yml.match(/^version:\s*(\S+)/m)?.[1];
	const name = yml.match(/^path:\s*(\S+)/m)?.[1];
	if (!version || !name) return null;
	const size = Number(
		yml.match(new RegExp(`- url:\\s*${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}[\\s\\S]*?size:\\s*(\\d+)`))?.[1] ?? 0
	);
	return {
		version,
		asset: { name, url: `https://github.com/${REPO}/releases/download/v${version}/${name}`, size }
	};
}

async function readManifest(file: string): Promise<{ version: string; asset: CompanionAsset } | null> {
	try {
		const res = await fetch(`${LATEST}/${file}`, {
			headers: { 'user-agent': 'uar-website' },
			signal: AbortSignal.timeout(5000)
		});
		if (!res.ok) return null;
		return parseManifest(await res.text());
	} catch {
		return null;
	}
}

export const load: PageServerLoad = async () => {
	if (cache && Date.now() - cache.at < TTL_MS) return { release: cache.value };
	const [win, linux, mac] = await Promise.all([
		readManifest('latest.yml'),
		readManifest('latest-linux.yml'),
		readManifest('latest-mac.yml')
	]);
	const version = win?.version ?? linux?.version ?? mac?.version ?? null;
	if (!version) return { release: cache?.value ?? EMPTY };
	const value: CompanionRelease = {
		version: `v${version}`,
		windows: win?.asset ?? null,
		linux: linux?.asset ?? null,
		mac: mac?.asset ?? null
	};
	cache = { at: Date.now(), value };
	return { release: value };
};
