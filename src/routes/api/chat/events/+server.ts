/**
 * The chat's stream: every message that lands, changes or goes, and who is
 * typing, as server-sent events, each rendered for the reader holding the
 * connection (so "mine" is right and names are the site's). Pings keep
 * proxies from idling it out; EventSource reconnects on its own, and the
 * page refetches the newest messages when it does.
 */
import { subscribeChat, whoIsTyping } from '$lib/server/chat';
import { chatViews } from '$lib/server/chatView';
import type { RequestHandler } from './$types';

export const prerender = false;

const PING_MS = 25_000;

export const GET: RequestHandler = ({ locals }) => {
	const viewer = locals.session?.sub ?? null;
	const encoder = new TextEncoder();
	let unsubscribe: (() => void) | undefined;
	let ping: ReturnType<typeof setInterval> | undefined;

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const send = (event: string, data: unknown) => {
				try {
					controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
				} catch {
					// already closed; cancel() handles the cleanup
				}
			};
			try {
				controller.enqueue(encoder.encode('retry: 3000\n\n'));
			} catch {
				/* closed */
			}
			unsubscribe = subscribeChat((e) => {
				if (e.type === 'typing') send('typing', { names: whoIsTyping(viewer) });
				else if (e.type === 'delete') send('delete', { id: e.id });
				else void chatViews([e.doc], viewer).then(([view]) => send(e.type, view));
			});
			ping = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(': ping\n\n'));
				} catch {
					/* closed */
				}
			}, PING_MS);
		},
		cancel() {
			unsubscribe?.();
			if (ping) clearInterval(ping);
		}
	});

	return new Response(stream, {
		headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store' }
	});
};
