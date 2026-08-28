import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { rateLimiter } from 'sveltekit-commons/rate-limit';
import { dbConfigured, getAvatarsByToon, insertFeedback } from '$lib/server/db';
import { playerCards } from '$lib/server/playerCards';
import { allText, playerRefsIn } from '$lib/builds';
import {
	canPublish,
	deleteBuild,
	getBuild,
	myBuildVote,
	setBuildStatus,
	voteBuild
} from '$lib/server/builds';
import { announceBuild } from '$lib/server/buildForm';
import { isAdmin } from '$lib/server/admins';
import { renderBlocks } from '$lib/buildRender';
import { refResolver } from '$lib/buildRefs';
import { buildHref } from '$lib/builds';
import { mosById, mosHref } from '$lib/mos';
import { SITE_URL } from '$lib/seo';
import type { Actions, PageServerLoad } from './$types';

export const prerender = false;

const votes = rateLimiter({ limit: 60, windowMs: 60 * 60 * 1000 });
const reports = rateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 });

/** The guide behind this URL, and what the viewer is to it. */
async function context(event: Pick<RequestEvent, 'params' | 'locals'>) {
	if (!dbConfigured()) error(404, 'Guides are not available here.');
	const { id, slug } = event.params as { id: string; slug: string };
	const session = event.locals.session;
	const build = await getBuild(id, slug);
	const isAuthor = session !== null && build?.author.sub === session.sub;
	const admin = isAdmin(session);
	// a draft or a hidden build is a page for its author and the maintainer;
	// to anyone else it does not exist, rather than exists and is refused
	if (!build || (build.status !== 'published' && !isAuthor && !admin)) {
		error(404, 'No such guide.');
	}
	return { build, session, isAuthor, admin };
}

export const load: PageServerLoad = async (event) => {
	const { build, session, isAuthor } = await context(event);
	const [avatars, players] = await Promise.all([getAvatarsByToon(), playerCards(playerRefsIn(allText(build.blocks)))]);
	const blocks = renderBlocks(build.blocks, refResolver(build.mos, { avatars, players }));
	const vote = session && !isAuthor ? await myBuildVote(build._id, session.sub) : 0;
	return { blocks, vote };
};

export const actions: Actions = {
	vote: async (event) => {
		const { build, session, isAuthor } = await context(event);
		if (!session) return fail(401, { error: 'Sign in with Battle.net to vote.' });
		if (isAuthor) return fail(400, { error: 'Your own guide is helpful by definition.' });
		if (build.status !== 'published') return fail(400, { error: 'Not published.' });
		if (!votes.hit(session.sub)) return fail(429, { error: 'Slow down a little.' });
		const form = await event.request.formData();
		const dir = Number(form.get('dir'));
		if (dir !== 1 && dir !== -1 && dir !== 0) return fail(400, { error: 'Up, down, or neither.' });
		const tally = await voteBuild(build, session.sub, dir);
		return { vote: dir, ...tally };
	},

	report: async (event) => {
		const { build, session } = await context(event);
		const form = await event.request.formData();
		const reason = String(form.get('reason') ?? '')
			.trim()
			.slice(0, 500);
		if (reason.length < 5) return fail(400, { error: 'Say what is wrong with it, in a few words.' });
		if (!reports.hit(event.getClientAddress())) return fail(429, { error: 'Enough reports for now.' });
		await insertFeedback({
			createdAt: new Date().toISOString(),
			message: `Report on guide ${SITE_URL}${buildHref(build.mos, build.slug)}\n"${build.title}" by ${build.author.battletag}\n\n${reason}`,
			name: session?.battletag ?? 'anonymous'
		});
		return { reported: true };
	},

	publish: async (event) => {
		const { build, session, isAuthor } = await context(event);
		if (!session || !isAuthor) return fail(403, { error: 'Not yours.' });
		if (build.status !== 'draft') return fail(400, { error: 'Not a draft.' });
		if (!(await canPublish(session))) {
			return fail(403, {
				error: 'Publishing needs a linked profile that has been seen in an uploaded replay.'
			});
		}
		await setBuildStatus(build, 'published');
		const mos = mosById.get(build.mos);
		if (mos) announceBuild({ ...build, status: 'published' }, mos);
		return { published: true };
	},

	unpublish: async (event) => {
		const { build, isAuthor } = await context(event);
		if (!isAuthor) return fail(403, { error: 'Not yours.' });
		if (build.status !== 'published') return fail(400, { error: 'Not published.' });
		await setBuildStatus(build, 'draft');
		return { published: false };
	},

	hide: async (event) => {
		const { build, admin } = await context(event);
		if (!admin) return fail(403, { error: 'Maintainer only.' });
		await setBuildStatus(build, 'hidden');
		return { hidden: true };
	},

	unhide: async (event) => {
		const { build, admin } = await context(event);
		if (!admin) return fail(403, { error: 'Maintainer only.' });
		await setBuildStatus(build, 'published');
		return { hidden: false };
	},

	delete: async (event) => {
		const { build, isAuthor, admin } = await context(event);
		if (!isAuthor && !admin) return fail(403, { error: 'Not yours.' });
		await deleteBuild(build);
		redirect(303, mosHref(build.mos, 'guides'));
	}
};
