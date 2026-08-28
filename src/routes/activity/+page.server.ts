import { dbConfigured, getAvatarsByToon, getNamesByToon } from '$lib/server/db';
import { listNotifications, markAllRead } from '$lib/server/notifications';
import { recentComments } from '$lib/server/activity';
import type { BuildAuthor } from '$lib/builds';
import type { PageServerLoad } from './$types';

/**
 * What is being said, and what a player was told: the newest comments
 * across every thread on the site, for whoever wants to see what moves,
 * beside the player's own notifications (a comment on their guide, an
 * answer to their comment), newest first. Opening the page reads the
 * notifications: what is unread when it loads is drawn as new, and the bell
 * goes back to nothing. The activity column needs no sign-in.
 */
export const prerender = false;

/** How many of each the page shows. */
const NOTIFICATIONS = 50;
const ACTIVITY = 30;


export const load: PageServerLoad = async ({ locals, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	const session = locals.session;
	if (!dbConfigured()) return { signedIn: session !== null, enabled: false, mine: [], activity: [] };

	const [told, activity, names, avatars] = await Promise.all([
		session ? listNotifications(session.sub, NOTIFICATIONS) : Promise.resolve([]),
		recentComments(ACTIVITY),
		getNamesByToon(),
		getAvatarsByToon()
	]);
	const who = (a: BuildAuthor) => ({
		name: (a.toon && names[a.toon]) || a.battletag.replace(/#\d+$/, ''),
		toon: a.toon ?? null,
		avatar: (a.toon && avatars[a.toon]) || null
	});

	const mine = told.map((n) => ({
		id: n._id,
		kind: n.kind,
		at: n.at,
		unread: !n.readAt,
		...who(n.by),
		excerpt: n.excerpt,
		subject: n.subject,
		href: n.subject.kind === 'chat' ? `${n.subject.href}#m-${n.comment}` : `${n.subject.href}#c-${n.comment}`
	}));
	// what is unread when the page loads is what the page shows as new; from here on it is read
	if (session && mine.some((n) => n.unread)) await markAllRead(session.sub);

	return { signedIn: session !== null, enabled: true, mine, activity };
};
