import { listedUnits as units } from '$lib/units';
import { mosById, mosList } from '$lib/mos';
import { groupHref, groupIds } from '$lib/groups';
import { mosTabHref, vehicleSlug } from '$lib/mosTabs';
import { dbConfigured, getClanMembers, getPlayerSitemap } from '$lib/server/db';
import { SITE_URL } from '$lib/seo';
import { sitemapDate, sitemapXml, type SitemapUrl } from 'sveltekit-commons/sitemap';
import { releaseMonths } from '$lib/changelog';
import { buildClans, type ClanMember } from '$lib/clans';
import type { RequestHandler } from './$types';

/* Player and clan profiles are database rows, so this one route cannot join
   the site-wide prerender. Both reads are cached (and the clan one is warmed
   at boot), so a crawler asking for the sitemap costs nothing the pages it
   lists were not going to cost anyway. */
export const prerender = false;

/** How long a crawler may reuse a copy. The wiki half only moves on deploy. */
const MAX_AGE = 3600;

/** The pages that are not generated from a list. */
const STATIC: SitemapUrl[] = [
	{ path: '/', priority: 1 },
	{ path: '/guide', priority: 0.9 },
	{ path: '/entities', priority: 0.9 },
	{ path: '/mos', priority: 0.9 },
	{ path: '/players', priority: 0.8 },
	{ path: '/clans', priority: 0.7 },
	{ path: '/replays', priority: 0.6 },
	{ path: '/triggers', priority: 0.7 },
	{ path: '/map', priority: 0.7 },
	{ path: '/career', priority: 0.7 },
	{ path: '/career/si', priority: 0.7 },
	{ path: '/career/medals', priority: 0.7 },
	{ path: '/career/camos', priority: 0.6 },
	{ path: '/companion', priority: 0.8 },
	{ path: '/changelog', priority: 0.4 },
	{ path: '/feedback', priority: 0.3 }
];

/* One page per month of releases, read off the release.json files: the cheap
   glob, so listing them does not pull every entry's prose into this chunk. */
const changelogMonths: SitemapUrl[] = releaseMonths(
	import.meta.glob('/changelog/v*/release.json', { eager: true, import: 'default' }) as Record<
		string,
		{ date?: string }
	>
).map((month) => ({ path: `/changelog/${month}`, priority: 0.3 }));

export const GET: RequestHandler = async ({ setHeaders }) => {
	/* The wiki half carries no lastmod on purpose. Its pages change when the
	   extractor is re-run, and nothing on disk records when that was — a git
	   date is unavailable in the image, and a file mtime is the checkout's,
	   which would claim all 505 changed on every deploy. Google leans on
	   lastmod only while it proves accurate, and discounts a sitemap that
	   cries wolf, so the honest thing is to say nothing for these. */
	/* A class page and its tabs. The players tab is left out: it is a board that
	   moves with every upload, and it says so on the page rather than in a
	   sitemap that would have to keep up with it. */
	const classPages: SitemapUrl[] = mosList.flatMap((m) => [
		{ path: mosTabHref(m.id), priority: 0.8 },
		{ path: mosTabHref(m.id, 'gear'), priority: 0.5 },
		...(m.vehicle && mosById.get(m.vehicle)
			? [{ path: mosTabHref(m.id, vehicleSlug(mosById.get(m.vehicle)!.name)), priority: 0.6 }]
			: []),
		{ path: mosTabHref(m.id, 'guides'), priority: 0.6 }
	]);
	const urls: SitemapUrl[] = [
		...STATIC,
		...changelogMonths,
		...classPages,
		...groupIds.flatMap((id) => [
			{ path: groupHref(id), priority: 0.7 },
			{ path: `${groupHref(id)}/flow`, priority: 0.5 }
		]),
		...units.map((u) => ({ path: `/entities/${encodeURIComponent(u.id)}`, priority: 0.5 }))
	];

	/* The player and clan halves do have a real per-page date, and it is worth
	   the most here: most of the 850-odd profiles sit still for weeks, so a
	   crawler that can tell which ones moved stops re-reading the rest — and
	   every one of those reads comes out of a small Atlas budget.

	   Individual replays are deliberately absent: one page per game, growing
	   with every upload, and every one of them noindex. */
	if (dbConfigured()) {
		const [players, clanMembers] = await Promise.all([
			getPlayerSitemap(),
			getClanMembers() as Promise<unknown> as Promise<ClanMember[]>
		]);
		for (const { toon, lastSeen } of players)
			urls.push({
				path: `/players/${encodeURIComponent(toon)}`,
				lastmod: sitemapDate(lastSeen),
				priority: 0.4
			});
		// buildClans already reduces each roster to its newest sighting
		for (const clan of buildClans(clanMembers))
			urls.push({
				path: `/clans/${encodeURIComponent(clan.tag)}`,
				lastmod: sitemapDate(clan.lastSeen),
				priority: 0.4
			});
	}

	setHeaders({
		'content-type': 'application/xml; charset=utf-8',
		'cache-control': `public, max-age=${MAX_AGE}`
	});
	return new Response(sitemapXml(SITE_URL, urls));
};
