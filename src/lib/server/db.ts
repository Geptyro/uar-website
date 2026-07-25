/**
 * MongoDB (Atlas) access for player data.
 *
 * Collections (db from MONGODB_DB, default "uar"):
 * - replays: one doc per ingested replay, _id = canonical file name.
 *   Holds the full parsed sightings, so player docs can always be rebuilt
 *   from scratch with the exact same merge logic as the old static pipeline.
 * - players: one doc per toon handle (_id = toon), the merged profile.
 *
 * Uses process.env (not $env) so the same module works in the SvelteKit
 * server and in plain-node CLI scripts.
 */

import { MongoClient, type Db } from 'mongodb';
import { buildPlayersData, type ReplaySighting } from './replay/extract.ts';
import { topPlayersByMos } from './playtime.ts';
import type { MosTopPlayer } from '../players.ts';

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

export async function getPlayer(toon: string): Promise<Record<string, unknown> | null> {
	const d = await db();
	return d.collection('players').findOne({ _id: toon } as never, { projection: { _id: 0 } });
}

export async function getReplaysList(): Promise<
	{ file: string; playedAt: string; players: number; size: number }[]
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
			size: r.size
		}));
	});
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

/**
 * Rebuild the players collection from every stored replay's sightings —
 * one code path shared with the historical static pipeline, so results are
 * always consistent and idempotent.
 */
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
