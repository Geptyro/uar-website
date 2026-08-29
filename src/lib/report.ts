/**
 * Diagnostic reports sent by the Companion app (POST /api/report).
 *
 * A report is a feedback message with the tail of the app's log attached, so
 * "it crashed when I shut the PC down" arrives with the lines that say what
 * actually threw. Dependency-free so plain node:test can load it (CLAUDE.md).
 *
 * Nothing here trusts the client for size: an app that never trims (an old
 * build, or a patched one) must not be able to push a megabyte of text into
 * Atlas, so the log is cut here as well and the route caps the body before it
 * is even read.
 */

/** Same figure the Companion trims to before sending. */
export const REPORT_LOG_MAX = 64_000;
export const REPORT_MESSAGE_MAX = 4000;
/** Per value, on the metadata below — a version string, not an essay. */
const APP_VALUE_MAX = 200;

/**
 * What the app may say about itself. An allowlist because this is written
 * straight into the triage inbox: a client that invents fields would other-
 * wise decide what the maintainer's tooling shows.
 */
export const REPORT_APP_FIELDS = [
	'version',
	'platform',
	'arch',
	'electron',
	'signedIn',
	'sc2',
	'watching',
	'update',
	'crashedAt'
] as const;

export type ReportApp = Partial<Record<(typeof REPORT_APP_FIELDS)[number], string>>;

export interface ReportFields {
	message?: string;
	log?: string;
	app?: ReportApp;
}

export type ReportResult = { ok: true; fields: ReportFields } | { ok: false; error: string };

/** Keeps the END of an over-long log: the last thing it did is the report. */
export function tailOf(log: string, max = REPORT_LOG_MAX): string {
	if (log.length <= max) return log;
	const cut = log.slice(log.length - max);
	// start on a line boundary, so the first line is never half a timestamp
	const nl = cut.indexOf('\n');
	return `[earlier lines trimmed]\n${nl === -1 ? cut : cut.slice(nl + 1)}`;
}

function trimmed(v: unknown): string {
	return typeof v === 'string' ? v.trim() : '';
}

export function validateReport(input: unknown): ReportResult {
	if (!input || typeof input !== 'object') return { ok: false, error: 'Send a JSON object.' };
	const body = input as Record<string, unknown>;

	const message = trimmed(body.message);
	if (message.length > REPORT_MESSAGE_MAX) {
		return { ok: false, error: `Message too long (max ${REPORT_MESSAGE_MAX} characters).` };
	}
	const log = typeof body.log === 'string' ? tailOf(body.log) : '';
	// a log on its own is a valid report (the app offering to send one after
	// an error), a note on its own is valid too — nothing at all is not
	if (!message && !log.trim()) return { ok: false, error: 'Nothing to report.' };

	const app: ReportApp = {};
	const meta = body.app;
	if (meta && typeof meta === 'object') {
		for (const key of REPORT_APP_FIELDS) {
			const value = (meta as Record<string, unknown>)[key];
			if (value === undefined || value === null) continue;
			const text = String(value).trim().slice(0, APP_VALUE_MAX);
			if (text) app[key] = text;
		}
	}

	const fields: ReportFields = {};
	if (message) fields.message = message;
	if (log) fields.log = log;
	if (Object.keys(app).length > 0) fields.app = app;
	return { ok: true, fields };
}
