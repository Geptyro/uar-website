import { error } from '@sveltejs/kit';
import { dbConfigured, getAvatarsByToon, getNamesByToon, getPlayerSummary } from '$lib/server/db';
import { getBuild } from '$lib/server/builds';
import { isAdmin } from '$lib/server/admins';
import { publicBuild } from '$lib/builds';
import type { LayoutServerLoad } from './$types';

/**
 * The frame of one guide, inside the class's: who wrote it, its state, what
 * the viewer may do with it. Its tabs (View, Edit) each add their own slice.
 * A draft or a hidden build is a page for its author and the maintainer; to
 * anyone else it does not exist, rather than exists and is refused.
 */
export const prerender = false;

/**
 * Who wrote it, the way the site names a player everywhere else: the in-game
 * name (and clan) the toon last played under, from the player record; the
 * Battle.net profile name if the toon has no games on record; the battletag
 * without its number if there is no toon at all. Looked up on read rather
 * than stored, so a rename shows on old builds too.
 */
async function authorName(author: { battletag: string; toon?: string }) {
	const fallback = author.battletag.replace(/#\d+$/, '');
	if (!author.toon) return { name: fallback, clan: '', toon: null, avatar: null };
	const [player, avatars] = await Promise.all([
		getPlayerSummary(author.toon) as Promise<{ name?: string; clan?: string } | null>,
		getAvatarsByToon()
	]);
	const avatar = avatars[author.toon] ?? null;
	if (player?.name) return { name: player.name, clan: player.clan ?? '', toon: author.toon, avatar };
	const names = await getNamesByToon();
	return { name: names[author.toon] ?? fallback, clan: '', toon: author.toon, avatar };
}

export const load: LayoutServerLoad = async ({ params, locals, setHeaders }) => {
	if (!dbConfigured()) error(404, 'Guides are not available here.');
	const session = locals.session;
	if (session) setHeaders({ 'cache-control': 'private, no-store' });
	const build = await getBuild(params.id, params.slug);
	const isAuthor = session !== null && build?.author.sub === session.sub;
	const admin = isAdmin(session);
	if (!build || (build.status !== 'published' && !isAuthor && !admin)) error(404, 'No such guide.');
	const { blocks: _blocks, ...rest } = build;
	return {
		build: publicBuild(rest),
		author: await authorName(build.author),
		viewer: { signedIn: session !== null, isAuthor, admin }
	};
};
