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
	sightings: ReplaySighting[];
}

/**
 * Cheap header/details-only read — enough for map-title validation and the
 * canonical (game-time) name, without decoding the multi-MB event streams.
 * Lets the upload endpoint reject duplicates before doing real work.
 */
export function peekReplay(
	data: Uint8Array
): Pick<ParsedReplay, 'playedAt' | 'title' | 'baseBuild' | 'protocolExact' | 'lobbyId'> {
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
		lobbyId: initdata.m_syncLobbyState.m_gameDescription.m_randomValue as number
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
	for (const ev of decodeReplayGameEvents(protocol, archive.readFile('replay.game.events')!)) {
		const t = ev._event as string;
		if (!t.includes('Bank')) {
			if ((ev._gameloop as number) > 0) break; // bank preload only happens at loop 0
			continue;
		}
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

	// class picks: each player's hero unit(s) born, from tracker events
	const playerToUser = new Map<number, number>();
	const mosPlayed = new Map<number, string[]>();
	for (const ev of decodeReplayTrackerEvents(protocol, archive.readFile('replay.tracker.events')!)) {
		const t = ev._event as string;
		if (t.endsWith('SPlayerSetupEvent')) {
			if (ev.m_userId !== null && ev.m_userId !== undefined) {
				playerToUser.set(ev.m_playerId as number, ev.m_userId as number);
			}
		} else if (t.endsWith('SUnitBornEvent')) {
			const unit = utf(ev.m_unitTypeName);
			const uid = playerToUser.get(ev.m_controlPlayerId as number);
			if (mosIds.has(unit) && uid !== undefined) {
				if (!mosPlayed.has(uid)) mosPlayed.set(uid, []);
				const list = mosPlayed.get(uid)!;
				if (!list.includes(unit)) list.push(unit);
			}
		}
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
			playedAt,
			file
		});
	}

	return {
		file,
		playedAt,
		title,
		baseBuild,
		protocolExact: hasProtocol(baseBuild),
		lobbyId: initdata.m_syncLobbyState.m_gameDescription.m_randomValue as number,
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
