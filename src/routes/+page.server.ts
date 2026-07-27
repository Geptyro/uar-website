import { dbConfigured, getAvatarsByToon, getReplaysList, getWeeklyBoards } from '$lib/server/db';
import { activityTimeline, type ActivityTimeline } from '$lib/activity';
import type { ReplayMeta, WeeklyBoards } from '$lib/players';
import type { PageServerLoad } from './$types';

// the weekly boards are live data — opt the homepage out of the site-wide prerender
export const prerender = false;

const EMPTY: WeeklyBoards = { xp: [], prestiged: [], classPicks: [] };

/** Games listed by the Last games widget. */
const RECENT = 5;

export const load: PageServerLoad = async () => {
	if (!dbConfigured())
		return {
			weekly: EMPTY,
			avatars: {} as Record<string, string>,
			activity: { start: 0, values: [] } as ActivityTimeline,
			recent: [] as ReplayMeta[]
		};
	const [weekly, avatars, replays] = await Promise.all([
		getWeeklyBoards(),
		getAvatarsByToon(),
		getReplaysList()
	]);
	return {
		weekly,
		avatars,
		activity: activityTimeline(replays, new Date()),
		// the list comes out of the db oldest-first; the widget leads with the newest
		recent: replays.slice(-RECENT).reverse()
	};
};
