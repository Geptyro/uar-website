import { error, fail, redirect } from '@sveltejs/kit';
import { rateLimiter } from 'sveltekit-commons/rate-limit';
import { dbConfigured } from '$lib/server/db';
import { canPublish, createBuild } from '$lib/server/builds';
import { announceBuild, authorOf, parseBuildForm, valuesOf } from '$lib/server/buildForm';
import { mosById } from '$lib/mos';
import { buildHref } from '$lib/builds';
import type { Actions, PageServerLoad } from './$types';

export const prerender = false;

/**
 * New guides per account and day. Generous for a person, since a guide is
 * an hour's writing; what it stops is a script. In memory, like the other
 * flood guards (see CLAUDE.md).
 */
const creates = rateLimiter({ limit: 5, windowMs: 24 * 60 * 60 * 1000 });

export const load: PageServerLoad = async ({ locals, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	const session = locals.session;
	if (!session) return { viewer: null, mayPublish: false };
	return {
		viewer: { battletag: session.battletag },
		mayPublish: dbConfigured() ? await canPublish(session) : false
	};
};

export const actions: Actions = {
	default: async ({ request, params, locals }) => {
		const session = locals.session;
		if (!session) return fail(401, { error: 'Sign in with Battle.net to write a guide.' });
		if (!dbConfigured()) return fail(503, { error: 'Guides are not available on this deployment.' });
		const mos = mosById.get(params.id);
		if (!mos || mos.pilotedBy) error(404, `No MOS class with id "${params.id}"`);

		const parsed = await parseBuildForm(request, mos, session.sub);
		if (!parsed.ok) return parsed.failure;
		const values = valuesOf(parsed.value);

		if (parsed.value.publish && !(await canPublish(session))) {
			return fail(403, {
				error:
					'Publishing needs a linked profile that has been seen in an uploaded replay. Save it as a draft for now.',
				values
			});
		}
		if (!creates.allows(session.sub)) {
			return fail(429, { error: 'That is a lot of guides for one day. Try again tomorrow.', values });
		}

		let doc;
		try {
			doc = await createBuild(mos.id, parsed.value, authorOf(session));
		} catch (e) {
			// the text only exists in this request: echo it back rather than
			// render an error page that no longer has it (see the feedback form)
			console.error('[builds] create failed:', e);
			return fail(503, { error: 'Could not save that just now. Try again.', values });
		}
		creates.record(session.sub);
		if (doc.status === 'published') announceBuild(doc, mos);
		redirect(303, buildHref(mos.id, doc.slug));
	}
};
