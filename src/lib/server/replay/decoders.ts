/**
 * Faithful TS port of s2protocol's decoders (Blizzard, MIT licensed):
 * BitPackedBuffer, BitPackedDecoder (initdata + game events) and
 * VersionedDecoder (header, details, tracker events).
 *
 * Type infos come from protocols/protocol<build>.json — pure data converted
 * from the corresponding s2protocol python module by scripts/convert_protocol.py.
 *
 * Values wider than 32 bits are accumulated with float math (exact below
 * 2^53); the only >53-bit field we read is m_timeUTC, where sub-microsecond
 * rounding cannot move a second-precision timestamp.
 */

export class TruncatedError extends Error {}
export class CorruptedError extends Error {}

/** typeinfo entry: [method, args] as serialized from the python module */
export type TypeInfo = [string, unknown[]];

export class BitPackedBuffer {
	private data: Uint8Array;
	private used = 0;
	private next = 0;
	private nextBits = 0;
	private bigEndian: boolean;

	constructor(contents: Uint8Array, endian: 'big' | 'little' = 'big') {
		this.data = contents;
		this.bigEndian = endian === 'big';
	}

	done(): boolean {
		return this.nextBits === 0 && this.used >= this.data.length;
	}

	usedBits(): number {
		return this.used * 8 - this.nextBits;
	}

	byteAlign(): void {
		this.nextBits = 0;
	}

	readAlignedBytes(count: number): Uint8Array {
		this.byteAlign();
		const data = this.data.subarray(this.used, this.used + count);
		this.used += count;
		if (data.length !== count) throw new TruncatedError('buffer truncated');
		return data;
	}

	readBits(bits: number): number {
		let result = 0;
		let resultBits = 0;
		while (resultBits !== bits) {
			if (this.nextBits === 0) {
				if (this.done()) throw new TruncatedError('buffer truncated');
				this.next = this.data[this.used];
				this.used += 1;
				this.nextBits = 8;
			}
			const copyBits = Math.min(bits - resultBits, this.nextBits);
			const copy = this.next & ((1 << copyBits) - 1);
			// bit-shift via float math: shifts can exceed 32 bits
			if (this.bigEndian) result += copy * 2 ** (bits - resultBits - copyBits);
			else result += copy * 2 ** resultBits;
			this.next >>= copyBits;
			this.nextBits -= copyBits;
			resultBits += copyBits;
		}
		return result;
	}

	readUnalignedBytes(count: number): Uint8Array {
		const out = new Uint8Array(count);
		for (let i = 0; i < count; i++) out[i] = this.readBits(8);
		return out;
	}
}

type Fields = Record<string, [string, number]>; // choice: tag -> [name, typeid]
type StructField = [string, number, number]; // [name, typeid, tag]

abstract class BaseDecoder {
	buffer: BitPackedBuffer;
	protected typeinfos: TypeInfo[];

	constructor(contents: Uint8Array, typeinfos: TypeInfo[]) {
		this.buffer = new BitPackedBuffer(contents);
		this.typeinfos = typeinfos;
	}

	instance(typeid: number): unknown {
		const typeinfo = this.typeinfos[typeid];
		if (!typeinfo) throw new CorruptedError(`unknown typeid ${typeid}`);
		return this.call(typeinfo[0], typeinfo[1]);
	}

	byteAlign(): void {
		this.buffer.byteAlign();
	}

	done(): boolean {
		return this.buffer.done();
	}

	usedBits(): number {
		return this.buffer.usedBits();
	}

