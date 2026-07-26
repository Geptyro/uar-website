import { dbConfigured, getAvatarsByToon, getReplaysList, getWeeklyBoards } from '$lib/server/db';
import { activityTimeline, type ActivityTimeline } from '$lib/activity';
import type { WeeklyBoards } from '$lib/players';
import type { PageServerLoad } from './$types';

// the weekly boards are live data — opt the homepage out of the site-wide prerender
export const prerender = false;

const EMPTY: WeeklyBoards = { xp: [], prestiged: [], classPicks: [] };

export const load: PageServerLoad = async () => {
	if (!dbConfigured())
		return {
			weekly: EMPTY,
			avatars: {} as Record<string, string>,
			activity: { start: 0, values: [] } as ActivityTimeline
		};
	const [weekly, avatars, replays] = await Promise.all([
		getWeeklyBoards(),
		getAvatarsByToon(),
		getReplaysList()
	]);
	return { weekly, avatars, activity: activityTimeline(replays, new Date()) };
};
