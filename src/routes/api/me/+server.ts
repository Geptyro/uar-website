/**
 * Who is signed in, from the session cookie. Fetched client-side by the
 * layout's top-bar account button — the layout renders on prerendered pages,
 * so the session can't come from a server load there.
 */
import { json } from '@sveltejs/kit';
import { dbConfigured, getAccount, pickPrimaryProfile } from '$lib/server/db';
import { createSession } from '$lib/server/session';
import { unreadCount } from '$lib/server/notifications';
import { latestChatAt } from '$lib/server/chat';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async ({ locals, cookies, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	let session = locals.session;

	// Sessions issued before avatar/toon lived in the cookie: backfill from the
	// accounts collection and re-issue the cookie so this runs only once.
	if (session && !session.toon && dbConfigured()) {
		try {
			const account = await getAccount(session.sub);
			const primary = account?.profiles?.length
				? await pickPrimaryProfile(account.profiles)
				: undefined;
			if (primary) {
				session = {
					...session,
					avatar:
						session.avatar ??
						primary.avatarUrl ??
						account?.profiles.find((p) => p.avatarUrl)?.avatarUrl,
					toon: primary.toon
				};
				createSession(cookies, session);
			}
		} catch {
			// backfill is best-effort; the button just stays battletag-only
		}
	}

	// the bell's number; a count that fails is a bell with nothing on it
	let unread = 0;
	if (session && dbConfigured()) {
		try {
			unread = await unreadCount(session.sub);
		} catch {
			unread = 0;
		}
	}
	// when the chat last moved, so a page can light the sidebar's dot on load
	const chatAt = dbConfigured() ? await latestChatAt().catch(() => null) : null;
	return json({
		battletag: session?.battletag ?? null,
		avatar: session?.avatar ?? null,
		toon: session?.toon ?? null,
		unread,
		chatAt
	});
};
