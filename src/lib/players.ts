// Player/replay data lives in MongoDB (see $lib/server/db.ts) and is
// server-loaded by the /players and /replays routes; this module holds the
// shared types and pure helpers.
import rawProgression from './data/progression.json';
import { rankTracks, type Rank } from './mos';
import { camos, decals } from './unlocks';
import type { Outcome } from './outcome';

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
	/** SC2 portrait when the player linked their Battle.net account. */
	avatarUrl?: string | null;
	/** Ingested games where the player picked this class. */
	games: number;
	/** Total recorded time on this class across ingested replays, in seconds. */
	seconds: number;
}

/** One row of a profile's "played with" board (see server/teammates.ts). */
export interface Teammate {
	name: string;
	clan: string;
	toon: string;
	/** SC2 portrait when the teammate linked their Battle.net account. */
	avatarUrl?: string | null;
	/** Ingested games the two players shared. */
	games: number;
	/** Total recorded time of those games, in seconds. */
	seconds: number;
}

/** One row of the overview page's 7-day XP leaderboard. */
export interface WeeklyXpEntry {
	name: string;
	clan: string;
	toon: string;
	/** Career XP gained inside the window (prestige-aware, see careerXp). */
	xpGained: number;
	/** Bank games-played delta over the same span. */
	games: number;
}

/** One row of the overview's prestiged-this-week honor roll. */
export interface WeeklyPrestige {
	name: string;
	clan: string;
	toon: string;
	/** Prestige level at the baseline sighting / at the newest one. */
	from: number;
	to: number;
}

/** One row of the overview's class-picks widget. */
export interface WeeklyClassPick {
	/** MOS unit id (matches /mos/[id]). */
	mos: string;
	/** Times the class was picked across ingested games this week. */
	picks: number;
}

/** The overview page's 7-day widgets, computed in one pass (see server/weekly.ts). */
export interface WeeklyBoards {
	xp: WeeklyXpEntry[];
	prestiged: WeeklyPrestige[];
	classPicks: WeeklyClassPick[];
}

const progression = rawProgression as { modes: string[] };

export interface ReplayMeta {
	file: string;
	playedAt: string;
	players: number;
	/** Size of the recorded file in bytes. Kept as part of the game's record
	 * even once the file itself is no longer stored (see blobPruned). */
	size: number;
	/** Recording length in game loops (16 per game-second). */
	durationLoops: number;
	/** Absent until one source or the other can settle it — see lib/outcome.ts. */
	outcome?: Outcome;
	/** The file was released by the retention sweep — the game is still on
	 * record, but there is nothing to download. */
	blobPruned?: boolean;
}

/** One player row of an individual replay page (/replays/[id]). */
export interface ReplayPlayer {
	name: string;
	clan: string;
	/** Battle.net toon handle — links to the player profile. */
	toon: string;
	/** MOS class(es) the player picked in this game. */
	mos: string[];
	/** Career save-file values as of game start. */
	xpEn: number;
	xpWo: number;
	xpCo: number;
	prestige: number;
	gamesPlayed: number;
	revives: number;
}

