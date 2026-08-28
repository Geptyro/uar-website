/**
 * Asking before an action that cannot be taken back, without the browser's
 * own `confirm()` box: a page keeps one `Confirm` (a modal on the site's
 * chrome) and hands its `ask` to whoever needs a yes.
 *
 * Two ways in. Code that already has a handler awaits `ask(question)`. A
 * plain form that posts to an action (the deletes) uses the `confirmSubmit`
 * action instead, which holds the submit until the answer is in and then
 * sends the form for real, with the button that was pressed, so an `intent`
 * still travels.
 *
 * Components deep in a tree (the block editor inside the guide editor) read
 * the page's `ask` from context under `CONFIRM`, and fall back to the
 * browser's box when no one set it, so they work on their own too.
 */
import type { Action } from 'svelte/action';

export interface Question {
	title: string;
	/** A line under the title: what goes with it, what cannot be undone. */
	message?: string;
	/** The yes button's word; 'Delete' unless said otherwise. */
	yes?: string;
	/** The no button's word; 'Cancel' unless said otherwise. */
	no?: string;
	/** Red yes button (the default); false for a question that is not about losing something. */
	danger?: boolean;
}

export type Ask = (q: Question) => Promise<boolean>;

/** Context key under which a page's `Confirm.ask` is shared with what it renders. */
export const CONFIRM = Symbol('confirm');

/** The browser's own box, for a place with no `Confirm` on the page. */
export const askNative: Ask = async (q) => confirm(q.message ? `${q.title}\n\n${q.message}` : q.title);

/**
 * `use:confirmSubmit={ask}` on a form: its submit waits for `ask()` to say
 * yes, then goes out as it would have. Works on the plain forms the guide
 * pages post with (no `use:enhance`), since the second submit is the real,
 * uncaught one.
 */
export const confirmSubmit: Action<HTMLFormElement, () => Promise<boolean>> = (form, ask) => {
	let cleared = false;
	const onsubmit = (e: SubmitEvent) => {
		if (cleared) {
			cleared = false;
			return;
		}
		e.preventDefault();
		const submitter = e.submitter instanceof HTMLElement ? e.submitter : undefined;
		void ask().then((ok) => {
			if (!ok) return;
			cleared = true;
			form.requestSubmit(submitter);
		});
	};
	form.addEventListener('submit', onsubmit);
	return {
		update(next) {
			ask = next;
		},
		destroy() {
			form.removeEventListener('submit', onsubmit);
		}
	};
};
