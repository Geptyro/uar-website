/**
 * Minimal MPQ (MoPaQ) archive reader — a TS port of the parts of mpyq
 * (Aku Kotkavuo, MIT) that SC2 replays need: user-data header, encrypted
 * hash/block tables, and file reads with zlib/bzip2 sector decompression.
 *
 * Deliberately platform-free: every byte of this file runs unchanged in Node
 * and in a browser. The two decompressors are the only thing that differs
 * between them, so they are injected rather than imported — see `mpq-node.ts`
 * (native zlib, for the upload endpoint) and `mpq-browser.ts` (fflate, for
 * the PWA that reads a player's replay folder locally). That is also why it
 * sits in `$lib/` and not `$lib/server/`: SvelteKit refuses to bundle
 * server-only modules into client code.
 */

const MPQ_FILE_COMPRESS = 0x00000200;
const MPQ_FILE_ENCRYPTED = 0x00010000;
const MPQ_FILE_SINGLE_UNIT = 0x01000000;
const MPQ_FILE_SECTOR_CRC = 0x04000000;
const MPQ_FILE_EXISTS = 0x80000000;

const HASH_TYPES = { TABLE_OFFSET: 0, HASH_A: 1, HASH_B: 2, TABLE: 3 } as const;
type HashType = keyof typeof HASH_TYPES;

/**
 * The platform's decompressors. Both are handed the exact number of bytes
 * the chunk must produce and are required to refuse to exceed it — that
 * bound is the decompression-bomb defence, so an implementation that
 * ignores it silently removes the protection.
 */
export interface Codecs {
	/** zlib (MPQ compression type 2). */
	inflate(payload: Uint8Array, expected: number): Uint8Array;
	/** bzip2 (MPQ compression type 16). May throw if unsupported. */
	bunzip(payload: Uint8Array, expected: number): Uint8Array;
}

const encryptionTable: Uint32Array = (() => {
	const table = new Uint32Array(0x500);
	let seed = 0x00100001;
	for (let i = 0; i < 256; i++) {
		let index = i;
		for (let j = 0; j < 5; j++) {
			seed = (seed * 125 + 3) % 0x2aaaab;
			const temp1 = (seed & 0xffff) << 0x10;
			seed = (seed * 125 + 3) % 0x2aaaab;
			const temp2 = seed & 0xffff;
			table[index] = (temp1 | temp2) >>> 0;
			index += 0x100;
		}
	}
	return table;
})();

function hash(text: string, hashType: HashType): number {
	let seed1 = 0x7fed7fed;
	let seed2 = 0xeeeeeeee;
	for (const ch of text.toUpperCase()) {
		const code = ch.charCodeAt(0);
		const value = encryptionTable[(HASH_TYPES[hashType] << 8) + code];
		seed1 = (value ^ ((seed1 + seed2) >>> 0)) >>> 0;
		seed2 = (code + seed1 + seed2 + (seed2 << 5) + 3) >>> 0;
	}
	return seed1;
}

function decrypt(data: Uint8Array, key: number): Uint8Array {
	let seed1 = key;
	let seed2 = 0xeeeeeeee;
	const out = new Uint8Array(data.length);
	const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
	const outView = new DataView(out.buffer);
	const words = Math.floor(data.length / 4);
	for (let i = 0; i < words; i++) {
		seed2 = (seed2 + encryptionTable[0x400 + (seed1 & 0xff)]) >>> 0;
		let value = view.getUint32(i * 4, true);
		value = (value ^ ((seed1 + seed2) >>> 0)) >>> 0;
		seed1 = ((((~seed1 << 0x15) >>> 0) + 0x11111111) | (seed1 >>> 0x0b)) >>> 0;
		seed2 = (value + seed2 + (seed2 << 5) + 3) >>> 0;
		outView.setUint32(i * 4, value, true);
	}
	return out;
}

/**
 * Ceiling for one decompressed file. Nothing in a real replay approaches
 * it; without a cap a crafted archive inflates a few hundred kilobytes
 * into gigabytes, and uploads are public — one request would be enough to
 * take the machine down.
 */
export const MAX_FILE_BYTES = 64 * 1024 * 1024;

/**
 * @param expected how many bytes this chunk must produce — the sector size
 * for multi-sector files, the declared file size for single-unit ones.
 * Both decoders are bounded by it: zlib refuses to exceed it, and bzip2
 * writes into a buffer of exactly that size and reports a mismatch.
 * @internal exported for the decompression-bomb tests
 */
export function decompressChunk(
	data: Uint8Array,
	expected: number,
	codecs: Codecs
): Uint8Array {
	const compressionType = data[0];
	if (compressionType === 0) return data;
	if (!Number.isFinite(expected) || expected <= 0 || expected > MAX_FILE_BYTES) {
		throw new Error(`refusing to decompress ${expected} bytes from ${data.length}`);
	}
	const payload = data.subarray(1);
	if (compressionType === 2) return codecs.inflate(payload, expected);
	// given a size, the bzip2 decoder writes into a fixed buffer and refuses
	// to grow it, so an overlong stream throws instead of eating memory
	if (compressionType === 16) return codecs.bunzip(payload, expected);
	throw new Error(`unsupported MPQ compression type ${compressionType}`);
}

interface BlockEntry {
	offset: number;
	archivedSize: number;
	size: number;
	flags: number;
}

interface HashEntry {
	hashA: number;
	hashB: number;
	blockTableIndex: number;
}

export class MPQArchive {
	private data: Uint8Array;
	private view: DataView;
	private codecs: Codecs;
	private archiveOffset: number;
	private sectorSizeShift: number;
	private hashTable: HashEntry[];
	private blockTable: BlockEntry[];
	/** MPQ user-data content — for SC2 replays, the replay header blob. */
	userDataContent: Uint8Array;

