import { error, fail, redirect } from '@sveltejs/kit';
import { dbConfigured } from '$lib/server/db';
import { canPublish, getBuild, updateBuild } from '$lib/server/builds';
import { announceBuild, parseBuildForm, valuesOf } from '$lib/server/buildForm';
import { mosById } from '$lib/mos';
import { buildHref } from '$lib/builds';
import type { Actions, PageServerLoad } from './$types';

export const prerender = false;

// the guide layout already answers with `private, no-store` for a session
export const load: PageServerLoad = async ({ params, locals }) => {
	if (!dbConfigured()) error(404, 'Guides are not available here.');
	const session = locals.session;
	const build = await getBuild(params.id, params.slug);
	// someone else's build has no editor, and says so no more than a wrong URL would
	if (!build || !session || build.author.sub !== session.sub) error(404, 'No such guide.');
	return {
		// the editor's fields; `build` from the layout carries the rest
		values: {
			title: build.title,
			modes: build.modes,
			ranks: build.ranks,
			skills: build.skills,
			sis: build.sis,
			blocks: build.blocks
		},
		mayPublish: await canPublish(session)
	};
};

export const actions: Actions = {
	default: async ({ request, params, locals }) => {
		const session = locals.session;
		if (!session) return fail(401, { error: 'Your sign-in has ended. Sign in again, then save.' });
		if (!dbConfigured()) return fail(503, { error: 'Guides are not available on this deployment.' });
		const mos = mosById.get(params.id);
		if (!mos) error(404, `No MOS class with id "${params.id}"`);
		const build = await getBuild(params.id, params.slug);
		if (!build || build.author.sub !== session.sub) error(404, 'No such guide.');

		const parsed = await parseBuildForm(request, mos, session.sub);
		if (!parsed.ok) return parsed.failure;
		const values = valuesOf(parsed.value);
		if (build.status === 'draft' && parsed.value.publish && !(await canPublish(session))) {
			return fail(403, {
				error:
					'Publishing needs a linked profile that has been seen in an uploaded replay. Saved as a draft instead? Use "Save draft".',
				values
			});
		}

		let saved;
		try {
			saved = await updateBuild(build, parsed.value);
		} catch (e) {
			console.error('[builds] update failed:', e);
			return fail(503, { error: 'Could not save that just now. Try again.', values });
		}
		if (build.status === 'draft' && saved.status === 'published') announceBuild(saved, mos);
		redirect(303, buildHref(mos.id, saved.slug));
	}
};
