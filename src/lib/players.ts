// Player/replay data lives in MongoDB (see $lib/server/db.ts) and is
// server-loaded by the /players and /replays routes; this module holds the
// shared types and pure helpers.
import rawProgression from './data/progression.json';
import { rankTracks, type Rank } from './mos';
import { camos, decals } from './unlocks';

export interface Unlocks {
	camos: number[];
	decals: number[];
	sis: number[];
	medals: number[];
	/** Walker gear: aux generator, shield amplifier, floodlights, flare gun, motion sensor, cluster rockets */
	walker: boolean[];
	/** LK19: enhanced weaponry, aux generator, reconfigured energy I/II, improved rockets I–V */
	lk19: boolean[];
	/** Predator: floodlights, MK II, flare gun, MK III, shield regeneration, MK IV */
	predator: boolean[];
	/** Rjx-73: strike walk, focus fire */
	robot: boolean[];
	/** Advanced medical visor: unlocked, activated */
	medvisor: boolean[];
}

export interface Sighting {
	playedAt: string;
	file: string;
	xpEn: number;
	xpWo: number;
	xpCo: number;
	prestige: number;
	gamesPlayed: number;
	revives: number;
	avgGameTime: number;
	wins: number;
	/** MOS class(es) the player picked in that game (hero units born). */
	mos: string[];
}

export interface PlayerProfile {
	name: string;
	clan: string;
	/** Battle.net toon handle (region-S2-realm-id) — the stable unique id. */
	toon: string;
	xpEn: number;
	xpWo: number;
	xpCo: number;
	prestige: number;
	gamesPlayed: number;
	revives: number;
	/** Average game length in seconds. */
	avgGameTime: number;
	/** Games won per game mode, aligned with `modeNames`. */
	winsByMode: number[];
	/** Currently equipped camo / decal ids. */
	camo: number;
	decal: number;
	unlocks: Unlocks;
	/** Classes picked in the newest sighting. */
	mos: string[];
	lastSeen: string;
	/** One entry per ingested replay this player appears in, oldest first. */
	history: Sighting[];
}

/** One row of a per-class leaderboard (GET /api/mos-players/[id]). */
export interface MosTopPlayer {
	name: string;
	clan: string;
	toon: string;
	/** Ingested games where the player picked this class. */
	games: number;
	/** Total recorded time on this class across ingested replays, in seconds. */
	seconds: number;
}

const progression = rawProgression as { modes: string[] };

export interface ReplayMeta {
	file: string;
	playedAt: string;
	players: number;
	/** File size in bytes; served for download at /replays/<file>. */
	size: number;
}

/** Game mode names; winsByMode[i] is the mode modeNames[i]. */
export const modeNames: string[] = progression.modes;

const camoByNum = new Map(camos.map((c) => [c.num, c]));
const decalByNum = new Map(decals.map((d) => [d.num, d]));

export function camoName(num: number): string {
	return camoByNum.get(num)?.name ?? `#${num}`;
}

export function decalName(num: number): string {
	return num === 0 ? 'Rank insignia' : (decalByNum.get(num)?.name ?? `#${num}`);
}

export const gearGroups: { key: keyof Unlocks; label: string; items: string[] }[] = [
	{
		key: 'walker',
		label: 'Walker gear',
		items: [
			'Auxiliary generator',
			'Shield amplifier',
			'Floodlights',
			'Flare gun',
			'Motion sensor',
			'Cluster rockets'
		]
	},
	{
		key: 'lk19',
		label: 'Alligator LK19',
		items: [
			'Enhanced weaponry',
			'Auxiliary generator',
			'Reconfigured energy I',
			'Reconfigured energy II',
			'Improved rockets I',
			'Improved rockets II',
			'Improved rockets III',
			'Improved rockets IV',
			'Improved rockets V'
		]
	},
	{
		key: 'predator',
		label: 'Predator',
		items: ['Floodlights', 'MK II', 'Flare gun', 'MK III', 'Shield regeneration', 'MK IV']
	},
	{ key: 'robot', label: 'Robot Rjx-73', items: ['Strike walk', 'Focus fire'] },
	{ key: 'medvisor', label: 'Combat Medic', items: ['Advanced medical visor', 'Visor activated'] }
];

/** Highest rank reached in a track (1-based track number) for a given XP. */
export function rankFor(track: number, xp: number): Rank | null {
	const ranks = rankTracks.find((t) => t.track === track)?.ranks ?? [];
	let best: Rank | null = null;
	for (const r of ranks) {
		if (xp >= r.xp) best = r;
	}
	return best;
}

/** The next rank above the given XP, or null at max rank. */
export function nextRank(track: number, xp: number): Rank | null {
	const ranks = rankTracks.find((t) => t.track === track)?.ranks ?? [];
	for (const r of ranks) {
		if (xp < r.xp) return r;
	}
	return null;
}

export { totalWins, totalXp, careerXp, XP_CAP } from './xp.ts';
