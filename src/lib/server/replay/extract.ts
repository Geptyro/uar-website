/**
 * UAR player extraction from SC2 replays — TS port of scripts/extract_players.py.
 *
 * SC2 replays record, at game start, the full contents of every player's UAR
 * bank (the map's save file) as bank events in the game-events stream, plus a
 * signature event carrying the owner's toon handle. Tracker events additionally
 * reveal each player's class picks (hero units born).
 *
 * Object key order deliberately mirrors the python script, which was the
 * reference this port was checked against byte for byte. The port has since
 * moved on from it — `leftLoop` on a sighting and `playSeconds` on a player
 * come from streams the script never read — so the two no longer agree, but
 * the shared keys keep their order and their meaning.
 */

import { MPQArchive } from './mpq-node.ts';
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
// dependency-free by design, so the CLIs and node:test can load this file
import { awardsBetween, isCreditable, type Award, type AwardRankTrack } from '../../awards.ts';
// the rank ladders, straight from the extractor's own output — imported the
// way protocol.ts already imports its tables, which is the form that survives
// all three of Vite, the worker bundle and bare node
import rankData from '../../data/ranks.json' with { type: 'json' };

/** Rank ladders in the shape awards.ts wants; `ranks` is ascending by XP. */
const RANK_TRACKS = rankData as AwardRankTrack[];
import { decodeAttributes, lobbyVotedMode } from './attributes.ts';
import { tallyModeVotes, type ModeVoter } from '../../mode.ts';
import { tallyModifiers, type ModifierEvent } from './modifiers.ts';
import {
	exitDialogLoop,
	gameEndLoop,
	needsExitScan,
	playedLoops,
	LOOPS_PER_SECOND,
	type DialogClick,
	type PlayerEnd
} from '../../gameEnd.ts';

/**
 * Which generation of this parser wrote a replay document's sightings.
 * Stamped on every doc the ingest writes, so a backfill can ask "which
 * readable docs has a newer parser not seen?" without a marker field per
 * feature. Bump it when the parser starts writing something onto sightings
 * that older docs lack and a re-read of the blob could supply
 * (scripts/backfill-parser.ts re-reads every readable doc below it).
 *
 *   1 — `leftLoop` per sighting
 *   2 — `leftReason`, `result`, `host`, `deaths`, `deadLoops` per sighting,
 *       `mapChecksum` per game. (A 3 briefly existed for combat heatmaps,
 *       which were built and then dropped before release; docs stamped 3
 *       carry everything 2 does and are left alone.)
 */
export const PARSER_GENERATION = 2;

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
	/**
	 * The loop this player's client left the game — their `SGameUserLeaveEvent`
	 * — when the recording saw one. Absent for whoever was still in when the
	 * recording stopped (a recording that ends with its own recorder leaving
	 * does carry that leave, as the last thing in it). `playedLoops`
	 * (lib/gameEnd.ts) turns it into the time this player is credited with;
	 * it is not the game's end, and it is not clamped here, so a player who
	 * idled in a finished map keeps the loop they actually went at.
	 */
	leftLoop?: number;
	/** `m_leaveReason` of that event: 0 is the user quitting, 11 a drop. */
	leftReason?: number;
	/**
	 * SC2's own verdict for this player from `replay.details`: 1 won, 2 lost,
	 * absent when undecided. The engine only writes one once the map has
	 * called `GameOver` for the player — in UAR, the exit button on the end
	 * screen — and, it seems, only for the calls the recording client was
	 * still in the game to see: whole won games carry none when the recorder
	 * left first. Where present it doubles as "was still there when the bank
	 * was saved"; absent says nothing.
	 */
	result?: 1 | 2;
	/** This user hosted the lobby (`m_lobbyState.m_hostUserId`). */
	host?: true;
	/** Times a hero of theirs went down (dead-hero marker born); absent when none. */
	deaths?: number;
	/**
	 * Loops spent down, summed over those deaths and cut off at the moment
	 * they left or the game ended. A leaver keeps a marker to the end, which
	 * is not time they spent dead.
	 */
	deadLoops?: number;
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
 * increments the players' win counter — and no losing path spawns it. It does
 * not cover every win: the Ch4-Zulu, Specimen and Jashan-dies endings reach
 * gf_RegularGameCompleted without a cinematic, and the units they do spawn
 * ("Zulu", "Hopper") are ordinary hostile types. Those games read `null` here
 * and are settled from the save-file counters instead — and for the game's
 * length, `gameEnd.ts` falls back to the map's exit dialog.
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
/**
 * How far in the modifier vote must be over.
 *
 * It opens the moment the mode vote closes and runs its own twenty-second
 * timer, so two timers plus the slowest bank load the archive has is still
 * inside two and a half game-minutes. Gating on this rather than on the end of
 * the scan window matters: the window is generous on purpose, and demanding
 * the reader reach it threw away games whose slice simply stopped decoding
 * earlier.
 */
