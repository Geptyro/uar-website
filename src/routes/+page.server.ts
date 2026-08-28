import { recentActivity, type ActivityItem } from '$lib/server/activity';
import {
	dbConfigured,
	getActivityReplays,
	getAvatarsByToon,
	getRecentReplays,
	getWeeklyBoards
} from '$lib/server/db';
import { longestGame } from '$lib/server/weekly';
import { activityTimeline, type ActivityGame, type ActivityTimeline } from '$lib/activity';
import { bnetConfigured } from '$lib/server/bnet';
import type { ReplayMeta, WeeklyBoards } from '$lib/players';
import type { PageServerLoad } from './$types';

// the weekly boards are live data — opt the homepage out of the site-wide prerender
export const prerender = false;

const EMPTY: WeeklyBoards = {
	xp: [],
	prestiged: [],
	classPicks: [],
	games: { played: 0, won: 0, lost: 0 }
};

/** Set on the first view of this page, so the "new here" strip shows once. */
const WELCOMED = 'uar_welcomed';
const WELCOMED_MAX_AGE_S = 365 * 24 * 3600;

/** Games listed by the Last games widget. */
const RECENT = 5;

/** Trailing window of the activity chart — the query and the chart must agree. */
const ACTIVITY_DAYS = 7;
/** How many rows of activity the home page lists: guides and comments that moved last. */
const RECENT_ACTIVITY = 8;

export const load: PageServerLoad = async ({ locals, cookies }) => {
	// The "new here" strip is for a first visit: no account, no earlier view
	// of this page on record. The cookie is written now, from the server,
	// rather than after paint — the next load then renders without the strip
	// from the start instead of showing it and folding it away on hydration.
	const welcome = !locals.session && !cookies.get(WELCOMED);
	if (welcome)
		cookies.set(WELCOMED, '1', { path: '/', maxAge: WELCOMED_MAX_AGE_S, sameSite: 'lax' });
	// The sign-in card in the rail. Server-side rather than the layout's
	// client-side /api/me, because this page is SSR anyway and a card that
	// pops into the column a moment after paint (or worse, shows "connect" to
	// someone already signed in) is the one thing it must not do. Same gate as
	// /account: no point advertising a login this server cannot perform.
	const showConnect = !locals.session && bnetConfigured() && dbConfigured();
	if (!dbConfigured())
		return {
			showConnect,
			welcome,
			weekly: EMPTY,
			avatars: {} as Record<string, string>,
			activity: { start: 0, values: [] } as ActivityTimeline,
			longest: null as ActivityGame | null,
			recent: [] as ReplayMeta[],
			community: [] as ActivityItem[]
		};
	// two narrow reads rather than the whole archive: the chart only looks at a
	// trailing window, and the widget only at the newest handful
	const [weekly, avatars, activity, recent, community] = await Promise.all([
		getWeeklyBoards(),
		getAvatarsByToon(),
		getActivityReplays(ACTIVITY_DAYS),
		getRecentReplays(RECENT),
		recentActivity(RECENT_ACTIVITY)
	]);
	const now = new Date();
	return {
		showConnect,
		welcome,
		weekly,
		avatars,
		activity: activityTimeline(activity, now, ACTIVITY_DAYS),
		// the week's longest game, off the list the chart already reads
		longest: longestGame(activity, now),
		// getRecentReplays already sorts newest first, as the widget shows them
		recent,
		// guides and comments that moved last, as one feed
		community
	};
};