	/* eslint-disable @typescript-eslint/no-explicit-any */
	protected call(method: string, args: any[]): unknown {
		switch (method) {
			case '_array':
				return this._array(args[0], args[1]);
			case '_bitarray':
				return this._bitarray(args[0]);
			case '_blob':
				return this._blob(args[0]);
			case '_bool':
				return this._bool();
			case '_choice':
				return this._choice(args[0], args[1]);
			case '_fourcc':
				return this._fourcc();
			case '_int':
				return this._int(args[0]);
			case '_null':
				return null;
			case '_optional':
				return this._optional(args[0]);
			case '_real32':
				return this._real32();
			case '_real64':
				return this._real64();
			case '_struct':
				return this._struct(args[0]);
			default:
				throw new CorruptedError(`unknown typeinfo method ${method}`);
		}
	}
	/* eslint-enable @typescript-eslint/no-explicit-any */

	protected abstract _array(bounds: [number, number], typeid: number): unknown[];
	protected abstract _bitarray(bounds: [number, number]): [number, unknown];
	protected abstract _blob(bounds: [number, number]): Uint8Array;
	protected abstract _bool(): boolean;
	protected abstract _choice(bounds: [number, number], fields: Fields): Record<string, unknown>;
	protected abstract _fourcc(): Uint8Array;
	protected abstract _int(bounds: [number, number]): number;
	protected abstract _optional(typeid: number): unknown;
	protected abstract _real32(): number;
	protected abstract _real64(): number;
	protected abstract _struct(fields: StructField[]): unknown;
}

export class BitPackedDecoder extends BaseDecoder {
	protected _array(bounds: [number, number], typeid: number): unknown[] {
		const length = this._int(bounds);
		const out = new Array(length);
		for (let i = 0; i < length; i++) out[i] = this.instance(typeid);
		return out;
	}

	protected _bitarray(bounds: [number, number]): [number, number] {
		const length = this._int(bounds);
		return [length, this.buffer.readBits(length)];
	}

	protected _blob(bounds: [number, number]): Uint8Array {
		const length = this._int(bounds);
		return this.buffer.readAlignedBytes(length);
	}

	protected _bool(): boolean {
		return this._int([0, 1]) !== 0;
	}

	protected _choice(bounds: [number, number], fields: Fields): Record<string, unknown> {
		const tag = this._int(bounds);
		const field = fields[String(tag)];
		if (!field) throw new CorruptedError(`invalid choice tag ${tag}`);
		return { [field[0]]: this.instance(field[1]) };
	}

	protected _fourcc(): Uint8Array {
		return this.buffer.readUnalignedBytes(4);
	}

	protected _int(bounds: [number, number]): number {
		return bounds[0] + this.buffer.readBits(bounds[1]);
	}

	protected _optional(typeid: number): unknown {
		return this._bool() ? this.instance(typeid) : null;
	}

	protected _real32(): number {
		const b = this.buffer.readUnalignedBytes(4);
		return new DataView(b.buffer, b.byteOffset, 4).getFloat32(0, false);
	}

	protected _real64(): number {
		const b = this.buffer.readUnalignedBytes(8);
		return new DataView(b.buffer, b.byteOffset, 8).getFloat64(0, false);
	}

	protected _struct(fields: StructField[]): unknown {
		let result: Record<string, unknown> = {};
		for (const field of fields) {
			if (field[0] === '__parent') {
				const parent = this.instance(field[1]);
				if (parent !== null && typeof parent === 'object' && !Array.isArray(parent)) {
					Object.assign(result, parent);
				} else if (fields.length === 1) {
					return parent;
				} else {
					result[field[0]] = parent;
				}
			} else {
				result[field[0]] = this.instance(field[1]);
			}
		}
		return result;
	}
}

export class VersionedDecoder extends BaseDecoder {
	private expectSkip(expected: number): void {
		if (this.buffer.readBits(8) !== expected) {
			throw new CorruptedError(`expected tag ${expected}`);
		}
	}

	private vint(): number {
		let b = this.buffer.readBits(8);
		const negative = (b & 1) !== 0;
		let result = (b >> 1) & 0x3f;
		let bits = 6;
		while ((b & 0x80) !== 0) {
			b = this.buffer.readBits(8);
			result += (b & 0x7f) * 2 ** bits;
			bits += 7;
		}
		return negative ? -result : result;
	}

