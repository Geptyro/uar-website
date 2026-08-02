/**
 * Off-thread replay examination.
 *
 * Deciding whether a file is ours means decompressing and parsing an MPQ
 * archive, and that is synchronous CPU work — a few milliseconds each, which
 * is nothing until a player points us at a folder holding two thousand
 * recordings. On the main thread that is a page that does not scroll for the
 * length of the scan.
 *
 * The bytes are copied in rather than transferred: a transfer would detach the
 * caller's buffer, and the caller still needs it to upload the file. A copy of
 * a few hundred kilobytes is a memcpy, invisible next to the parse it feeds.
 *
 * The digest rides along because the worker already holds the bytes, and
 * asking twice would mean sending them twice.
 */

import { isUARReplay } from './sniff.ts';

export interface ExamineRequest {
	id: number;
	bytes: Uint8Array;
}

export interface ExamineResult {
	id: number;
	isUAR: boolean;
	/** Only computed when the file is ours — nothing else needs it. */
	sha256?: string;
	/** Set when the archive could not be read at all. */
	error?: string;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

self.onmessage = async (event: MessageEvent<ExamineRequest>) => {
	const { id, bytes } = event.data;
	try {
		if (!isUARReplay(bytes)) {
			self.postMessage({ id, isUAR: false } satisfies ExamineResult);
			return;
		}
		self.postMessage({ id, isUAR: true, sha256: await sha256Hex(bytes) } satisfies ExamineResult);
	} catch (e) {
		self.postMessage({
			id,
			isUAR: false,
			error: e instanceof Error ? e.message : String(e)
		} satisfies ExamineResult);
	}
};
