/**
 * Browser binding for the platform-free MPQ reader in `./mpq.ts`.
 *
 * `node:zlib` does not exist in a browser and `DecompressionStream` is async,
 * while the MPQ reader is synchronous top to bottom — so this uses fflate,
 * which is a synchronous JS inflate small enough not to matter in a bundle.
 *
 * This exists so the site can tell, on the player's own machine, whether a
 * replay belongs to this map before uploading it. That check is a promise the
 * README makes ("only files whose map title is Undead Assault reborn are ever
 * sent"), so it cannot be delegated to the server.
 */

import { inflateSync } from 'fflate';
import {
	MPQArchive as MPQArchiveCore,
	decompressChunk as decompressChunkCore,
	type Codecs
} from './mpq.ts';

export { MAX_FILE_BYTES, type Codecs } from './mpq.ts';

export const browserCodecs: Codecs = {
	/**
	 * `expected` is exact for every MPQ chunk — the sector size, or what is
	 * left of the file on the final sector — so handing fflate an output
	 * buffer of precisely that size both avoids a resize and keeps the
	 * decompression-bomb bound that `maxOutputLength` gives us in Node.
	 */
	inflate: (payload, expected) => inflateSync(payload, { out: new Uint8Array(expected) }),

	/**
	 * Deliberately absent, and the boundary is narrower than it looks.
	 *
	 * SC2 writes `replay.details` as zlib but `replay.initData`,
	 * `replay.game.events` and `replay.tracker.events` as bzip2 (measured on
	 * the committed fixtures). The client only ever reads `replay.details` —
	 * that is the whole map-title check — so supporting bzip2 here would mean
	 * shipping a `Buffer` polyfill to every visitor for entries the browser
	 * never opens. Deep parsing stays on the server, where `mpq-node.ts` has
	 * seek-bzip and native zlib.
	 *
	 * Failing loudly rather than returning empty matters: a caller treats a
	 * throw as "not a readable replay" and skips the file, where silence
	 * would look like "no map title found" and skip it for the wrong reason.
	 */
	bunzip: () => {
		throw new Error(
			'bzip2 MPQ sectors are not supported in the browser — replay.details is zlib; ' +
				'anything deeper must be parsed server-side'
		);
	}
};

/** The core reader with the browser decompressors already wired in. */
export class MPQArchive extends MPQArchiveCore {
	constructor(data: Uint8Array) {
		super(data, browserCodecs);
	}
}

/** @internal exported for parity tests against the Node binding */
export function decompressChunk(data: Uint8Array, expected: number): Uint8Array {
	return decompressChunkCore(data, expected, browserCodecs);
}