/** Full detail of one ingested replay (server-loaded at /replays/[id]). */
export interface ReplayDetail {
	file: string;
	playedAt: string;
	/** Map title recorded in the replay. */
	title: string;
	baseBuild: number;
	size: number;
	/** Recording length in game loops (16 per game-second). */
	durationLoops: number;
	/** Null while neither source can settle it — see lib/outcome.ts. */
	outcome: Outcome | null;
	/**
	 * The blob was dropped by the retention sweep, so there is nothing to
	 * download. Everything else on this page still comes from the stored
	 * sightings — only the file itself is gone.
	 */
	blobPruned: boolean;
	players: ReplayPlayer[];
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

/** One account-progression unlock; the index in `items` matches the bank flag order. */
export interface GearItem {
	name: string;
	/** Position in the pilot-rank ladder — class-page display order. */
	rank: number;
	/** What it does, from the in-game button tooltip (map GameStrings). */
	desc: string | null;
	/** How it is earned, from the map's requirement/trigger strings. */
	req: string | null;
}

/** Per-class account-progression gear; `mosId` is the class that owns the vehicle/visor. */
export const gearGroups: {
	key: keyof Unlocks;
	label: string;
	mosId: string;
	/** Pilot-rank ladder: pieces unlock in rank order, each needing the previous ones. */
	ordered: boolean;
	items: GearItem[];
}[] = [
	{
		key: 'walker',
		label: 'Walker gear',
		mosId: 'FP500CombatWalker',
		ordered: true,
		items: [
			{
				name: 'Auxiliary generator',
				rank: 2,
				desc: 'Utilizes kinetic motion to generate additional power — energy regeneration +30%.',
				req: 'Win PMC mode'
			},
			{
				name: 'Shield amplifier',
				rank: 3,
				desc: 'Module improving shield regeneration — +2 shield per second.',
				req: 'Win Hard OB mode'
			},
			{
				name: 'Floodlights',
				rank: 4,
				desc: 'Switchable floodlights that light up the surroundings, draining energy while on.',
				req: 'Win Hard T1'
			},
			{
				name: 'Flare gun',
				rank: 1,
				desc: 'Fires a flare above the target point, removing the fog of war for 45 seconds. Detects invisible units and slows nearby enemies — but enemies gain vision from it too.',
				req: "Kill 100 units with the Walker's rockets"
			},
			{ name: 'Motion sensor', rank: 5, desc: 'Detects motion for 4.5 minutes.', req: 'Win Insane OB' },
			{
				name: 'Cluster rockets',
				rank: 6,
				desc: 'Fires a barrage of 6 randomly-guided rockets, 900 damage each, temporarily stunning targets. Explosions damage allies and items.',
				req: 'Win Nightmare taking 5 hits or fewer'
			}
		]
	},
	{
		key: 'lk19',
		label: 'Alligator LK19',
		mosId: 'AlligatorLK19',
		ordered: true,
		items: [
			{
				name: 'Enhanced weaponry',
				rank: 1,
				desc: 'Jam immunity, reload speed +15%, move speed +0.2.',
				req: null
			},
			{
				name: 'Auxiliary generator',
				rank: 2,
				desc: 'Regenerates 1.25 energy per second.',
				req: 'Win Insane OB'
			},
			{
				name: 'Reconfigured energy I',
				rank: 3,
				desc: 'Reconfigured energy system — energy max +50, energy regeneration +0.5.',
				req: 'Win Nightmare'
			},
			{
				name: 'Reconfigured energy II',
				rank: 4,
				desc: 'Second step of the reconfigured energy system.',
				req: 'Win PMC'
			},
			{
				name: 'Improved rockets I',
				rank: 5,
				desc: 'Enhanced combustion system — rocket speed +100% once all five steps are done.',
				req: 'Win Hard'
			},
			{ name: 'Improved rockets II', rank: 6, desc: null, req: 'Win Hard' },
			{ name: 'Improved rockets III', rank: 7, desc: null, req: 'Win Insane' },
			{ name: 'Improved rockets IV', rank: 8, desc: null, req: 'Win Insane' },
			{ name: 'Improved rockets V', rank: 9, desc: null, req: 'Win Nightmare OB' }
		]
	},
	{
		key: 'predator',
		label: 'Predator',
		mosId: 'AssaultEngineer',
		ordered: true,
		items: [
			{
				name: 'Floodlights',
				rank: 1,
				desc: 'Switchable floodlights, draining energy while on.',
				req: null
			},
			{ name: 'MK II', rank: 2, desc: 'Move speed +0.01, energy max +20.', req: 'Win PMC mode' },
			{
				name: 'Flare gun',
				rank: 3,
				desc: 'Fires a flare above the target point, removing the fog of war for 45 seconds. Detects invisible units and slows nearby enemies.',
				req: 'Win Hard with 1 life'
			},
			{
				name: 'MK III',
				rank: 4,
				desc: 'Move speed +0.01, energy max +20, life +20.',
				req: 'Win Insane'
			},
			{ name: 'Shield regeneration', rank: 5, desc: null, req: 'Win Nightmare' },
			{
				name: 'MK IV',
				rank: 6,
				desc: 'Move speed +0.01, energy max +20, life +60.',
				req: 'Win Insane with 1 life'
			}
		]
	},
	{
		key: 'robot',
		label: 'Robot Rjx-73',
		mosId: 'Rjx73',
		ordered: false,
		items: [
			{
				name: 'Strike walk',
				rank: 1,
				desc: 'The Robot dashes through enemies for 2 seconds, damaging everything in its path. A pure movement modifier — you keep steering during the strike.',
				req: "Learned by observing an Assault Engineer's Strike Walk"
			},
			{
				name: 'Focus fire',
				rank: 2,
				desc: 'Increases damage by 20% and range by 1.5 for 10 seconds.',
				req: "Learned by observing a Rifleman's Focus Fire"
			}
		]
	},
	{
		key: 'medvisor',
		label: 'Combat Medic',
		mosId: 'CombatMedic',
		ordered: false,
		items: [
			{
				name: 'Advanced medical visor',
				rank: 1,
				desc: 'Provides the auto-SITREP.',
				req: 'Win a PMC, or a Hard, Insane or Nightmare game with 10 or more heals, as Combat Medic'
			},
			{
				name: 'Visor activated',
				rank: 2,
				desc: 'Whether the auto-SITREP visor is switched on (profile checkbox).',
				req: null
			}
		]
	}
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
