import { frontMonths } from '$lib/changelog';
import { months } from '$lib/changelog-data';

/**
 * The newest months, whole: the current one, and the one before it while the
 * current is still short. The rest are links, each to its own page under
 * /changelog/YYYY-MM. Prerendered with the site, so it only moves on deploy.
 */
export function load() {
	return frontMonths(months);
}
