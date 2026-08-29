/**
 * Diagnostic reports from the UAR Companion app.
 *
 * POST (JSON, sign-in optional): {message?, log?, app?} -> {id}. The app sends
 * this when a player asks it to in Settings, or accepts its offer to report an
 * error it caught — never on its own, because the log carries battletags,
 * folder paths and replay file names.
 *
 * Sign-in is deliberately not required. The reports worth having most are the
 * ones from a player whose session or network is the thing that broke, and the
 * flood guard below is what a report actually costs: one insert, per address,
 * five an hour. When there IS a session it is stored, so a reply has somewhere
 * to go.
 *
 * Reports land in the same `feedback` collection as the /feedback form (tagged
 * `source: 'companion'`) — see scripts/list-feedback.ts for reading them.
 */
import { error, json } from '@sveltejs/kit';
import { REPORT_LOG_MAX, validateReport } from '$lib/report';
import { rateLimiter } from 'sveltekit-commons/rate-limit';
import { dbConfigured, insertFeedback } from '$lib/server/db';
import { pushToAdmins } from '$lib/server/notify';
import type { RequestHandler } from './$types';

export const prerender = false;

/**
 * Per-IP, and only ACCEPTED reports are charged (`allows` before, `record`
 * after) — same reasoning as the feedback form: a malformed post must not
 * spend the budget of the player behind the same address who then writes a
 * real one.
 */
const limiter = rateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 });

/**
 * Read nothing bigger than a trimmed log can be. The trimming happens on both
 * sides, but the body is read before either runs, so the only guard that stops
 * a client posting a gigabyte is a length check on the way in. UTF-8 doubles
 * generously over a log of ASCII timestamps, plus room for the note.
 */
const MAX_BODY = REPORT_LOG_MAX * 2 + 16_000;

export const POST: RequestHandler = async ({ request, locals, getClientAddress }) => {
	if (!dbConfigured()) error(503, 'Reports are not configured on this deployment.');
	if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY) {
		error(413, 'Report too large.');
	}
	const body = await request.json().catch(() => null);
	const v = validateReport(body);
	if (!v.ok) error(400, v.error);

	const ip = getClientAddress();
	if (!limiter.allows(ip)) error(429, 'Too many reports — please try again later.');

	let id: string;
	try {
		id = await insertFeedback({
			createdAt: new Date().toISOString(),
			source: 'companion',
			...v.fields,
			...(locals.session
				? { account: { sub: locals.session.sub, battletag: locals.session.battletag } }
				: {})
		});
	} catch (e) {
		console.error('[report] insert failed:', e);
		error(503, 'Could not save that just now — please try again.');
	}
	limiter.record(ip);

	// the point of the whole feature: a crash is looked at the day it happens
	// rather than found in the inbox weeks later
	void pushToAdmins({
		title: `Companion report${v.fields.app?.version ? ` (v${v.fields.app.version})` : ''}`,
		body: v.fields.message?.slice(0, 120) ?? 'Log only, no note.',
		url: '/companion',
		tag: 'reports'
	});

	return json({ id });
};
