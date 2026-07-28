/**
 * UAR player extraction from SC2 replays — TS port of scripts/extract_players.py.
 *
 * SC2 replays record, at game start, the full contents of every player's UAR
 * bank (the map's save file) as bank events in the game-events stream, plus a
 * signature event carrying the owner's toon handle. Tracker events additionally
 * reveal each player's class picks (hero units born).
 *
 * Object key order deliberately mirrors the python script so both generators
 * produce byte-identical players.json.
 */

import { MPQArchive } from './mpq.ts';
import {
	getProtocol,
	hasProtocol,
	decodeReplayHeader,
	decodeReplayDetails,
	decodeReplayInitdata,
	decodeReplayGameEvents,
	decodeReplayTrackerEvents
} from './protocol.ts';
import { hx1, hxList, decodeUnlocks, XP_CAP, type Unlocks } from './bank.ts';
import { decodeAttributes, lobbyVotedMode } from './attributes.ts';
import { tallyModeVotes, type ModeVoter } from '../../mode.ts';

const utf8 = new TextDecoder('utf-8');

function utf(value: unknown): string {
	if (value instanceof Uint8Array) return utf8.decode(value);
	return String(value ?? '');
}

/** Replay m_timeUTC is 100ns ticks since 1601-01-01. */
export function filetimeToIso(ft: number): string {
	const EPOCH_1601_MS = Date.UTC(1601, 0, 1);
	const date = new Date(EPOCH_1601_MS + ft / 10000);
	return date.toISOString().slice(0, 19) + 'Z';
}

export interface ReplaySighting {
	name: string;
	clan: string;
	toon: string;
	xpEn: number;
	xpWo: number;
	xpCo: number;
	prestige: number;
	gamesPlayed: number;
	revives: number;
	avgGameTime: number;
	winsByMode: number[];
	camo: number;
	decal: number;
	unlocks: Unlocks;
	mos: string[];
	playedAt: string;
	file: string;
}

/** How a game ended, as far as the replay itself can tell. */
export type ReplayOutcome = 'win' | 'loss';

/**
 * End-of-game markers, both read from tracker events.
 *
 * Win: the map's ending cinematic spawns a "Planet" prop (MapScript.galaxy,
 * gf_IniGameEndCinematic and gf_InvasionGameEndCinematicSuccess). Every path
 * that reaches it goes on to gf_RegularGameCompleted — the function that
 * increments the players' win counter — and no losing path spawns it.
 *
 * Loss: the map's game-over condition is libNtve_gf_UnitGroupIsDead on the
 * hero group. It replaces each fallen hero with a DeadHeroIndicator unit
 * (DeadHeroIndicator2 for vehicles), removed again on revive, so "every hero
 * owner had one when the recording stopped" is that same condition. Hero
 * deaths alone would not do: revives are not recorded as births, so counting
 * hero deaths reads a won game where everyone died once as a wipe.
 */
const WIN_PROP = 'Planet';
const DEAD_HERO = 'DeadHeroIndicator';

/**
 * The map's opening mode vote, as dialog-button clicks.
 *
 * gt_ModeSelect_Func builds one button per mode and reads the click straight
 * off it, so the vote is in the game-events stream as twelve control ids. The
 * ids are positional: every one of gf_CreateDifficultyButton{Left,Center,Right}
 * makes exactly four controls with the button second, so the buttons run at a
 * stride of four in the order gt_ModeSelect_Func creates them — the five
 * regular difficulties, Apocalypse, then the centre and right columns.
 *
 * The base is the one thing that is not derivable: it is wherever the map's
 * earlier dialogs happened to leave the counter, and a future version of the
 * map that adds a control before the mode dialog would shift it. It has held
 * across every build from 92174 to 97563, and two things would catch it
 * moving: `tests/replay-mode.test.ts` pins it against the sample replays, and
 * `scripts/backfill-modes.ts --verify` grades this reader against the
 * save-file win counters, which need no constant at all. That check stands at
 * 170/171 over the archive, so the run below is where it should be.
 */