	protected _array(_bounds: [number, number], typeid: number): unknown[] {
		this.expectSkip(0);
		const length = this.vint();
		const out = new Array(length);
		for (let i = 0; i < length; i++) out[i] = this.instance(typeid);
		return out;
	}

	protected _bitarray(_bounds: [number, number]): [number, Uint8Array] {
		this.expectSkip(1);
		const length = this.vint();
		return [length, this.buffer.readAlignedBytes(Math.floor((length + 7) / 8))];
	}

	protected _blob(_bounds: [number, number]): Uint8Array {
		this.expectSkip(2);
		const length = this.vint();
		return this.buffer.readAlignedBytes(length);
	}

	protected _bool(): boolean {
		this.expectSkip(6);
		return this.buffer.readBits(8) !== 0;
	}

	protected _choice(_bounds: [number, number], fields: Fields): Record<string, unknown> {
		this.expectSkip(3);
		const tag = this.vint();
		const field = fields[String(tag)];
		if (!field) {
			this.skipInstance();
			return {};
		}
		return { [field[0]]: this.instance(field[1]) };
	}

	protected _fourcc(): Uint8Array {
		this.expectSkip(7);
		return this.buffer.readAlignedBytes(4);
	}

	protected _int(_bounds: [number, number]): number {
		this.expectSkip(9);
		return this.vint();
	}

	protected _optional(typeid: number): unknown {
		this.expectSkip(4);
		const exists = this.buffer.readBits(8) !== 0;
		return exists ? this.instance(typeid) : null;
	}

	protected _real32(): number {
		this.expectSkip(7);
		const b = this.buffer.readAlignedBytes(4);
		return new DataView(b.buffer, b.byteOffset, 4).getFloat32(0, false);
	}

	protected _real64(): number {
		this.expectSkip(8);
		const b = this.buffer.readAlignedBytes(8);
		return new DataView(b.buffer, b.byteOffset, 8).getFloat64(0, false);
	}

	protected _struct(fields: StructField[]): unknown {
		this.expectSkip(5);
		let result: Record<string, unknown> = {};
		const length = this.vint();
		for (let i = 0; i < length; i++) {
			const tag = this.vint();
			const field = fields.find((f) => f[2] === tag);
			if (field) {
				if (field[0] === '__parent') {
					const parent = this.instance(field[1]);
					if (parent !== null && typeof parent === 'object' && !Array.isArray(parent)) {
						Object.assign(result, parent);
					} else if (fields.length === 1) {
						result = parent as Record<string, unknown>;
					} else {
						result[field[0]] = parent;
					}
				} else {
					result[field[0]] = this.instance(field[1]);
				}
			} else {
				this.skipInstance();
			}
		}
		return result;
	}

	private skipInstance(): void {
		const skip = this.buffer.readBits(8);
		if (skip === 0) {
			// array
			const length = this.vint();
			for (let i = 0; i < length; i++) this.skipInstance();
		} else if (skip === 1) {
			// bitblob
			const length = this.vint();
			this.buffer.readAlignedBytes(Math.floor((length + 7) / 8));
		} else if (skip === 2) {
			// blob
			const length = this.vint();
			this.buffer.readAlignedBytes(length);
		} else if (skip === 3) {
			// choice
			this.vint();
			this.skipInstance();
		} else if (skip === 4) {
			// optional
			if (this.buffer.readBits(8) !== 0) this.skipInstance();
		} else if (skip === 5) {
			// struct
			const length = this.vint();
			for (let i = 0; i < length; i++) {
				this.vint();
				this.skipInstance();
			}
		} else if (skip === 6) {
			this.buffer.readAlignedBytes(1);
		} else if (skip === 7) {
			this.buffer.readAlignedBytes(4);
		} else if (skip === 8) {
			this.buffer.readAlignedBytes(8);
		} else if (skip === 9) {
			this.vint();
		}
	}
}