const MODIFIER_WINDOW_LOOPS = 16 * 150;

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
	 * How long the game itself lasted, in the same loops. Equal to
	 * `durationLoops` unless the client sat in the map after the game was
	 * over, which SC2 counts and nothing in the header separates out — see
	 * lib/gameEnd.ts. This is the length every read path should show or
	 * aggregate; `durationLoops` stays the recording's own length, which is
	 * what the upload dedupe compares.
	 */
	gameLoops: number;
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
	/**
	 * The modifiers the lobby voted on top of the mode, as gv_modifiervote
	 * ids (see lib/modifiers.ts). Empty both when the lobby wanted none and
	 * when the recording stopped before that vote — the two are told apart by
	 * `modifiersRead`.
	 */
	modifiers: number[];
	/** Whether the recording actually covered the modifier vote. */
	modifiersRead: boolean;
	/**
	 * `m_mapFileSyncChecksum` — identifies the version of the map that was
	 * played, which nothing else in a replay does (`baseBuild` is SC2's).
	 */
	mapChecksum: number;
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

	// The lobby's own facts. The host is a user id; SC2's per-player results
	// sit on the details' player list, which is in working-set-slot order, and
	// the lobby slots say which user sat in each — that is the only join there
	// is between the two.
	const lobby = initdata.m_syncLobbyState.m_lobbyState as {
		m_hostUserId: number | null;
		m_slots: { m_userId: number | null; m_workingSetSlotId?: number | null }[];
	};
	const hostUser = lobby.m_hostUserId ?? null;
	const mapChecksum = (initdata.m_syncLobbyState.m_gameDescription.m_mapFileSyncChecksum as number) ?? 0;
	const results = new Map<number, 1 | 2>();
	for (const p of details.m_playerList as { m_result: number; m_workingSetSlotId: number | null }[]) {
		if (p.m_result !== 1 && p.m_result !== 2) continue;
		const slot = p.m_workingSetSlotId;
		if (slot === null || slot === undefined) continue;
		const uid = lobby.m_slots[slot]?.m_userId;
		if (uid !== null && uid !== undefined) results.set(uid, p.m_result);
	}

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
	// and every dialog event the modifier vote could be made of. Which
	// controls those are is not known until the whole window has been read
	// (the dialog's control ids move between games), so the scanner keeps them
	// all and `tallyModifiers` picks its own out.
	const dialogEvents: ModifierEvent[] = [];
	// Every dialog-button click in the stream, for the exit-dialog scan
	// (lib/gameEnd.ts) — collected here so that scan never has to decode
	// game.events a second time.
	const clicks: DialogClick[] = [];
	// The loop each user's client left the game, from SGameUserLeaveEvent —
	// the one record of a departure a replay holds. The tracker's per-player
	// stats keep ticking for a slot whose user has quit (see lib/gameEnd.ts),
	// so this is what a player's own time in the game is measured by.
	const leaves = new Map<number, number>();
	const leaveReasons = new Map<number, number>();

	// One pass over the whole of game.events. It used to be a slice: the bank
	// preload is replayed at gameloop 0 and the mode vote closes inside the
	// first minute, so 512 KB covered everything wanted and skipped a couple of
	// seconds of bzip2 on a long game. Leave events end that economy — a player
	// can go at any loop, and only reading to the end finds them all — and it
	// buys back the second full decode the exit-dialog scan used to make.
	//
	// The head-only fields keep their old window: dialog traffic and the vote
	// are only collected inside VOTE_SCAN_LOOPS, and `endLoop` is still "the
	// first loop past the window, or where the stream stopped", so a recording
	// too short to have covered a ballot reads exactly as it did before.
	let headEnd: number | null = null;
	let lastLoop = 0;
	try {
		for (const ev of decodeReplayGameEvents(protocol, archive.readFile('replay.game.events')!)) {
			const loop = ev._gameloop as number;
			const t = ev._event as string;
			lastLoop = loop;
			if (loop > VOTE_SCAN_LOOPS) headEnd ??= loop;
			if (t.endsWith('SGameUserLeaveEvent')) {
				const uid = ev._userid.m_userId as number;
				if (!leaves.has(uid)) {
					leaves.set(uid, loop);
					leaveReasons.set(uid, ev.m_leaveReason as number);
				}
				continue;
			}
			if (t.endsWith('STriggerDialogControlEvent')) {
				const user = ev._userid.m_userId as number;
				const control = ev.m_controlId as number;
				const type = ev.m_eventType as number;
				if (type === DIALOG_CLICKED) clicks.push({ user, control, loop });
				if (loop > VOTE_SCAN_LOOPS) continue;
				if (type === DIALOG_CLICKED || type === 1) {
					dialogEvents.push({
						user,
						control,
						type,
						checked: (ev.m_eventData as { Checked?: boolean })?.Checked
					});
				}
				const mode = MODE_VOTE_BUTTONS.get(control);
				if (mode !== undefined && type === DIALOG_CLICKED) modeClicks.push({ user, mode, loop });
				continue;
			}
			if (loop > VOTE_SCAN_LOOPS || !t.includes('Bank')) continue;
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
	} catch {
		// truncated stream — keep everything it yielded
	}
	const scanned = { endLoop: headEnd ?? lastLoop };

	// class picks (each player's hero unit(s) born) and the end-of-game
	// markers, from tracker events
	const playerToUser = new Map<number, number>();
	const mosPlayed = new Map<number, string[]>();
	let endCinematic = false;
	const heroOwners = new Set<number>();
	/** unit tag -> owning player, for the dead-hero markers standing right now */
	const markers = new Map<string, number>();
	const markedPlayers = new Set<number>();
	// the loop each marker landed on, for the game's length rather than its
	// result: the cinematic prop's birth, and the loop the wipe last became
	// true and stayed true (an earlier wipe that heroes were revived out of
	// dates nothing)
	let winLoop: number | null = null;
	let wipeLoop: number | null = null;
	/** playerId -> last loop that player was still receiving stats */
	const lastStats = new Map<number, number>();
	/** marker tag -> the loop it was born, for time spent dead */
	const markerBorn = new Map<string, number>();
	/** playerId -> deaths, and loops spent down, over finished markers */
	const deaths = new Map<number, number>();
	const deadLoops = new Map<number, number>();
	for (const ev of decodeReplayTrackerEvents(protocol, archive.readFile('replay.tracker.events')!)) {
		const t = ev._event as string;
		const loop = ev._gameloop as number;
		if (t.endsWith('SPlayerSetupEvent')) {
			if (ev.m_userId !== null && ev.m_userId !== undefined) {
				playerToUser.set(ev.m_playerId as number, ev.m_userId as number);
			}
			continue;
		} else if (t.endsWith('SPlayerStatsEvent')) {
			// ticks every ten game-seconds until the client is out of the game
			lastStats.set(ev.m_playerId as number, loop);
			continue;
		} else if (t.endsWith('SUnitBornEvent')) {
			const unit = utf(ev.m_unitTypeName);
			const pid = ev.m_controlPlayerId as number;
			const uid = playerToUser.get(pid);
			if (unit === WIN_PROP) {
				endCinematic = true;
				winLoop ??= loop;
			}
			if (unit.startsWith(DEAD_HERO)) {
				const tag = `${ev.m_unitTagIndex}/${ev.m_unitTagRecycle}`;
				markers.set(tag, pid);
				markerBorn.set(tag, loop);
				markedPlayers.add(pid);
				deaths.set(pid, (deaths.get(pid) ?? 0) + 1);
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
				deadLoops.set(pid, (deadLoops.get(pid) ?? 0) + (loop - (markerBorn.get(tag) ?? loop)));
				markerBorn.delete(tag);
				// revived: this player is only still down if another of their
				// markers is standing (heroes with more than one body)
				if (![...markers.values()].includes(pid)) markedPlayers.delete(pid);
			}
		} else {
			continue;
		}
		// only births and deaths can move the wipe condition
		if (heroOwners.size > 0 && [...heroOwners].every((p) => markedPlayers.has(p))) wipeLoop ??= loop;
		else wipeLoop = null;
	}
	const outcome: ReplayOutcome | null = endCinematic ? 'win' : wipeLoop !== null ? 'loss' : null;

	// How long the game itself lasted. The recording keeps counting for as
	// long as the client sits in the map, which the header cannot separate
	// out; lib/gameEnd.ts explains what dates the real ending.
	const durationLoops = header.m_elapsedGameLoops as number;
	const humanEnds: PlayerEnd[] = [];
	for (const [pid, uid] of playerToUser) {
		const last = lastStats.get(pid);
		if (last !== undefined) humanEnds.push({ user: uid, lastLoop: last });
	}
	const markerLoop = winLoop ?? wipeLoop;
	// still gated: with a marker in hand the dialog would only refine an
	// answer already had, and the burst search is not free on a click-heavy game
	const exitLoop = needsExitScan(humanEnds, durationLoops, markerLoop)
		? exitDialogLoop(clicks, humanEnds)
		: null;
	const gameLoops = gameEndLoop({
		recordingLoops: durationLoops,
		markerLoop,
		exitLoop,
		players: humanEnds
	});

	// Standing dead-hero markers at the end — a hero nobody revived, or a
	// leaver's purple marker. Time down runs to the moment the player left or
	// the game ended, whichever came first: the marker outliving both is not
	// time anyone spent dead.
	for (const [tag, pid] of markers) {
		const uid = playerToUser.get(pid);
		const until = Math.min(gameLoops, uid !== undefined ? (leaves.get(uid) ?? gameLoops) : gameLoops);
		const since = markerBorn.get(tag) ?? until;
		if (until > since) deadLoops.set(pid, (deadLoops.get(pid) ?? 0) + (until - since));
	}
	// each user's facts from the tracker are keyed by player id; more than one
	// player id for a user does not happen in a UAR lobby, but summing is the
	// safe reading if it ever did
	const userDeaths = new Map<number, number>();
	const userDeadLoops = new Map<number, number>();
	for (const [pid, uid] of playerToUser) {
		if (deaths.has(pid)) userDeaths.set(uid, (userDeaths.get(uid) ?? 0) + deaths.get(pid)!);
		if (deadLoops.has(pid)) userDeadLoops.set(uid, (userDeadLoops.get(uid) ?? 0) + deadLoops.get(pid)!);
	}

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
			// only when the recording saw this client go; whoever was still in
			// when it stopped has no leave event
			...(leaves.has(uid) ? { leftLoop: leaves.get(uid)!, leftReason: leaveReasons.get(uid)! } : {}),
			// the rest only when there is something to say, so a sighting's
			// bytes are paid for what it records — see the type for each
			...(results.has(uid) ? { result: results.get(uid)! } : {}),
			...(hostUser === uid ? { host: true as const } : {}),
			...(userDeaths.has(uid) ? { deaths: userDeaths.get(uid)! } : {}),
			...(userDeadLoops.get(uid) ? { deadLoops: userDeadLoops.get(uid)! } : {}),
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

	// The modifier vote runs straight after the mode one, on its own
	// twenty-second timer, so a recording that reached the end of the scan
	// window covered it. A shorter one may have caught part of it, and part of
	// a ballot is worse than none.
	const modifiersRead = scanned.endLoop >= MODIFIER_WINDOW_LOOPS;
	const modifiers = modifiersRead
		? tallyModifiers(dialogEvents, activePlayers.length, mode)
		: [];

	return {
		file,
		playedAt,
		title,
		baseBuild,
		protocolExact: hasProtocol(baseBuild),
		lobbyId: initdata.m_syncLobbyState.m_gameDescription.m_randomValue as number,
		durationLoops,
		gameLoops,
		outcome,
		mode,
		modifiers,
		modifiersRead,
		mapChecksum,
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
	/**
	 * What this game gave, from the difference to the next bank — see
	 * lib/awards.ts.
	 *
	 * Left off entirely when a game gave nothing, which is most of them: a
	 * profile's history is the one array here that grows without bound, and
	 * every key on it is paid for on every read. Its absence is also what makes
	 * the feed cheap to fetch — the read asks the database for the entries that
	 * have this field rather than for the history and a filter afterwards.
	 */
	awards?: Award[];
}

export interface PlayersData {
	replays: { file: string; playedAt: string; players: number; size: number }[];
	players: Record<string, unknown>[];
}

/** Merge parsed replays into the players.json structure (newest sighting wins). */
export function buildPlayersData(parsed: { replay: ParsedReplay; size: number }[]): PlayersData {
	const byToon = new Map<string, ReplaySighting[]>();
	const replaysMeta: PlayersData['replays'] = [];
	// each game's own length, for the time its players are credited with —
	// the recording's where a doc predates the split (see lib/gameEnd.ts)
	const gameLoopsOf = new Map<string, number>();

	for (const { replay, size } of [...parsed].sort((a, b) =>
		a.replay.file < b.replay.file ? -1 : a.replay.file > b.replay.file ? 1 : 0
	)) {
		replaysMeta.push({
			file: replay.file,
			playedAt: replay.playedAt,
			players: replay.sightings.length,
			size
		});
		gameLoopsOf.set(replay.file, replay.gameLoops || replay.durationLoops);
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
		const history: HistoryEntry[] = sightings.map((s, i) => {
			// what this game gave is the difference to the bank the player
			// carried into their next one, so the newest sighting never has any
			const next = sightings[i + 1];
			const awards = isCreditable(s, next) ? awardsBetween(s, next, RANK_TRACKS) : [];
			return {
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
				wins: s.winsByMode.reduce((a, b) => a + b, 0),
				...(awards.length ? { awards } : {})
			};
		});
		// Time on record: each ingested game, for as long as this player was in
		// it. Summed here rather than derived from the history because the
		// history carries no lengths — one more key on the only unbounded array
		// a profile has would be paid for on every read of it — and this is one
		// integer. Ingested games only, so it undercounts a career: `gamesPlayed`
		// is the map's own count and runs far ahead of `history.length`.
		// The same time, by class picked — the counterpart of `classGames`
		// (db.ts, withDerived), and credited the way the per-class boards do it:
		// a game with a re-pick counts in full for each class it listed.
		let playSeconds = 0;
		const classSeconds: Record<string, number> = {};
		for (const s of sightings) {
			const seconds = Math.round(
				playedLoops(gameLoopsOf.get(s.file) ?? 0, s.leftLoop) / LOOPS_PER_SECOND
			);
			playSeconds += seconds;
			for (const id of s.mos) classSeconds[id] = (classSeconds[id] ?? 0) + seconds;
		}
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
			playSeconds,
			classSeconds,
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
