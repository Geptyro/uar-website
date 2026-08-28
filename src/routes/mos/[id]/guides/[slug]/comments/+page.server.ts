import { error } from '@sveltejs/kit';
import { dbConfigured } from '$lib/server/db';
import { buildHost, getBuild } from '$lib/server/builds';
import { isAdmin } from '$lib/server/admins';
import { loadThread, threadActions, type ThreadScope } from '$lib/server/comments';
import { buildHref } from '$lib/builds';
import type { PageServerLoad, RequestEvent } from './$types';

/**
 * The thread under a guide: the shared thread ($lib/server/comments) with
 * the guide as its subject. Open while the guide is out; its author's
 * comments carry the OP mark.
 */
export const prerender = false;

async function scope(event: RequestEvent): Promise<ThreadScope> {
	if (!dbConfigured()) error(404, 'Guides are not available here.');
	const { id, slug } = event.params;
	const session = event.locals.session;
	const build = await getBuild(id, slug);
	const isAuthor = session !== null && build?.author.sub === session.sub;
	const admin = isAdmin(session);
	if (!build || (build.status !== 'published' && !isAuthor && !admin)) error(404, 'No such guide.');
	return {
		host: buildHost(build),
		mos: build.mos,
		session,
		admin,
		open: build.status === 'published',
		op: build.author.sub,
		owner: build.author.sub,
		subject: { kind: 'guide', title: build.title, href: `${buildHref(build.mos, build.slug)}/comments` }
	};
}

export const load: PageServerLoad = async (event) => loadThread(await scope(event), event.url);

export const actions = threadActions(scope);
