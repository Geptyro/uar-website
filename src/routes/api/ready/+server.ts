/**
 * "Ready to play" flags for the top-bar widget. GET = who is currently
 * flagged (public); POST / DELETE = flag or unflag the signed-in account.
 * Flags last one hour (READY_DURATION_MS) and expire silently; re-flagging
 * restarts the hour.
 */
import { error, json } from '@sveltejs/kit';
import { clearReady, dbConfigured, getReadyPlayers, setReady } from '$lib/server/db';
import { publishReadyChange } from '$lib/server/events';
import { READY_DURATION_MS, type ReadyPlayer } from '$lib/ready';
import type { RequestHandler } from './$types';

export const prerender = false;

async function state(
	sub: string | undefined
): Promise<{ me: boolean; until: string | null; players: ReadyPlayer[] }> {
	const docs = dbConfigured() ? await getReadyPlayers() : [];
	const mine = sub === undefined ? undefined : docs.find((p) => p._id === sub);
	return {
		me: mine !== undefined,
		until: mine?.until ?? null,
		players: docs.map((p) => ({
			battletag: p.battletag,
			toon: p.toon ?? null,
			avatar: p.avatar ?? null,
			until: p.until
		}))
	};
}

export const GET: RequestHandler = async ({ locals, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	return json(await state(locals.session?.sub));
};

export const POST: RequestHandler = async ({ locals }) => {
	const s = locals.session;
	if (!s) error(401, 'sign in with Battle.net to flag yourself as ready');
	if (!dbConfigured()) error(503, 'player database not configured');
	const now = new Date();
	await setReady({
		_id: s.sub,
		battletag: s.battletag,
		...(s.toon ? { toon: s.toon } : {}),
		...(s.avatar ? { avatar: s.avatar } : {}),
		since: now.toISOString(),
		until: new Date(now.getTime() + READY_DURATION_MS).toISOString()
	});
	publishReadyChange();
	return json(await state(s.sub));
};

export const DELETE: RequestHandler = async ({ locals }) => {
	const s = locals.session;
	if (!s) error(401, 'not signed in');
	if (!dbConfigured()) error(503, 'player database not configured');
	await clearReady(s.sub);
	publishReadyChange();
	return json(await state(s.sub));
};
