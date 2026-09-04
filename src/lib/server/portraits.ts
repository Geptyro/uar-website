/**
 * Which portraits exist.
 *
 * Blizzard's SC2 API hands out portrait urls built from a sprite-sheet
 * coordinate on static.starcraft2.com, and it hands out coordinates for
 * sheets it never published there: everything on row 16 answers 403, on
 * every build id, and fetching the profile again returns the same dead url.
 * The browser swaps a dead one for the anonymous portrait where the picture
 * is Svelte's (uar-shared/portrait), but the url still reaches every reader
 * of the avatar map (the @ search, the chips markdown emits, a player's hover
 * card, the companion), and each of those would need a fallback of its own
 * or show the browser's broken-image glyph. Cheaper to ask the CDN once per
 * url and forget the dead ones where the account is stored: when the account
 * links, and once per process for what was stored before this existed.
 *
 * Only a definite answer counts. A timeout, a network error or a 5xx says
 * nothing about the picture, and a portrait must never be lost to a slow
 * CDN: those are asked again next time, and the browser's fallback covers
 * the meantime.
 */

const TIMEOUT_MS = 4_000;

/** Verdicts this process has reached: true alive, false dead. An unknown is not kept. */
const verdicts = new Map<string, boolean>();

/** Whether the picture at `url` exists: true, false, or null when the CDN gave no usable answer. */
export async function portraitAlive(url: string, fetchFn: typeof fetch = fetch): Promise<boolean | null> {
	const known = verdicts.get(url);
	if (known !== undefined) return known;
	let verdict: boolean | null;
	try {
		const res = await fetchFn(url, { method: 'HEAD', signal: AbortSignal.timeout(TIMEOUT_MS) });
		verdict = res.ok ? true : res.status === 403 || res.status === 404 ? false : null;
	} catch {
		verdict = null;
	}
	if (verdict !== null) verdicts.set(url, verdict);
	return verdict;
}

/** Of `urls`, the ones the CDN says do not exist. Asked in parallel, each once per process. */
export async function deadPortraits(urls: Iterable<string>, fetchFn: typeof fetch = fetch): Promise<string[]> {
	const distinct = [...new Set(urls)];
	const alive = await Promise.all(distinct.map((u) => portraitAlive(u, fetchFn)));
	return distinct.filter((_, i) => alive[i] === false);
}

/** The profiles with a dead portrait forgotten, the rest as they were. */
export async function dropDeadPortraits<T extends { avatarUrl?: string }>(
	profiles: T[],
	fetchFn: typeof fetch = fetch
): Promise<T[]> {
	const urls = profiles.flatMap((p) => (p.avatarUrl ? [p.avatarUrl] : []));
	const dead = new Set(await deadPortraits(urls, fetchFn));
	if (!dead.size) return profiles;
	return profiles.map((p) => {
		if (!p.avatarUrl || !dead.has(p.avatarUrl)) return p;
		// the key goes, not just the value: the driver would store an undefined as null
		const { avatarUrl: _dead, ...rest } = p;
		return rest as T;
	});
}

/** For tests: forget every verdict. */
export function forgetPortraitVerdicts(): void {
	verdicts.clear();
}