	constructor(data: Uint8Array, codecs: Codecs) {
		this.data = data;
		this.codecs = codecs;
		this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);

		if (this.view.getUint32(0, true) !== 0x1b51504d) {
			// 'MPQ\x1b' — SC2 replays always carry a user-data header
			throw new Error('not an SC2 replay (missing MPQ user-data header)');
		}
		const headerOffset = this.view.getUint32(8, true);
		const userDataSize = this.view.getUint32(12, true);
		this.userDataContent = data.subarray(16, 16 + userDataSize);

		if (this.view.getUint32(headerOffset, true) !== 0x1a51504d) {
			// 'MPQ\x1a'
			throw new Error('invalid MPQ header');
		}
		this.archiveOffset = headerOffset;
		this.sectorSizeShift = this.view.getUint16(headerOffset + 14, true);
		const hashTableOffset = this.view.getUint32(headerOffset + 16, true);
		const blockTableOffset = this.view.getUint32(headerOffset + 20, true);
		const hashTableEntries = this.view.getUint32(headerOffset + 24, true);
		const blockTableEntries = this.view.getUint32(headerOffset + 28, true);

		this.hashTable = this.readHashTable(hashTableOffset, hashTableEntries);
		this.blockTable = this.readBlockTable(blockTableOffset, blockTableEntries);
	}

	private readHashTable(offset: number, entries: number): HashEntry[] {
		const raw = decrypt(
			this.data.subarray(this.archiveOffset + offset, this.archiveOffset + offset + entries * 16),
			hash('(hash table)', 'TABLE')
		);
		const view = new DataView(raw.buffer);
		const out: HashEntry[] = [];
		for (let i = 0; i < entries; i++) {
			out.push({
				hashA: view.getUint32(i * 16, true),
				hashB: view.getUint32(i * 16 + 4, true),
				blockTableIndex: view.getUint32(i * 16 + 12, true)
			});
		}
		return out;
	}

	private readBlockTable(offset: number, entries: number): BlockEntry[] {
		const raw = decrypt(
			this.data.subarray(this.archiveOffset + offset, this.archiveOffset + offset + entries * 16),
			hash('(block table)', 'TABLE')
		);
		const view = new DataView(raw.buffer);
		const out: BlockEntry[] = [];
		for (let i = 0; i < entries; i++) {
			out.push({
				offset: view.getUint32(i * 16, true),
				archivedSize: view.getUint32(i * 16 + 4, true),
				size: view.getUint32(i * 16 + 8, true),
				flags: view.getUint32(i * 16 + 12, true)
			});
		}
		return out;
	}

	/**
	 * @param maxBytes stop after this many decompressed bytes. Written for the
	 * bank preload, which sits at the very start of a replay.game.events that
	 * can be ten megabytes and over a second of bzip2. The parser has since
	 * gone back to reading that stream whole — the leave events it wants are
	 * wherever players left — so nothing on the upload path passes this any
	 * more, but the slice stays a supported read (the browser/node parity test
	 * pins it). Callers must tolerate a truncated stream.
	 */
	readFile(filename: string, maxBytes = Infinity): Uint8Array | null {
		const hashA = hash(filename, 'HASH_A');
		const hashB = hash(filename, 'HASH_B');
		const hashEntry = this.hashTable.find((e) => e.hashA === hashA && e.hashB === hashB);
		if (!hashEntry) return null;
		const block = this.blockTable[hashEntry.blockTableIndex];
		if (!(block.flags & MPQ_FILE_EXISTS) || block.archivedSize === 0) return null;
		if (block.flags & MPQ_FILE_ENCRYPTED) {
			throw new Error('encrypted MPQ files are not supported');
		}

		const start = this.archiveOffset + block.offset;
		const fileData = this.data.subarray(start, start + block.archivedSize);

		if (block.flags & MPQ_FILE_SINGLE_UNIT) {
			if (block.flags & MPQ_FILE_COMPRESS && block.size > block.archivedSize) {
				return decompressChunk(fileData, block.size, this.codecs);
			}
			return fileData;
		}

		// multi-sector file
		if (block.size > MAX_FILE_BYTES) {
			throw new Error(`archive declares a ${block.size} byte file`);
		}
		const sectorSize = 512 << this.sectorSizeShift;
		let sectors = Math.floor(block.size / sectorSize) + 1;
		const hasCrc = (block.flags & MPQ_FILE_SECTOR_CRC) !== 0;
		if (hasCrc) sectors += 1;
		const view = new DataView(fileData.buffer, fileData.byteOffset, fileData.byteLength);
		const positions: number[] = [];
		for (let i = 0; i < sectors + 1; i++) positions.push(view.getUint32(i * 4, true));

		const parts: Uint8Array[] = [];
		let bytesLeft = block.size;
		let produced = 0;
		const count = positions.length - (hasCrc ? 2 : 1);
		for (let i = 0; i < count; i++) {
			let sector = fileData.subarray(positions[i], positions[i + 1]);
			if (block.flags & MPQ_FILE_COMPRESS && bytesLeft > sector.length) {
				sector = decompressChunk(sector, Math.min(sectorSize, bytesLeft), this.codecs);
			}
			bytesLeft -= sector.length;
			parts.push(sector);
			produced += sector.length;
			if (produced >= maxBytes) break;
		}
		const total = parts.reduce((n, p) => n + p.length, 0);
		const out = new Uint8Array(total);
		let pos = 0;
		for (const p of parts) {
			out.set(p, pos);
			pos += p.length;
		}
		return out;
	}
}
