/**
 * Node binding for the platform-free MPQ reader in `$lib/replay/mpq.ts`.
 *
 * Native zlib rather than a JS inflate: this runs on every upload, in the
 * parse worker, and the difference is measurable there in a way it is not in
 * a browser reading one file at a time.
 *
 * Importing this pulls in `node:zlib`, so it must stay under `$lib/server/`.
 * Client code wants `$lib/replay/mpq-browser.ts` instead.
 */

import { inflateSync } from 'node:zlib';
import Bunzip from 'seek-bzip';
import {
	MPQArchive as MPQArchiveCore,
	decompressChunk as decompressChunkCore,
	type Codecs
} from '../../replay/mpq.ts';

export { MAX_FILE_BYTES, type Codecs } from '../../replay/mpq.ts';

export const nodeCodecs: Codecs = {
	inflate: (payload, expected) => inflateSync(payload, { maxOutputLength: expected }),
	// given a size, seek-bzip decodes into a fixed buffer and refuses to grow
	// it, so an overlong stream throws instead of eating the machine's memory
	bunzip: (payload, expected) => Bunzip.decode(Buffer.from(payload), expected)
};

/** The core reader with the native decompressors already wired in. */
export class MPQArchive extends MPQArchiveCore {
	constructor(data: Uint8Array) {
		super(data, nodeCodecs);
	}
}

/** @internal exported for the decompression-bomb tests */
export function decompressChunk(data: Uint8Array, expected: number): Uint8Array {
	return decompressChunkCore(data, expected, nodeCodecs);
}
