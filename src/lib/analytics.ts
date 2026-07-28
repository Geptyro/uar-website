/**
 * Umami identity, cached for the tracker's very first pageview.
 *
 * Umami derives the session id from the distinct id whenever one is set
 * (`uuid(websiteId, id)`), so any pageview sent *before* `umami.identify()`
 * runs is filed under a different session than everything sent after it — one
 * signed-in visit counted as two visitors. The layout only learns who is
 * signed in from an async `/api/me` fetch, long after the tracker has sent
 * the landing pageview, so the battletag is kept here and stamped onto
 * outgoing payloads by the before-send hook in `app.html` (which reads the
 * same key literally — it is plain HTML and cannot import this module).
 */
const KEY = 'uar:umami-id';

/** Remember the signed-in battletag, or forget it on sign-out (`null`). */
export function rememberUmamiId(battletag: string | null) {
	try {
		if (battletag) localStorage.setItem(KEY, battletag);
		else localStorage.removeItem(KEY);
	} catch {
		// Storage disabled: the visit splits in two the way it used to, and
		// nothing else about the page cares.
	}
}
