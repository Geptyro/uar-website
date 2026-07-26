import { fail } from '@sveltejs/kit';
import { dbConfigured, insertFeedback } from '$lib/server/db';
import { validateFeedback } from '$lib/feedback';
import type { Actions } from './$types';

export const prerender = false;

// crude per-IP rate limit, same approach as replay uploads: single always-on
// machine, so in-memory is fine. Only ACCEPTED submissions consume it.
const ACCEPT_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const acceptsByIp = new Map<string, number[]>();

function recentAccepts(ip: string): number[] {
	const list = (acceptsByIp.get(ip) ?? []).filter((t) => Date.now() - t < RATE_WINDOW_MS);
	acceptsByIp.set(ip, list);
	return list;
}

export const actions: Actions = {
	default: async ({ request, getClientAddress }) => {
		const form = await request.formData().catch(() => null);
		if (!form) {
			return fail(400, {
				error: 'Invalid form submission.',
				values: { message: '', name: '', contact: '' }
			});
		}

		// echo the entered values back so a failed no-JS submit keeps the text
		const values = {
			message: String(form.get('message') ?? ''),
			name: String(form.get('name') ?? ''),
			contact: String(form.get('contact') ?? '')
		};

		const v = validateFeedback({
			message: form.get('message'),
			name: form.get('name'),
			contact: form.get('contact'),
			website: form.get('website')
		});
		if (!v.ok) return fail(400, { error: v.error, values });

		if (!dbConfigured()) {
			return fail(503, { error: 'Feedback is not configured on this deployment.', values });
		}
		if (recentAccepts(getClientAddress()).length >= ACCEPT_LIMIT) {
			return fail(429, { error: 'Too many submissions — please try again later.', values });
		}

		await insertFeedback({ createdAt: new Date().toISOString(), ...v.fields });
		recentAccepts(getClientAddress()).push(Date.now());
		return { success: true };
	}
};
