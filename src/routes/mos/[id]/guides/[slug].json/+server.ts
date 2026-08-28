/**
 * A guide as a document: what a player hands to an AI ("make me one like
 * this") or keeps as a backup, and what the editor's Import takes back. The
 * format it follows is linked in the first field, so the two travel together.
 * Published builds only, for anyone; the author's own drafts too.
 */

import { error, json } from '@sveltejs/kit';
import { dbConfigured } from '$lib/server/db';
import { getBuild } from '$lib/server/builds';
import { FORMAT_VERSION, formatHref, type BuildExport } from '$lib/buildFormat';
import { SCHEMA_URL } from '$lib/buildSchema';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async ({ params, locals, setHeaders }) => {
	if (!dbConfigured()) error(404, 'Not found');
	const build = await getBuild(params.id, params.slug);
	const own = locals.session !== null && build?.author.sub === locals.session.sub;
	if (!build || (build.status !== 'published' && !own)) error(404, 'No such guide.');
	if (!own) setHeaders({ 'cache-control': 'public, max-age=300' });
	const out: BuildExport = {
		$schema: SCHEMA_URL,
		format: formatHref(build.mos),
		version: FORMAT_VERSION,
		mos: build.mos,
		slug: build.slug,
		title: build.title,
		modes: build.modes,
		ranks: build.ranks,
		skills: build.skills,
		sis: build.sis,
		blocks: build.blocks
	};
	return json(out, {
		headers: { 'content-disposition': `inline; filename="${build.mos}-${build.slug}.json"` }
	});
};
