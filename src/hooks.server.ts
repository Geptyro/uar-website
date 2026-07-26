import type { Handle } from '@sveltejs/kit';
import { readSession } from '$lib/server/session';
import { warmReplayWorker } from '$lib/server/replay/offthread';

// one parsing worker for the lifetime of the server, started before the
// first upload rather than inside it
warmReplayWorker();

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.session = readSession(event.cookies);
	return resolve(event);
};
