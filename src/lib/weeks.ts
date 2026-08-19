/**
 * The week a moment belongs to — Monday, UTC — as `YYYY-MM-DD`.
 *
 * Shared by the derived pass that files games into weeks and by the page
 * that draws them, so the two can never disagree on where a week starts.
 * Dependency-free (pattern: xp.ts) so node:test loads it directly.
 */
export function weekOf(iso: string): string {
	const d = new Date(iso);
	// getUTCDay: 0 = Sunday; back to Monday
	const back = (d.getUTCDay() + 6) % 7;
	d.setUTCDate(d.getUTCDate() - back);
	d.setUTCHours(0, 0, 0, 0);
	return d.toISOString().slice(0, 10);
}
