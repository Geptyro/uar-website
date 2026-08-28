import { dbConfigured, getAvatarsByToon, getNamesByToon } from '$lib/server/db';
import { canPublish, listBuilds, listBuildsBy } from '$lib/server/builds';
import { publicBuild, type BuildListing } from '$lib/builds';
import type { PageServerLoad } from './$types';

/**
 * What players have written for this class. Server-rendered, like the players
 * tab: the list moves with every save, not with a deploy.
 *
 * A signed-in author also sees their own drafts and anything the maintainer
 * has hidden, which is theirs alone to see, hence the private cache header
 * whenever there is a session.
 */
export const prerender = false;

export const load: PageServerLoad = async ({ params, locals, setHeaders }) => {
	const session = locals.session;
	if (session) setHeaders({ 'cache-control': 'private, no-store' });
	if (!dbConfigured()) return { enabled: false, builds: [], mine: [], viewer: null };
	const [builds, mine, mayPublish, names, avatars] = await Promise.all([
		listBuilds(params.id),
		session ? listBuildsBy(session.sub, params.id) : Promise.resolve([]),
		session ? canPublish(session) : Promise.resolve(false),
		getNamesByToon(),
		getAvatarsByToon()
	]);
	// the author as the site names players: profile name by toon, else the battletag
	const named = (b: BuildListing) => ({
		...publicBuild(b),
		authorName: (b.author.toon && names[b.author.toon]) || b.author.battletag.replace(/#\d+$/, ''),
		authorAvatar: (b.author.toon && avatars[b.author.toon]) || null
	});
	return {
		enabled: true,
		builds: builds.map(named),
		// the published ones are in the list already; this is the rest
		mine: mine.filter((b) => b.status !== 'published').map(named),
		viewer: session ? { battletag: session.battletag, mayPublish } : null
	};
};