const VOTE_BUTTON_BASE = 43;
const VOTE_BUTTON_STRIDE = 4;
const VOTE_BUTTON_MODES = [1, 2, 3, 4, 5, 12, 7, 8, 11, 6, 9, 10];
/** m_eventType of a dialog button being clicked (0 = clicked). */
const DIALOG_CLICKED = 0;
/**
 * How long the ballot stays open after the first vote is cast.
 *
 * gt_IniModeDialog_Func opens the dialog once every player's bank has loaded —
 * which is not at a fixed time, and on a full lobby of big save files can be a
 * good while in — and then runs gv_timermodevalue down from twenty seconds.
 * Nobody can click before the dialog opens, so "first click + the timer" is
 * never shorter than the real window and never runs past the point where the
 * buttons stop existing. A couple of seconds of slack covers the timer's
 * one-second tick and the waits gt_SetMode does before it counts.
 */
const VOTE_BALLOT_LOOPS = 16 * 23;
/**
 * How far in to keep decoding while looking for the vote. Generous, because
 * the dialog's opening time rides on bank loading, and free: the cost of the
 * head of game.events is decompressing the slice, not decoding the events in
 * it, so scanning further costs nothing measurable.
 */
const VOTE_SCAN_LOOPS = 16 * 300;

/** Dialog control id -> mode, exported so a test can pin it to real clicks. */
export const MODE_VOTE_BUTTONS = new Map(
	VOTE_BUTTON_MODES.map((mode, i) => [VOTE_BUTTON_BASE + i * VOTE_BUTTON_STRIDE, mode])
);

export interface ParsedReplay {
	file: string;
	playedAt: string;
	/** Map title from the replay details — validate against the UAR map name. */
	title: string;
	baseBuild: number;
	/** False when we fell back to another protocol version. */
	protocolExact: boolean;
	/**
	 * Lobby-wide 32-bit random value (m_gameDescription.m_randomValue) — the
	 * closest thing to a game-session id a replay carries. Identical in every
	 * participant's replay of the same game, so it dedupes cross-player
	 * uploads even when their clients stamped slightly different times.
	 */
	lobbyId: number;
	/** Recording length in game loops (16 per game-second) — a leaver's
	 * recording is shorter than one that saw the game end. */
	durationLoops: number;
	/**
	 * How the game ended, or null when the recording stopped mid-game (the
	 * uploader left early, which is the common case for a leaver's copy).
	 */
	outcome: ReplayOutcome | null;
	/**
	 * Which of the map's twelve modes the game was played on (1..12), or null
	 * when the recording stopped before the vote closed — or when the vote
	 * itself came down to the map's random tie-break. See lib/mode.ts.
	 */
	mode: number | null;
	sightings: ReplaySighting[];
}

/**
 * Cheap header/details-only read — enough for map-title validation and the
 * canonical (game-time) name, without decoding the multi-MB event streams.
 * Lets the upload endpoint reject duplicates before doing real work.
 */
export function peekReplay(
	data: Uint8Array
): Pick<ParsedReplay, 'playedAt' | 'title' | 'baseBuild' | 'protocolExact' | 'lobbyId' | 'durationLoops'> {
	const archive = new MPQArchive(data);
	const header = decodeReplayHeader(archive.userDataContent);
	const baseBuild = header.m_version.m_baseBuild as number;
	const protocol = getProtocol(baseBuild);
	const details = decodeReplayDetails(protocol, archive.readFile('replay.details')!);
	const initdata = decodeReplayInitdata(protocol, archive.readFile('replay.initData')!);
	return {
		playedAt: filetimeToIso(details.m_timeUTC as number),
		title: utf(details.m_title),
		baseBuild,
		protocolExact: hasProtocol(baseBuild),
		lobbyId: initdata.m_syncLobbyState.m_gameDescription.m_randomValue as number,
		durationLoops: header.m_elapsedGameLoops as number
	};
}

