/**
 * SSE stream announcing "ready to play" roster changes; the top-bar widget
 * refetches /api/ready on each event, so state always comes from one code
 * path. It also says when the chat moved (`chat`, with the message's time),
 * so a page anywhere on the site can light the sidebar's dot without
 * carrying the message itself. Periodic comment pings keep proxies from idling the connection out;
 * EventSource reconnects on its own if the stream drops.
 */
import { subscribeReady } from '$lib/server/events';
import { subscribeChat } from '$lib/server/chat';
import type { RequestHandler } from './$types';

export const prerender = false;

const PING_MS = 25_000;

export const GET: RequestHandler = () => {
	const encoder = new TextEncoder();
	let unsubscribe: (() => void) | undefined;
	let unsubscribeChat: (() => void) | undefined;
	let ping: ReturnType<typeof setInterval> | undefined;

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const send = (text: string) => {
				try {
					controller.enqueue(encoder.encode(text));
				} catch {
					// already closed; cancel() handles the cleanup
				}
			};
			send('retry: 3000\n\n');
			unsubscribe = subscribeReady(() => send('event: change\ndata: {}\n\n'));
			unsubscribeChat = subscribeChat((e) => {
				if (e.type === 'message') send(`event: chat\ndata: ${JSON.stringify({ at: e.doc.createdAt })}\n\n`);
			});
			ping = setInterval(() => send(': ping\n\n'), PING_MS);
		},
		cancel() {
			unsubscribe?.();
			unsubscribeChat?.();
			if (ping) clearInterval(ping);
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-store'
		}
	});
};
