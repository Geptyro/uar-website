/**
 * What moved last on the community side: guides published or edited, and
 * comments said anywhere, each as a row a widget can draw. The home page
 * shows a handful of both in one feed; the notifications page lists the
 * comments at length. Read from the same two narrow queries (see
 * $lib/server/builds) and the same name and portrait lookups.
 */
import { cached, getAvatarsByToon, getNamesByToon } from './db';
import { getBuildsByIds, listRecentBuilds, listRecentComments } from './builds';
import type { CommentSubject } from './notifications';
import { buildHref, excerptOf, type BuildAuthor } from '$lib/builds';
import { mosById } from '$lib/mos';
import { unitById } from '$lib/units';
import { entityHref } from '$lib/entityTabs';
import { displayName } from '$lib/ogcard';

export interface Who {
	/** As the site names players. */
	name: string;
	toon: string | null;
	avatar: string | null;
}

export interface GuideActivity extends Who {
	kind: 'guide';
	at: string;
	mos: string;
	slug: string;
	title: string;
	href: string;
	/** Published and not edited since. */
	fresh: boolean;
	ups: number;
	downs: number;
}

export interface CommentActivity extends Who {
	kind: 'comment';
	at: string;
	id: string;
	excerpt: string;
	subject: CommentSubject;
	/** The comment itself, on its thread's page. */
	href: string;
}

export type ActivityItem = GuideActivity | CommentActivity;

async function namer(): Promise<(a: BuildAuthor) => Who> {
	const [names, avatars] = await Promise.all([getNamesByToon(), getAvatarsByToon()]);
	return (a) => ({
		name: (a.toon && names[a.toon]) || a.battletag.replace(/#\d+$/, ''),
		toon: a.toon ?? null,
		avatar: (a.toon && avatars[a.toon]) || null
	});
}

/** The guides that moved last, newest first. */
export async function recentGuides(n: number): Promise<GuideActivity[]> {
	const [builds, who] = await Promise.all([listRecentBuilds(n), namer()]);
	return builds.map((b) => ({
		kind: 'guide',
		at: b.updatedAt,
		mos: b.mos,
		slug: b.slug,
		title: b.title,
		href: buildHref(b.mos, b.slug),
		// publishing stamps both dates alike: not touched since is new, touched since is an update
		fresh: !b.publishedAt || b.updatedAt <= b.publishedAt,
		ups: b.ups ?? 0,
		downs: b.downs ?? 0,
		...who(b.author)
	}));
}

/** The newest comments anywhere, each on the thread it is in; a thread nobody may see is left out. */
export async function recentComments(n: number): Promise<CommentActivity[]> {
	const [recent, who] = await Promise.all([listRecentComments(n), namer()]);
	const guideIds = [...new Set(recent.map((c) => c.build).filter((h) => !h.includes(':')))];
	const guides = new Map((await getBuildsByIds(guideIds)).map((b) => [b._id, b]));
	const subjectOf = (host: string): CommentSubject | null => {
		if (host.startsWith('mos:')) {
			const m = mosById.get(host.slice(4));
			return m ? { kind: 'mos', title: m.name, href: `/mos/${encodeURIComponent(m.id)}/comments` } : null;
		}
		if (host.startsWith('entity:')) {
			const u = unitById.get(host.slice(7));
			return u ? { kind: 'entity', title: displayName(u.name) || u.id, href: entityHref(u.id, 'comments') } : null;
		}
		const b = guides.get(host);
		return b && b.status === 'published'
			? { kind: 'guide', title: b.title, href: `${buildHref(b.mos, b.slug)}/comments` }
			: null;
	};
	return recent.flatMap((c) => {
		const subject = subjectOf(c.build);
		if (!subject) return [];
		return [
			{
				kind: 'comment' as const,
				at: c.createdAt,
				id: c._id,
				excerpt: excerptOf(c.text),
				subject,
				href: `${subject.href}#c-${c._id}`,
				...who(c.author)
			}
		];
	});
}

/**
 * Both, in one feed, newest first: the home page's handful. Cached as one,
 * since the home page is the busiest page on the site and the guide lookup
 * behind the comment rows is not cached on its own; every guide and comment
 * write drops it (see invalidateBuild and the comment writes in builds.ts).
 */
export async function recentActivity(n: number): Promise<ActivityItem[]> {
	return cached(`activity:recent`, async () => {
		const [guides, comments] = await Promise.all([recentGuides(n), recentComments(n)]);
		return [...guides, ...comments].sort((a, b) => b.at.localeCompare(a.at)).slice(0, n);
	});
}
