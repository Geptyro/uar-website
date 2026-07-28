/**
 * Search-term helpers. Dependency-free so plain node:test can load them
 * (see CLAUDE.md).
 */

/**
 * Escape a visitor-supplied string for use inside a regular expression.
 *
 * The leaderboard search became a Mongo `$regex` when sorting and paging moved
 * into the database, so an unescaped `(` or `*` would stop being a literal the
 * player typed and start being syntax — at best no matches, at worst a pattern
 * that costs real time to evaluate.
 */
export function escapeRegex(term: string): string {
	return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
