/**
 * MongoDB (Atlas) access for player data.
 *
 * Collections (db from MONGODB_DB, default "uar"):
 * - replays: one doc per ingested replay, _id = canonical file name.
 *   Holds the full parsed sightings, so player docs can always be rebuilt
 *   from scratch with the exact same merge logic as the old static pipeline.
 * - players: one doc per toon handle (_id = toon), the merged profile.
 * - feedback: visitor-submitted feedback from the /feedback page, append-only.
 * - accounts: one doc per Battle.net login (_id = OAuth sub), linking the
 *   account's SC2 profiles (toons) to player pages. Written by /auth/bnet.
 *
 * Uses process.env (not $env) so the same module works in the SvelteKit
 * server and in plain-node CLI scripts.
 */

import { MongoClient, type Db } from 'mongodb';
import type { Sc2Profile } from './bnet.ts';
import { buildPlayersData, type ReplaySighting } from './replay/extract.ts';
import { topPlayersByMos } from './playtime.ts';
import { weeklyBoards } from './weekly.ts';
import type { MosTopPlayer, ReplayDetail, WeeklyBoards } from '../players.ts';

export interface ReplayDoc {
	_id: string; // file name, YYYYMMDD-HHMM.SC2Replay
	playedAt: string;
	title: string;
	baseBuild: number;
	size: number;
	players: number;
	/** SHA-256 of the replay file — lets clients skip uploading known files. */
	sha256?: string;
	/** Lobby-wide random value — same in every participant's replay of a game. */
	lobbyId?: number;
	/** Recording length in game loops; a longer recording of the same lobby
	 * replaces a shorter one. */
	durationLoops?: number;
	sightings: ReplaySighting[];
}

export interface FeedbackDoc {
	createdAt: string; // ISO timestamp
	message: string;
	name?: string;
	contact?: string;
	/** Triage flags — written by the maintainer's feedbacks.sveld tool, not the site. */
	done?: boolean;
	doneAt?: string; // ISO timestamp, set when flagged done
}

export interface AccountDoc {
	_id: string; // Battle.net account id (the OAuth `sub` claim)
	battletag: string;
	/** Toon handles of the account's SC2 profiles — the players._id format. */
	toons: string[];
	profiles: Sc2Profile[];
	linkedAt: string; // ISO timestamp of the first link
	updatedAt: string;
}

export interface ReadyDoc {
	_id: string; // Battle.net account id (the OAuth `sub` claim) — one flag each
	battletag: string;
	toon?: string;
	avatar?: string;
	since: string; // ISO timestamp the flag was raised
	until: string; // ISO timestamp the flag expires (one hour later)
}

export interface PresenceDoc {
	_id: string; // Battle.net account id (the OAuth `sub` claim) — one heartbeat each
	battletag: string;
	toon?: string;
	avatar?: string;
	status: 'menus' | 'lobby' | 'ingame';
	uar: boolean;
	players?: number;
	displayTime?: number;
	roster?: string[];
	lobbyId?: number;
	selfName?: string;
	at: string; // ISO timestamp of the last heartbeat — stale after ~2 min
}

let client: MongoClient | null = null;

export function dbConfigured(): boolean {
	return Boolean(process.env.MONGODB_URI);
}

export async function db(): Promise<Db> {
	if (!client) {
		const uri = process.env.MONGODB_URI;
		if (!uri) throw new Error('MONGODB_URI is not set');
		client = new MongoClient(uri);
		await client.connect();
	}
	return client.db(process.env.MONGODB_DB || 'uar');
}

// short read cache: the always-on machine serves every page view, and
// player data only changes on upload (which invalidates explicitly)
const TTL_MS = 30_000;
const cache = new Map<string, { at: number; value: unknown }>();

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
	const hit = cache.get(key);
	if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
	const value = await load();
	cache.set(key, { at: Date.now(), value });
	return value;
}

export function invalidateCache(): void {
	cache.clear();
}

export async function getPlayers(): Promise<Record<string, unknown>[]> {
	return cached('players', async () => {
		const d = await db();
		return d.collection('players').find({}, { projection: { _id: 0 } }).toArray() as Promise<
			Record<string, unknown>[]
		>;
	});
}

