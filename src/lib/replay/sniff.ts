/**
 * "Is this one of ours?" — the check that runs on the player's own machine
 * before anything leaves it. Mirrors the companion's `src/core/sniff.ts`,
 * with the one difference a browser forces: no `Buffer`.
 *
 * The map title comes from `uar-shared/replay` so this and the upload
 * endpoint cannot drift apart. A client filtering on a different string
 * either uploads replays it promised not to, or silently stops uploading.
 */

import { MAP_TITLE } from 'uar-shared/replay';
import { MPQArchive } from './mpq-browser.ts';

const TITLE_BYTES = new TextEncoder().encode(MAP_TITLE);

/**
 * `Buffer.prototype.includes` for plain bytes. Naive search on purpose: the
 * haystack is a `replay.details` entry — a few hundred bytes — so anything
 * cleverer costs more to read than it saves to run.
 */
export function bytesInclude(haystack: Uint8Array, needle: Uint8Array): boolean {
	if (needle.length === 0) return true;
	outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
		for (let j = 0; j < needle.length; j++) {
			if (haystack[i + j] !== needle[j]) continue outer;
		}
		return true;
	}
	return false;
}

/**
 * Opens the replay archive and looks for the map title in the small
 * replay.details entry — patch-proof (no versioned protocol decode) and
 * cheap enough to run on every file in a folder. Throws when the file is
 * not a readable SC2 replay, which callers treat as "skip this one".
 */
export function isUARReplay(data: Uint8Array): boolean {
	const archive = new MPQArchive(data);
	const details = archive.readFile('replay.details');
	if (!details) throw new Error('replay.details missing from archive');
	return bytesInclude(details, TITLE_BYTES);
}
