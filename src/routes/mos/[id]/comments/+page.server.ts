import { error } from '@sveltejs/kit';
import { dbConfigured } from '$lib/server/db';
import { mosHost } from '$lib/server/builds';
import { isAdmin } from '$lib/server/admins';
import { loadThread, threadActions, type ThreadScope } from '$lib/server/comments';
import { mosById } from '$lib/mos';
import type { PageServerLoad, RequestEvent } from './$types';

/**
 * The class's own thread: what players say about the class itself, rather
 * than about one guide for it. The shared thread ($lib/server/comments) with
 * the class as its subject, always open, nobody's OP. Server-rendered, like
 * the players and guides tabs: the conversation moves without a deploy.
 */
export const prerender = false;

async function scope(event: RequestEvent): Promise<ThreadScope> {
	if (!dbConfigured()) error(404, 'Comments are not available here.');
	const mos = mosById.get(event.params.id);
	if (!mos) error(404, `No MOS class with id "${event.params.id}"`);
	const session = event.locals.session;
	return {
		host: mosHost(mos.id),
		mos: mos.id,
		session,
		admin: isAdmin(session),
		open: true,
		subject: { kind: 'mos', title: mos.name, href: `/mos/${encodeURIComponent(mos.id)}/comments` }
	};
}

export const load: PageServerLoad = async (event) => {
	if (event.locals.session) event.setHeaders({ 'cache-control': 'private, no-store' });
	const sc = await scope(event);
	return { ...(await loadThread(sc, event.url)), admin: sc.admin };
};

export const actions = threadActions(scope);
