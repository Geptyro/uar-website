import { dbConfigured, getAvatarsByToon, getMosBoard, getMosWeek } from '$lib/server/db';
import type { PageServerLoad } from './$types';

/**
 * Who plays this class — from the stored per-class board (see
 * $lib/server/playtime.ts), which the upload pipeline recomputes; one small
 * `meta` doc, not a scan of the archive.
 *
 * Server-rendered, unlike the rest of the class page: the board is a fact
 * about the archive, and it moves with every upload.
 */
export const prerender = false;

export const load: PageServerLoad = async ({ params }) => {
	if (!dbConfigured()) return { board: null, week: null, avatars: {} as Record<string, string> };
	const [board, week, avatars] = await Promise.all([
		getMosBoard(params.id),
		getMosWeek(params.id),
		getAvatarsByToon()
	]);
	return { board, week, avatars };
};
