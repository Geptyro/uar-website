import {
	dbConfigured,
	getActivityReplays,
	getAvatarsByToon,
	getRecentReplays,
	getWeeklyBoards
} from '$lib/server/db';
import { activityTimeline, type ActivityTimeline } from '$lib/activity';
import type { ReplayMeta, WeeklyBoards } from '$lib/players';
import type { PageServerLoad } from './$types';

// the weekly boards are live data — opt the homepage out of the site-wide prerender
export const prerender = false;

const EMPTY: WeeklyBoards = { xp: [], prestiged: [], classPicks: [] };

/** Games listed by the Last games widget. */
const RECENT = 5;

/** Trailing window of the activity chart — the query and the chart must agree. */
const ACTIVITY_DAYS = 7;

export const load: PageServerLoad = async () => {
	if (!dbConfigured())
		return {
			weekly: EMPTY,
			avatars: {} as Record<string, string>,
			activity: { start: 0, values: [] } as ActivityTimeline,
			recent: [] as ReplayMeta[]
		};
	// two narrow reads rather than the whole archive: the chart only looks at a
	// trailing window, and the widget only at the newest handful
	const [weekly, avatars, activity, recent] = await Promise.all([
		getWeeklyBoards(),
		getAvatarsByToon(),
		getActivityReplays(ACTIVITY_DAYS),
		getRecentReplays(RECENT)
	]);
	return {
		weekly,
		avatars,
		activity: activityTimeline(activity, new Date(), ACTIVITY_DAYS),
		// getRecentReplays already sorts newest first, as the widget shows them
		recent
	};
};
