/**
 * Re-encodes a picture a player uploaded, before anything keeps it.
 *
 * Nothing a visitor sends is stored as sent. Decoding it and writing it back
 * out is what makes the upload safe to serve: a file that is not really an
 * image fails to decode, whatever it was named; the metadata (a phone's GPS
 * fix, an editor's undo history) is gone because nothing copies it; and the
 * size is bounded whatever came in. WebP because a 1600px screenshot lands
 * around 150 to 300 KB, which is what lets a guide carry a dozen of them
 * without the bucket noticing.
 *
 * sharp is a native dependency, the only one the server has. It ships
 * prebuilt for the Alpine image (linuxmusl-x64 is in the lockfile), and the
 * Docker builder resolves it under `npm ci` like any other platform package.
 */

import sharp from 'sharp';
import { BUILD_LIMITS } from '../builds.ts';

/**
 * More pixels than a screenshot could have. Refused before decoding rather
 * than decoded: the machine has 512 MB, and a decode bomb (a tiny PNG that
 * unpacks to a gigapixel) is exactly the kind of upload a public endpoint
 * receives.
 */
const MAX_INPUT_PIXELS = 40_000_000;

export class NotAnImage extends Error {}

export interface EncodedImage {
	data: Buffer;
	width: number;
	height: number;
}

export async function reencodeImage(bytes: Uint8Array): Promise<EncodedImage> {
	try {
		const side = BUILD_LIMITS.imageSide;
		const out = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' })
			// honour the EXIF orientation before the tag is dropped with the rest
			.rotate()
			.resize({ width: side, height: side, fit: 'inside', withoutEnlargement: true })
			.webp({ quality: 80, effort: 4 })
			.toBuffer({ resolveWithObject: true });
		return { data: out.data, width: out.info.width, height: out.info.height };
	} catch (e) {
		throw new NotAnImage(e instanceof Error ? e.message : String(e));
	}
}