export function parseReplay(file: string, data: Uint8Array, mosIds: Set<string>): ParsedReplay {
	const archive = new MPQArchive(data);
	const header = decodeReplayHeader(archive.userDataContent);
	const baseBuild = header.m_version.m_baseBuild as number;
	const protocol = getProtocol(baseBuild);

	const details = decodeReplayDetails(protocol, archive.readFile('replay.details')!);
	const initdata = decodeReplayInitdata(protocol, archive.readFile('replay.initData')!);
	const users = initdata.m_syncLobbyState.m_userInitialData as {
		m_name: Uint8Array;
		m_clanTag: Uint8Array | null;
	}[];
	const playedAt = filetimeToIso(details.m_timeUTC as number);
	const title = utf(details.m_title);

	// bank contents per user, replayed as events at gameloop 0
	const banks = new Map<number, Record<string, string>>();
	const toons = new Map<number, string>();
	const curBank = new Map<number, string>();
	const curKey = new Map<number, string>();
	// every click on a mode button, in order, with the loop it landed on: the
	// map refuses a click for a mode the player has not unlocked and lets them
	// click again, so which one counted is the tally's business, not the
	// scanner's
	const modeClicks: { user: number; mode: number; loop: number }[] = [];
	// The preload is replayed at gameloop 0 and the mode vote closes inside
	// the first minute, so only the head of game.events matters.
	// Decompressing the whole stream costs over a second on a long game — an
	// order of magnitude more than decoding the few hundred events we want —
	// so read a slice and fall back to the whole file if it did not cover the
	// preload.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const scanHead = (events: Generator<any>): { preload: boolean; endLoop: number } => {
		let preload = false;
		let endLoop = 0;
		for (const ev of events) {
			const loop = ev._gameloop as number;
			if (loop > VOTE_SCAN_LOOPS) return { preload: true, endLoop: loop };
			endLoop = loop;
			if (loop > 0) preload = true; // past the bank preload
			const t = ev._event as string;
			if (t.endsWith('STriggerDialogControlEvent')) {
				const mode = MODE_VOTE_BUTTONS.get(ev.m_controlId as number);
				if (mode !== undefined && ev.m_eventType === DIALOG_CLICKED) {
					modeClicks.push({ user: ev._userid.m_userId as number, mode, loop });
				}
				continue;
			}
			if (!t.includes('Bank')) continue;
			const uid = ev._userid.m_userId as number;
			if (t.endsWith('SBankFileEvent')) {
				curBank.set(uid, utf(ev.m_name));
			} else if (curBank.get(uid) !== 'UAR') {
				continue;
			} else if (t.endsWith('SBankKeyEvent')) {
				if (!banks.has(uid)) banks.set(uid, {});
				banks.get(uid)![utf(ev.m_name)] = utf(ev.m_data);
				curKey.set(uid, utf(ev.m_name));
			} else if (t.endsWith('SBankValueEvent')) {
				// value continuation for the preceding key event
				if (!banks.has(uid)) banks.set(uid, {});
				banks.get(uid)![curKey.get(uid) ?? '?'] = utf(ev.m_data);
			} else if (t.endsWith('SBankSignatureEvent')) {
				toons.set(uid, utf(ev.m_toonHandle));
			}
		}
		// ran out of events: the recording itself stopped this early
		return { preload, endLoop };
	};

	// 512 KB covers a full twelve-player preload several times over, and
	// decodes several game-minutes past the vote even on a busy twelve-player
	// opening
	let scanned: { preload: boolean; endLoop: number };
	try {
		scanned = scanHead(
			decodeReplayGameEvents(protocol, archive.readFile('replay.game.events', 512 * 1024)!)
		);
	} catch {
		scanned = { preload: false, endLoop: 0 }; // slice ended mid-event
	}
	if (!scanned.preload) {
		banks.clear();
		toons.clear();
		curBank.clear();
		curKey.clear();
		modeClicks.length = 0;
		scanned = scanHead(decodeReplayGameEvents(protocol, archive.readFile('replay.game.events')!));
	}

	// class picks (each player's hero unit(s) born) and the end-of-game
	// markers, from tracker events
	const playerToUser = new Map<number, number>();
	const mosPlayed = new Map<number, string[]>();
	let endCinematic = false;
	const heroOwners = new Set<number>();
	/** unit tag -> owning player, for the dead-hero markers standing right now */
	const markers = new Map<string, number>();
	const markedPlayers = new Set<number>();
	for (const ev of decodeReplayTrackerEvents(protocol, archive.readFile('replay.tracker.events')!)) {
		const t = ev._event as string;
		if (t.endsWith('SPlayerSetupEvent')) {
			if (ev.m_userId !== null && ev.m_userId !== undefined) {
				playerToUser.set(ev.m_playerId as number, ev.m_userId as number);
			}
		} else if (t.endsWith('SUnitBornEvent')) {
			const unit = utf(ev.m_unitTypeName);
			const pid = ev.m_controlPlayerId as number;
			const uid = playerToUser.get(pid);
			if (unit === WIN_PROP) endCinematic = true;
			if (unit.startsWith(DEAD_HERO)) {
				markers.set(`${ev.m_unitTagIndex}/${ev.m_unitTagRecycle}`, pid);
				markedPlayers.add(pid);
			}
			if (mosIds.has(unit) && uid !== undefined) {
				heroOwners.add(pid);
				if (!mosPlayed.has(uid)) mosPlayed.set(uid, []);
				const list = mosPlayed.get(uid)!;
				if (!list.includes(unit)) list.push(unit);
			}
		} else if (t.endsWith('SUnitDiedEvent')) {
			const tag = `${ev.m_unitTagIndex}/${ev.m_unitTagRecycle}`;
			const pid = markers.get(tag);
			if (pid !== undefined) {
				markers.delete(tag);
				// revived: this player is only still down if another of their
				// markers is standing (heroes with more than one body)
				if (![...markers.values()].includes(pid)) markedPlayers.delete(pid);
			}
		}
	}
	const outcome: ReplayOutcome | null = endCinematic
		? 'win'
		: heroOwners.size > 0 && [...heroOwners].every((p) => markedPlayers.has(p))
			? 'loss'
			: null;

	const sightings: ReplaySighting[] = [];
	for (const [uid, bank] of banks) {
		const u = users[uid];
		const m = hxList(bank['m'] ?? '');
		sightings.push({
			name: utf(u.m_name),
			clan: utf(u.m_clanTag ?? ''),
			toon: toons.get(uid) ?? '',
			xpEn: Math.min(hx1(bank['nbe'] ?? ''), XP_CAP),
			xpWo: Math.min(hx1(bank['nbw'] ?? ''), XP_CAP),
			xpCo: Math.min(hx1(bank['nbc'] ?? ''), XP_CAP),
			prestige: hx1(bank['pb'] ?? ''),
			gamesPlayed: m[0] ?? 0,
			revives: m[1] ?? 0,
			avgGameTime: m[2] ?? 0,
			winsByMode: hxList((bank['xp'] ?? '').replace(/\s+$/, '')),
			camo: Number(bank['CurrentCamo'] || 0),
			decal: Number(bank['CurrentDecal'] || 0),
			unlocks: decodeUnlocks(bank),
			mos: mosPlayed.get(uid) ?? [],
			playedAt,
			file
		});
	}

	// The lobby can settle the mode before the game starts; when it has not —
	// the map's default — the opening vote does, and that only counts if the
	// recording lasted past it.
	const activePlayers = [...playerToUser.keys()].sort((a, b) => a - b);
	const attrs = decodeAttributes(archive.readFile('replay.attributes.events') ?? new Uint8Array());

	// The ballot is the clicks inside one timer's length of the first of them;
	// anything later belongs to whatever dialog came after the vote, not to it.
	const opened = modeClicks.length ? modeClicks[0].loop : 0;
	const closes = opened + VOTE_BALLOT_LOOPS;
	const clicksByUser = new Map<number, number[]>();
	for (const c of modeClicks) {
		if (c.loop > closes) break; // modeClicks is in event order, so in loop order
		const list = clicksByUser.get(c.user);
		if (list) list.push(c.mode);
		else clicksByUser.set(c.user, [c.mode]);
	}
	const voters: ModeVoter[] = [...clicksByUser].map(([uid, clicks]) => {
		const bank = banks.get(uid);
		return {
			clicks,
			xp: bank
				? Math.min(hx1(bank['nbe'] ?? ''), XP_CAP) +
					Math.min(hx1(bank['nbw'] ?? ''), XP_CAP) +
					Math.min(hx1(bank['nbc'] ?? ''), XP_CAP)
				: 0,
			prestige: bank ? hx1(bank['pb'] ?? '') : 0
		};
	});

	// Two things have to hold before the tally is worth anything: somebody
	// voted, and the recording lasted past the close of the ballot. Without
	// the first, the map's own count would answer Normal — its default for a
	// lobby that let the timer run out — when much more likely we are simply
	// not looking at a vote at all. Without the second we are counting a
	// half-cast ballot, which is how a leaver's copy reads.
	const counted = voters.length > 0 && scanned.endLoop >= closes;
	const mode =
		lobbyVotedMode(attrs, activePlayers) ??
		(counted ? tallyModeVotes(voters, activePlayers.length) : null);

	return {
		file,
		playedAt,
		title,
		baseBuild,
		protocolExact: hasProtocol(baseBuild),
		lobbyId: initdata.m_syncLobbyState.m_gameDescription.m_randomValue as number,
		durationLoops: header.m_elapsedGameLoops as number,
		outcome,
		mode,
		sightings
	};
}

