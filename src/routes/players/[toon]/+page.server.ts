import { getAvatarsByToon, getTeammates } from '$lib/server/db';
import type { PageServerLoad } from './$types';

/**
 * The overview's own slice: who this player shares games with.
 *
 * The profile itself, and every figure the infobox restates, come from the
 * layout — see +layout.server.ts. Nothing here is read by the other three
 * tabs, which is the whole reason it is loaded here and not there.
 */
export const prerender = false;

export const load: PageServerLoad = async ({ params }) => {
	const [teammates, avatars] = await Promise.all([getTeammates(params.toon), getAvatarsByToon()]);
	return {
		teammates: teammates.map((t) => ({ ...t, avatarUrl: avatars[t.toon] ?? null }))
	};
};
