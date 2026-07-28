import { units } from '$lib/units';
import { mosList } from '$lib/mos';
import { dbConfigured, getClanMembers, getPlayerDirectory } from '$lib/server/db';
import { SITE_URL } from '$lib/seo';
import { sitemapXml, type SitemapUrl } from '$lib/sitemap';
import type { ClanMember } from '$lib/clans';
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
	{ path: '/entities', priority: 0.9 },
	{ path: '/mos', priority: 0.9 },
	{ path: '/players', priority: 0.8 },
	{ path: '/clans', priority: 0.7 },
	{ path: '/replays', priority: 0.6 },
	{ path: '/map', priority: 0.7 },
	{ path: '/flow', priority: 0.6 },
	{ path: '/si', priority: 0.7 },
	{ path: '/ranks', priority: 0.7 },
	{ path: '/medals', priority: 0.7 },
	{ path: '/camos', priority: 0.6 },
	{ path: '/companion', priority: 0.8 },
	{ path: '/changelog', priority: 0.4 },
	{ path: '/feedback', priority: 0.3 }
];

export const GET: RequestHandler = async ({ setHeaders }) => {
	const urls: SitemapUrl[] = [
		...STATIC,
		...mosList.map((m) => ({ path: `/mos/${encodeURIComponent(m.id)}`, priority: 0.8 })),
		...units.map((u) => ({ path: `/entities/${encodeURIComponent(u.id)}`, priority: 0.5 }))
	];

	/* Individual replays are deliberately absent: one page per game, growing
	   with every upload, and every one of them noindex. */
	if (dbConfigured()) {
		const [directory, clanMembers] = await Promise.all([
			getPlayerDirectory(),
			getClanMembers() as Promise<unknown> as Promise<ClanMember[]>
		]);
		for (const { toon } of Object.values(directory))
			urls.push({ path: `/players/${encodeURIComponent(toon)}`, priority: 0.4 });
		const tags = new Set(clanMembers.map((m) => m.clan).filter(Boolean));
		for (const tag of tags)
			urls.push({ path: `/clans/${encodeURIComponent(tag)}`, priority: 0.4 });
	}

	setHeaders({
		'content-type': 'application/xml; charset=utf-8',
		'cache-control': `public, max-age=${MAX_AGE}`
	});
	return new Response(sitemapXml(SITE_URL, urls));
};
