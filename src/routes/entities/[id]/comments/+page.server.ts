import { error } from '@sveltejs/kit';
import { dbConfigured } from '$lib/server/db';
import { entityHost } from '$lib/server/builds';
import { isAdmin } from '$lib/server/admins';
import { loadThread, threadActions, type ThreadScope } from '$lib/server/comments';
import { unitById } from '$lib/units';
import { entityHref } from '$lib/entityTabs';
import { displayName } from '$lib/ogcard';
import type { PageServerLoad, RequestEvent } from './$types';

/**
 * An entity's thread: what players say about the thing itself. The shared
 * thread ($lib/server/comments) with the entity as its subject, always open,
 * nobody's OP; chips resolve against the whole game, no class in particular.
 * Server-rendered, unlike the sheet: the conversation moves without a deploy.
 */
export const prerender = false;

async function scope(event: RequestEvent): Promise<ThreadScope> {
	if (!dbConfigured()) error(404, 'Comments are not available here.');
	const unit = unitById.get(event.params.id);
	if (!unit) error(404, `No unit with id "${event.params.id}"`);
	const session = event.locals.session;
	return {
		host: entityHost(unit.id),
		mos: null,
		session,
		admin: isAdmin(session),
		open: true,
		subject: { kind: 'entity', title: displayName(unit.name) || unit.id, href: entityHref(unit.id, 'comments') }
	};
}

export const load: PageServerLoad = async (event) => {
	if (event.locals.session) event.setHeaders({ 'cache-control': 'private, no-store' });
	const sc = await scope(event);
	return { ...(await loadThread(sc, event.url)), admin: sc.admin };
};

export const actions = threadActions(scope);