/**
 * Player rows without the per-game history and the unlock arrays — those
 * are only needed on a profile page, and carrying them for every player
 * made the leaderboard payload grow with the archive.
 */
export async function getPlayersLite(): Promise<Record<string, unknown>[]> {
	return cached('playersLite', async () => {
		const d = await db();
		return d
			.collection('players')
			.find({}, { projection: { _id: 0, history: 0, unlocks: 0 } })
			.toArray() as Promise<Record<string, unknown>[]>;
	});
}

export async function getPlayer(toon: string): Promise<Record<string, unknown> | null> {
	const d = await db();
	return d.collection('players').findOne({ _id: toon } as never, { projection: { _id: 0 } });
}

export async function getReplaysList(): Promise<
	{ file: string; playedAt: string; players: number; size: number; durationLoops: number }[]
> {
	return cached('replays', async () => {
		const d = await db();
		const docs = await d
			.collection<ReplayDoc>('replays')
			.find({}, { projection: { sightings: 0 } })
			.sort({ playedAt: 1 })
			.toArray();
		return docs.map((r) => ({
			file: r._id,
			playedAt: r.playedAt,
			players: r.players,
			size: r.size,
			durationLoops: r.durationLoops ?? 0
		}));
	});
}

export async function getReplay(file: string): Promise<ReplayDetail | null> {
	const d = await db();
	const doc = await d.collection<ReplayDoc>('replays').findOne({ _id: file });
	if (!doc) return null;
	return {
		file: doc._id,
		playedAt: doc.playedAt,
		title: doc.title,
		baseBuild: doc.baseBuild,
		size: doc.size,
		durationLoops: doc.durationLoops ?? 0,
		// project sightings down to what the page shows — unlocks etc. stay server-side
		players: doc.sightings.map((s) => ({
			name: s.name,
			clan: s.clan,
			toon: s.toon,
			mos: s.mos,
			xpEn: s.xpEn,
			xpWo: s.xpWo,
			xpCo: s.xpCo,
			prestige: s.prestige,
			gamesPlayed: s.gamesPlayed,
			revives: s.revives
		}))
	};
}

export async function getMosTopPlayers(mosId: string): Promise<MosTopPlayer[]> {
	const byMos = await cached('mosPlaytime', async () => {
		const d = await db();
		const docs = await d
			.collection<ReplayDoc>('replays')
			.find(
				{},
				{
					projection: {
						playedAt: 1,
						durationLoops: 1,
						'sightings.toon': 1,
						'sightings.name': 1,
						'sightings.clan': 1,
						'sightings.mos': 1
					}
				}
			)
			.toArray();
		return topPlayersByMos(docs);
	});
	return byMos[mosId] ?? [];
}

export async function getWeeklyBoards(): Promise<WeeklyBoards> {
	return cached('weeklyBoards', async () => {
		const d = await db();
		const docs = await d
			.collection<ReplayDoc>('replays')
			.find(
				{},
				{
					projection: {
						playedAt: 1,
						'sightings.toon': 1,
						'sightings.name': 1,
						'sightings.clan': 1,
						'sightings.xpEn': 1,
						'sightings.xpWo': 1,
						'sightings.xpCo': 1,
						'sightings.prestige': 1,
						'sightings.gamesPlayed': 1,
						'sightings.mos': 1
					}
				}
			)
			.toArray();
		return weeklyBoards(docs, new Date());
	});
}

export async function replayExists(file: string): Promise<boolean> {
	const d = await db();
	return (await d.collection<ReplayDoc>('replays').findOne({ _id: file }, { projection: { _id: 1 } })) !== null;
}

export async function replayExistsBySha(sha256: string): Promise<boolean> {
	const d = await db();
	return (await d.collection<ReplayDoc>('replays').findOne({ sha256 }, { projection: { _id: 1 } })) !== null;
}

export async function getReplayByLobby(
	lobbyId: number
): Promise<{ _id: string; durationLoops: number } | null> {
	const d = await db();
	const doc = await d
		.collection<ReplayDoc>('replays')
		.findOne({ lobbyId }, { projection: { _id: 1, durationLoops: 1 } });
	return doc ? { _id: doc._id, durationLoops: doc.durationLoops ?? 0 } : null;
}

