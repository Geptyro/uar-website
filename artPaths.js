/**
 * Which request paths are generated game art, and so may be cached hard.
 *
 * Its own module purely so it can be tested: server.js opens a socket the
 * moment it is imported, and it also imports build/handler.js, which only
 * exists after a build — neither of which a unit test should need. Kept beside
 * server.js at the root rather than under src/, because the runtime image
 * carries only build/, node_modules/, package.json and these two files.
 */

/** Directories under static/ holding art generated from the game data. */
const ART_DIRS = ['icons', 'camos', 'map', 'og', 'models'];

/**
 * Any depth below those directories, on purpose: the share cards are filed per
 * subject (/og/entities/<id>.png, /og/mos/<id>.png), and a pattern that stopped
 * at a single segment left 479 of the 482 of them with no policy at all while
 * /og/site.png got one.
 */
export const ART = new RegExp(`^/(?:${ART_DIRS.join('|')})/(?:[^/]+/)*[^/]+\\.(?:png|glb)$`);

/** A month, in seconds. */
export const ART_MAX_AGE = 30 * 24 * 60 * 60;

/**
 * `must-revalidate`, not `immutable`: these filenames are stable but the game
 * data behind them is regenerated, so a refresh has to be able to reach a
 * browser that already holds one.
 */
export const ART_CACHE_CONTROL = `public, max-age=${ART_MAX_AGE}, must-revalidate`;

/**
 * Whether a request path should be served with the art cache policy.
 *
 * @param {string | undefined} url raw `req.url`, query string and all
 * @returns {boolean}
 */
export function isArtPath(url) {
	// the query string is not part of the match: these are served by path, and a
	// cache-busting suffix must not drop the response to no policy at all
	return ART.test((url ?? '').split('?')[0]);
}
