/**
 * Feedback form limits + validation — pure and dependency-free so the page
 * can share the limits, the form action can validate, and plain node --test
 * can load it (same pattern as xp.ts: no Vite-flavored imports).
 */

export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 4000;
export const NAME_MAX = 80;
export const CONTACT_MAX = 120;

export interface FeedbackInput {
	message: unknown;
	name: unknown;
	contact: unknown;
	/** Honeypot — hidden in the UI, so anything non-empty is a bot. */
	website: unknown;
}

export interface FeedbackFields {
	message: string;
	name?: string;
	contact?: string;
}

export type FeedbackValidation =
	| { ok: true; fields: FeedbackFields }
	| { ok: false; error: string };

function trimmed(v: unknown): string {
	return typeof v === 'string' ? v.trim() : '';
}

export function validateFeedback(input: FeedbackInput): FeedbackValidation {
	if (trimmed(input.website)) return { ok: false, error: 'Submission rejected.' };

	const message = trimmed(input.message);
	if (message.length < MESSAGE_MIN) {
		return { ok: false, error: `Please write at least ${MESSAGE_MIN} characters.` };
	}
	if (message.length > MESSAGE_MAX) {
		return { ok: false, error: `Message too long (max ${MESSAGE_MAX} characters).` };
	}

	const name = trimmed(input.name);
	if (name.length > NAME_MAX) {
		return { ok: false, error: `Name too long (max ${NAME_MAX} characters).` };
	}
	const contact = trimmed(input.contact);
	if (contact.length > CONTACT_MAX) {
		return { ok: false, error: `Contact too long (max ${CONTACT_MAX} characters).` };
	}

	const fields: FeedbackFields = { message };
	if (name) fields.name = name;
	if (contact) fields.contact = contact;
	return { ok: true, fields };
}
