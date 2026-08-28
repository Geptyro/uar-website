/**
 * Whether the chat has something the reader has not seen: the newest
 * message's time against when they last had the chat in front of them,
 * kept in this browser. The sidebar's dot reads it; the chat page clears
 * it while it is open; the site's event stream raises it from anywhere.
 */
const KEY = 'uar.chatSeen';

export const chat = $state({ unread: false, latest: '' });

function seenAt(): string {
	try {
		return localStorage.getItem(KEY) ?? '';
	} catch {
		return '';
	}
}

/** Whether this browser has ever had the chat in front of it. */
export function chatSeenBefore(): boolean {
	return seenAt() !== '';
}

/** The newest message is at `at`: unread unless the reader has seen up to it. */
export function chatMoved(at: string | null | undefined) {
	if (!at) return;
	if (at > chat.latest) chat.latest = at;
	chat.unread = chat.latest > seenAt();
}

/** The reader has the chat in front of them: everything up to now is seen. */
export function chatSeen(at: string = new Date().toISOString()) {
	try {
		localStorage.setItem(KEY, at > chat.latest ? at : chat.latest);
	} catch {
		/* no storage: the dot just comes back next load */
	}
	chat.unread = false;
}