export async function replaceReplayDoc(doc: ReplayDoc): Promise<void> {
	const d = await db();
	await d.collection<ReplayDoc>('replays').replaceOne({ _id: doc._id }, doc, { upsert: true });
}

export async function insertReplayDoc(doc: ReplayDoc): Promise<void> {
	const d = await db();
	await d.collection<ReplayDoc>('replays').insertOne(doc);
}

export async function insertFeedback(doc: FeedbackDoc): Promise<void> {
	const d = await db();
	await d.collection<FeedbackDoc>('feedback').insertOne(doc);
}

/** Currently active "ready to play" flags, oldest first. */
export async function getReadyPlayers(now: Date = new Date()): Promise<ReadyDoc[]> {
	return cached('ready', async () => {
		const d = await db();
		return d
			.collection<ReadyDoc>('ready')
			.find({ until: { $gt: now.toISOString() } })
			.sort({ since: 1 })
			.toArray();
	});
}

export async function setReady(doc: ReadyDoc): Promise<void> {
	const d = await db();
	const col = d.collection<ReadyDoc>('ready');
	await col.replaceOne({ _id: doc._id }, doc, { upsert: true });
	// opportunistic cleanup — expired flags are never read again
	await col.deleteMany({ until: { $lt: new Date().toISOString() } });
	invalidateCache();
}

export async function clearReady(sub: string): Promise<void> {
	const d = await db();
	await d.collection<ReadyDoc>('ready').deleteOne({ _id: sub });
	invalidateCache();
}

/** Fresh lobby/ingame heartbeats (stale ones are ignored, cleaned lazily). */
export async function getActivePresence(staleMs: number, now = Date.now()): Promise<PresenceDoc[]> {
	return cached('presence', async () => {
		const d = await db();
		const cutoff = new Date(now - staleMs).toISOString();
		return d
			.collection<PresenceDoc>('presence')
			.find({ at: { $gt: cutoff }, status: { $in: ['lobby', 'ingame'] } })
			.sort({ at: 1 })
			.toArray();
	});
}

export async function getPresence(sub: string): Promise<PresenceDoc | null> {
	const d = await db();
	return d.collection<PresenceDoc>('presence').findOne({ _id: sub });
}

export async function upsertPresence(doc: PresenceDoc): Promise<void> {
	const d = await db();
	const col = d.collection<PresenceDoc>('presence');
	await col.replaceOne({ _id: doc._id }, doc, { upsert: true });
	// opportunistic cleanup — anything hours-stale is never read again
	await col.deleteMany({ at: { $lt: new Date(Date.now() - 6 * 3_600_000).toISOString() } });
	invalidateCache();
}

export async function deletePresence(sub: string): Promise<void> {
	const d = await db();
	await d.collection<PresenceDoc>('presence').deleteOne({ _id: sub });
	invalidateCache();
}

/**
 * Record a Battle.net login. `profiles` is null when the SC2 profile fetch
 * failed (flaky API) — the login still succeeds and any previously stored
 * toons are kept rather than clobbered with an empty list.
 */
export async function upsertAccount(
	sub: string,
	battletag: string,
	profiles: Sc2Profile[] | null,
	now: Date = new Date()
): Promise<void> {
	const d = await db();
	const iso = now.toISOString();
	const set: Partial<AccountDoc> = { battletag, updatedAt: iso };
	if (profiles !== null) {
		set.profiles = profiles;
		set.toons = profiles.map((p) => p.toon);
	}
	await d
		.collection<AccountDoc>('accounts')
		.updateOne({ _id: sub }, { $set: set, $setOnInsert: { linkedAt: iso } }, { upsert: true });
	invalidateCache();
}

/** The account's primary profile: first seen in UAR replays, else the first. */
export async function pickPrimaryProfile(profiles: Sc2Profile[]): Promise<Sc2Profile | undefined> {
	for (const p of profiles) {
		if (await getPlayer(p.toon)) return p;
	}
	return profiles[0];
}

/** toon -> SC2 portrait URL, across every linked account (small collection). */
/**
 * In-game names → the player we know under that name (most recently seen
 * wins, since SC2 profile names are not unique). Lets live rosters link to
 * profiles for players who never installed the companion app.
 */