interface HistoryEntry {
	playedAt: string;
	file: string;
	xpEn: number;
	xpWo: number;
	xpCo: number;
	prestige: number;
	gamesPlayed: number;
	revives: number;
	avgGameTime: number;
	mos: string[];
	wins: number;
}

export interface PlayersData {
	replays: { file: string; playedAt: string; players: number; size: number }[];
	players: Record<string, unknown>[];
}

/** Merge parsed replays into the players.json structure (newest sighting wins). */
export function buildPlayersData(parsed: { replay: ParsedReplay; size: number }[]): PlayersData {
	const byToon = new Map<string, ReplaySighting[]>();
	const replaysMeta: PlayersData['replays'] = [];

	for (const { replay, size } of [...parsed].sort((a, b) =>
		a.replay.file < b.replay.file ? -1 : a.replay.file > b.replay.file ? 1 : 0
	)) {
		replaysMeta.push({
			file: replay.file,
			playedAt: replay.playedAt,
			players: replay.sightings.length,
			size
		});
		for (const s of replay.sightings) {
			const key = s.toon || s.name;
			if (!byToon.has(key)) byToon.set(key, []);
			byToon.get(key)!.push(s);
		}
	}

	const players: Record<string, unknown>[] = [];
	for (const sightings of byToon.values()) {
		sightings.sort((a, b) => (a.playedAt < b.playedAt ? -1 : a.playedAt > b.playedAt ? 1 : 0));
		const cur = sightings[sightings.length - 1];
		// Ladder-completion decals (walker/LK19/Predator → 11/12/13) are derived, not
		// bank-stored; re-derive here so sightings decoded before this rule still get them.
		const decalSet = new Set(cur.unlocks.decals);
		for (const [num, has] of [
			[11, cur.unlocks.walker?.[5]],
			[12, cur.unlocks.lk19?.[8]],
			[13, cur.unlocks.predator?.[5]]
		] as [number, boolean | undefined][]) {
			if (has) decalSet.add(num);
		}
		cur.unlocks.decals = [...decalSet].sort((a, b) => a - b);
		const history: HistoryEntry[] = sightings.map((s) => ({
			playedAt: s.playedAt,
			file: s.file,
			xpEn: s.xpEn,
			xpWo: s.xpWo,
			xpCo: s.xpCo,
			prestige: s.prestige,
			gamesPlayed: s.gamesPlayed,
			revives: s.revives,
			avgGameTime: s.avgGameTime,
			mos: s.mos,
			wins: s.winsByMode.reduce((a, b) => a + b, 0)
		}));
		players.push({
			name: cur.name,
			clan: cur.clan,
			toon: cur.toon,
			xpEn: cur.xpEn,
			xpWo: cur.xpWo,
			xpCo: cur.xpCo,
			prestige: cur.prestige,
			gamesPlayed: cur.gamesPlayed,
			revives: cur.revives,
			avgGameTime: cur.avgGameTime,
			winsByMode: cur.winsByMode,
			camo: cur.camo,
			decal: cur.decal,
			unlocks: cur.unlocks,
			mos: cur.mos,
			lastSeen: cur.playedAt,
			history
		});
	}

	// career XP: prestige requires 3x250k and resets each track to 50k,
	// so every prestige level represents 600k earned on top of current XP
	const careerXp = (p: Record<string, unknown>) =>
		(p.prestige as number) * 600000 +
		(p.xpEn as number) +
		(p.xpWo as number) +
		(p.xpCo as number);
	players.sort((a, b) => careerXp(b) - careerXp(a));

	replaysMeta.sort((a, b) => (a.playedAt < b.playedAt ? -1 : a.playedAt > b.playedAt ? 1 : 0));
	return { replays: replaysMeta, players };
}
