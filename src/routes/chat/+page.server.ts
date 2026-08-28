import { dbConfigured } from '$lib/server/db';
import { CHAT_PAGE, listChat, whoIsTyping } from '$lib/server/chat';
import { chatViews } from '$lib/server/chatView';
import { isAdmin } from '$lib/server/admins';
import type { PageServerLoad } from './$types';

/**
 * The chat page opens with the newest messages already in it, rendered for
 * the reader; the stream takes it from there.
 */
export const prerender = false;

export const load: PageServerLoad = async ({ locals, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	const session = locals.session;
	if (!dbConfigured()) return { enabled: false, signedIn: false, admin: false, messages: [], more: false, typing: [] as string[] };
	const docs = await listChat();
	return {
		enabled: true,
		signedIn: session !== null,
		admin: isAdmin(session),
		messages: await chatViews(docs, session?.sub ?? null),
		more: docs.length === CHAT_PAGE,
		typing: whoIsTyping(session?.sub ?? null)
	};
};