export async function getPlayerDirectory(): Promise<
	Record<string, { toon: string; avatar?: string }>
> {
	return cached('playerDirectory', async () => {
		const d = await db();
		const docs = (await d
			.collection('players')
			.find({}, { projection: { name: 1, toon: 1, lastSeen: 1, _id: 1 } })
			.toArray()) as unknown as { _id: string; name?: string; lastSeen?: string }[];
		const avatars = await getAvatarsByToon();
		const seen: Record<string, string> = {};
		const map: Record<string, { toon: string; avatar?: string }> = {};
		for (const p of docs) {
			if (!p.name) continue;
			if (seen[p.name] && (p.lastSeen ?? '') <= seen[p.name]) continue;
			seen[p.name] = p.lastSeen ?? '';
			map[p.name] = { toon: p._id, ...(avatars[p._id] ? { avatar: avatars[p._id] } : {}) };
		}
		return map;
	});
}

export async function getAvatarsByToon(): Promise<Record<string, string>> {
	return cached('avatars', async () => {
		const d = await db();
		const docs = await d
			.collection<AccountDoc>('accounts')
			.find({}, { projection: { profiles: 1 } })
			.toArray();
		const map: Record<string, string> = {};
		for (const a of docs) {
			for (const p of a.profiles ?? []) if (p.avatarUrl) map[p.toon] = p.avatarUrl;
		}
		return map;
	});
}

export async function getAccount(sub: string): Promise<AccountDoc | null> {
	const d = await db();
	return d.collection<AccountDoc>('accounts').findOne({ _id: sub });
}

/** The account that owns this toon, if anyone has linked it. */
export async function getAccountByToon(toon: string): Promise<AccountDoc | null> {
	const d = await db();
	return d.collection<AccountDoc>('accounts').findOne({ toons: toon });
}

export async function deleteAccount(sub: string): Promise<void> {
	const d = await db();
	await d.collection<AccountDoc>('accounts').deleteOne({ _id: sub });
	invalidateCache();
}

/**
 * Rebuild the players collection from every stored replay's sightings —
 * one code path shared with the historical static pipeline, so results are
 * always consistent and idempotent.
 */
/**
 * Rebuilding reads every stored replay, so a backfill of hundreds of
 * uploads must not trigger hundreds of rebuilds. Runs inline when the last
 * one is old enough (the normal case: one game, profiles live instantly),
 * otherwise coalesces the burst into a single trailing rebuild.
 */
const REBUILD_GAP_MS = 15_000;
let lastRebuildAt = 0;
let rebuildTimer: ReturnType<typeof setTimeout> | null = null;

export async function rebuildPlayersSoon(): Promise<number | null> {
	if (rebuildTimer) return null; // a trailing rebuild already covers this
	const since = Date.now() - lastRebuildAt;
	if (since >= REBUILD_GAP_MS) {
		const count = await rebuildPlayers();
		lastRebuildAt = Date.now();
		return count;
	}
	rebuildTimer = setTimeout(() => {
		rebuildTimer = null;
		void rebuildPlayers()
			.then(() => {
				lastRebuildAt = Date.now();
			})
			.catch((e) => console.error('deferred player rebuild failed:', e));
	}, REBUILD_GAP_MS - since);
	return null;
}

export async function rebuildPlayers(): Promise<number> {
	const d = await db();
	const replayDocs = await d.collection<ReplayDoc>('replays').find().toArray();
	const { players } = buildPlayersData(
		replayDocs.map((r) => ({
			replay: {
				file: r._id,
				playedAt: r.playedAt,
				title: r.title,
				baseBuild: r.baseBuild,
				protocolExact: true,
				lobbyId: r.lobbyId ?? 0,
				durationLoops: r.durationLoops ?? 0,
				sightings: r.sightings
			},
			size: r.size
		}))
	);

	const col = d.collection('players');
	if (players.length) {
		await col.bulkWrite(
			players.map((p) => ({
				replaceOne: { filter: { _id: p.toon as string }, replacement: p, upsert: true }
			})) as never[]
		);
	}
	await col.deleteMany({ _id: { $nin: players.map((p) => p.toon as string) } } as never);
	invalidateCache();
	return players.length;
}
