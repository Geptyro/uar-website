/**
 * "3h ago" for the places where when-it-happened matters more than the date.
 *
 * Takes `now` rather than reading the clock, so it is pure: the same inputs
 * always give the same string, which is what makes it testable and what keeps
 * a server render and the hydration that follows it from disagreeing for any
 * reason other than the time that genuinely passed between them.
 *
 * Returns null once a game is old enough that "5w ago" stops meaning anything
 * useful — the caller shows the date instead.
 */

const MIN = 60;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Past this, a relative age is less informative than the date itself. */
const MAX_DAYS = 35;

export function timeAgo(iso: string, now: number): string | null {
	const then = Date.parse(iso);
	if (!Number.isFinite(then)) return null;
	// a clock skewed a little ahead of the server should read "just now",
	// never a negative age
	const secs = Math.max(0, Math.round((now - then) / 1000));

	if (secs < 45) return 'just now';
	// capped at 59: rounding 59.6 minutes up to "60 min ago" reads as broken
	if (secs < HOUR) return `${Math.min(59, Math.max(1, Math.round(secs / MIN)))} min ago`;
	// floor from here down, so an age is never claimed to be longer than it is
	if (secs < DAY) return `${Math.floor(secs / HOUR)}h ago`;
	const days = Math.floor(secs / DAY);
	if (days < 7) return `${days}d ago`;
	if (days < MAX_DAYS) return `${Math.floor(days / 7)}w ago`;
	return null;
}
