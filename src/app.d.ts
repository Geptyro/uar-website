// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	interface Window {
		/** Umami tracker (app.html, deferred) — absent until the script loads. */
		umami?: { identify: (id: string, data?: Record<string, unknown>) => void };
	}
	namespace App {
		// interface Error {}
		interface Locals {
			/** Battle.net login parsed from the signed session cookie, or null. */
			session: import('$lib/server/session').Session | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
