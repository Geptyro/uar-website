import { dbConfigured, getAvatarsByToon, getWeeklyBoards } from '$lib/server/db';
import type { WeeklyBoards } from '$lib/players';
import type { PageServerLoad } from './$types';

// the weekly boards are live data — opt the homepage out of the site-wide prerender
export const prerender = false;

const EMPTY: WeeklyBoards = { xp: [], prestiged: [], classPicks: [] };

export const load: PageServerLoad = async () => {
	if (!dbConfigured()) return { weekly: EMPTY, avatars: {} as Record<string, string> };
	const [weekly, avatars] = await Promise.all([getWeeklyBoards(), getAvatarsByToon()]);
	return { weekly, avatars };
};
