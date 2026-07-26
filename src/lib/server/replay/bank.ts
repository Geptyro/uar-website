/**
 * UAR bank (save file) cipher — reversed from the map's MapScript.galaxy.
 *
 * - integers (gf_hx): base-7 strings, least-significant digit first,
 *   digits 0-6 written as "t j c h w y o"
 * - booleans: a random char from "howfk" (true) or "cglzmn" (false)
 * - key names are decoys: nbe/nbw/nbc hold EN/WO/CO experience (cap 250000),
 *   "xp" holds games won per mode, "m" holds gamesPlayed, revives,
 *   avgGameTime + 2 UI offsets, "pb" holds prestige.
 * - "o" is a positional bool string: camos 2-20, 1 separator char,
 *   decals 1-10, sep, Skill Identifiers 1-23, sep, medals 1-13.
 *   Patch keys extend it: "o3" camos 21-25, "o2" SIs 24-30, "qpo" decal 14.
 * - class gear: "p" walker x6, "r" LK19 x9, "s" Predator x6, "jo" robot x2,
 *   "adz" medical visor x2.
 */

const DIGITS = 'tjchwyo'; // base-7 digit alphabet, index = digit value
const TRUE_CHARS = new Set('howfk');

export const XP_CAP = 250000;

/** Decode a gf_hx string to an int (empty string = 0). */
export function hx1(s: string): number {
	let n = 0;
	for (let i = 0; i < s.length; i++) {
		const digit = DIGITS.indexOf(s[i]);
		n += digit * 7 ** i;
	}
	return n;
}

export function hxList(s: string): number[] {
	return s.split(' ').map(hx1);
}

/** Positional bool-string reader; past-the-end reads are false
 * (mirrors gf_recup_nxt in the map script). */
class Bits {
	private s: string;
	private i = 0;
	constructor(s: string) {
		this.s = s;
	}
	next(): boolean {
		if (this.i >= this.s.length) return false;
		return TRUE_CHARS.has(this.s[this.i++]);
	}
}

export interface Unlocks {
	camos: number[];
	decals: number[];
	sis: number[];
	medals: number[];
	walker: boolean[];
	lk19: boolean[];
	predator: boolean[];
	robot: boolean[];
	medvisor: boolean[];
}

export function decodeUnlocks(bank: Record<string, string>): Unlocks {
	const o = new Bits(bank['o'] ?? '');
	const camos: Record<number, boolean> = { 1: true };
	for (let i = 2; i <= 20; i++) camos[i] = o.next();
	camos[19] = true; // load code forces it
	o.next(); // separator
	const decals: Record<number, boolean> = {};
	for (let i = 1; i <= 10; i++) decals[i] = o.next();
	o.next();
	const sis: Record<number, boolean> = {};
	for (let i = 1; i <= 23; i++) sis[i] = o.next();
	o.next();
	const medals: Record<number, boolean> = {};
	for (let i = 1; i <= 13; i++) medals[i] = o.next();

	const o3 = new Bits(bank['o3'] ?? '');
	for (let i = 21; i <= 25; i++) camos[i] = o3.next();
	const o2 = new Bits(bank['o2'] ?? '');
	for (let i = 24; i <= 30; i++) sis[i] = o2.next();
	decals[14] = new Bits(bank['qpo'] ?? '').next();

	const p = new Bits(bank['p'] ?? '');
	const walker = Array.from({ length: 6 }, () => p.next());
	const r = new Bits(bank['r'] ?? '');
	const lk19 = Array.from({ length: 9 }, () => r.next());
	const s = new Bits(bank['s'] ?? '');
	const predator = Array.from({ length: 6 }, () => s.next());
	const jo = new Bits(bank['jo'] ?? '');
	const robot = Array.from({ length: 2 }, () => jo.next());
	const adz = new Bits(bank['adz'] ?? '');
	const medvisor = Array.from({ length: 2 }, () => adz.next());

	// completing a vehicle's gear ladder grants its decal (map load code):
	// walker → Fire Hound, LK19 → Black Wings, Predator → White moon
	decals[11] = walker[5];
	decals[12] = lk19[8];
	decals[13] = predator[5];

	const unlockedIds = (m: Record<number, boolean>) =>
		Object.keys(m)
			.map(Number)
			.filter((k) => m[k])
			.sort((a, b) => a - b);

	return {
		camos: unlockedIds(camos),
		decals: unlockedIds(decals),
		sis: unlockedIds(sis),
		medals: unlockedIds(medals),
		walker,
		lk19,
		predator,
		robot,
		medvisor
	};
}
