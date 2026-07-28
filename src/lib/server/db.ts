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
import { outcomeChanges, type Outcome } from '../outcome.ts';
import { PER_PAGE, pageNumber, type Paged } from '../paging.ts';
import { escapeRegex } from '../search.ts';
import { careerXp, totalWins } from '../xp.ts';
import { bucketConfigured, deleteObject } from './replay/s3.ts';
import { prunableReplays } from '../replayRetention.ts';
import { withLock } from '../mutex.ts';
import { topPlayersByMos } from './playtime.ts';
import { topTeammates } from './teammates.ts';
import { WINDOW_MS, weeklyBoards } from './weekly.ts';
import type {
	MosTopPlayer,
	ReplayDetail,
	ReplayMeta,
	Teammate,
	WeeklyBoards
} from '../players.ts';

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
	/**
	 * What the parser read out of the replay file itself. Absent on games
	 * ingested before outcomes were read, and on recordings that stopped
	 * mid-game — `replayOutcomes` settles those from the save-file counters
	 * instead, so this is a hint, not the answer.
	 */
	outcome?: Outcome;
	/**
	 * The settled result, written by `rebuildPlayers` from the save-file
	 * counters across every stored game (see lib/outcome.ts). Derived, never
	 * authored: it exists so a page can render an outcome without the whole
	 * archive being read to re-derive it on every view. Absent until the game
	 * is settleable — nobody has played a follow-up yet.
	 */
	settledOutcome?: Outcome;
	/**
	 * When the bucket blob was dropped by the retention sweep, ISO. Absent
	 * means the bytes are still downloadable. The doc itself is never
	 * deleted, so lobbyId/sha256/size/sightings survive as the game's record
	 * (and keep the upload dedupe answering "known" — see replayExistsBySha).
	 */
	blobPrunedAt?: string;
	sightings: ReplaySighting[];
}

export interface FeedbackDoc {
	createdAt: string; // ISO timestamp
	message: string;
	name?: string;
	contact?: string;
	/** Triage flags — written by the maintainer's admin.sveld tool, not the site. */
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

/**
 * Indexes the queries here rely on, created once at boot.
 *
 * `createIndex` is idempotent, so this is a no-op on every boot after the
 * first. Kept deliberately short: every index costs storage against the
 * cluster's limit, and none of these is currently a latency win — the
 * collections are small enough that a scan is single-digit milliseconds
 * server-side, and what a page waits on is bytes coming back, not the scan.
 * They are here so that stays true as the archive grows.
 */
export async function ensureIndexes(): Promise<void> {
	if (!dbConfigured()) return;
	const d = await db();
	await Promise.all([
		// every read of one player's own games: the profile's teammates panel,
		// and the per-player rebuild an upload runs (multikey over sightings)
		d.collection('replays').createIndex({ 'sightings.toon': 1 }, { name: 'sightings_toon' }),
		// upload dedupe — "do you already have this exact file?"
		d.collection('replays').createIndex({ sha256: 1 }, { name: 'sha256', sparse: true }),
		// replace-if-longer resolves an upload against the game it belongs to
		d.collection('replays').createIndex({ lobbyId: 1 }, { name: 'lobbyId', sparse: true }),
		// the leaderboard's default order, and the tiebreak under every other one
		d.collection('players').createIndex({ careerXp: -1, _id: 1 }, { name: 'careerXp' }),
		// clan pages select a roster by tag
		d.collection('players').createIndex({ clan: 1 }, { name: 'clan' })
	]);
}

/**
 * Drop the shared pool. The server never calls this — it holds one client for
 * its whole life — but a CLI that touched this module otherwise never exits,
 * because the pool keeps the event loop alive and its connections keep sitting
 * against the cluster's connection budget.
 */
export async function closeDb(): Promise<void> {
	if (!client) return;
	const c = client;
	client = null;
	await c.close();
}

// short read cache: the always-on machine serves every page view, and
// player data only changes on upload (which invalidates explicitly)
const TTL_MS = 30_000;
/**
 * How long a stale entry may still be served while its refresh runs. Past the
 * TTL the value is refetched, but nobody is made to *wait* for that refetch —
 * otherwise whichever page view happens to land on the expiry pays the whole
 * read, which is exactly how a slow query turns into a random multi-second
 * stall for one unlucky visitor.
 */
const STALE_MS = 5 * 60_000;
/**
 * Cap on cached entries, evicting least-recently-used.
 *
 * Without it, anything keyed on a URL segment — a toon, a clan tag, a class id
 * — could grow the map without bound, so those reads were simply left
 * uncached. That made every profile view pay its full database cost however
 * many times it was loaded: eight refreshes of one page, eight identical
 * ~800ms reads. Bounding the map is what makes those keys safe to cache.
 */
const MAX_ENTRIES = 300;
const cache = new Map<string, { at: number; value: unknown }>();

/** Map iterates in insertion order, so re-inserting on read makes it an LRU. */
function touch(key: string, entry: { at: number; value: unknown }): void {
	cache.delete(key);
	cache.set(key, entry);
	while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
}

/** Reads currently in flight, so N concurrent misses share one query. */
const inFlight = new Map<string, { gen: number; promise: Promise<unknown> }>();
/** Bumped by every invalidation, so a read cannot cache pre-write data. */
let generation = 0;

function refresh<T>(key: string, load: () => Promise<T>): Promise<T> {
	const running = inFlight.get(key);
	if (running && running.gen === generation) return running.promise as Promise<T>;
	const gen = generation;
	const entry = {
		gen,
		promise: load()
			.then((value) => {
				// a write landed while this read was in flight, so what it read is
				// already out of date: hand it back, but do not cache it
				if (gen === generation) touch(key, { at: Date.now(), value });
				return value;
			})
			.finally(() => {
				if (inFlight.get(key) === entry) inFlight.delete(key);
			})
	};
	inFlight.set(key, entry);
	return entry.promise as Promise<T>;
}

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
	const hit = cache.get(key);
	if (hit) {
		const age = Date.now() - hit.at;
		if (age < TTL_MS) {
			touch(key, hit); // keep hot entries out of the LRU's way
			return hit.value as T;
		}
		if (age < STALE_MS) {
			// serve what we have and let the refresh finish in the background;
			// a failed refresh just leaves the stale value for the next attempt
			void refresh(key, load).catch(() => {});
			return hit.value as T;
		}
	}
	return refresh(key, load);
}

export function invalidateCache(): void {
	generation++;
	cache.clear();
}

/** Exactly the fields `buildClans` reads — see `ClanMember` in $lib/clans.ts. */
const CLAN_PROJECTION = {
	_id: 0,
	name: 1,
	clan: 1,
	toon: 1,
	xpEn: 1,
	xpWo: 1,
	xpCo: 1,
	prestige: 1,
	gamesPlayed: 1,
	revives: 1,
	avgGameTime: 1,
	winsByMode: 1,
	lastSeen: 1
};

/**
 * Members of one clan, or every player who is in a clan when `tag` is omitted.
 *
 * The clan boards used to read every profile whole — history, unlocks and all,
 * ~2 MB — to compute sums over eleven small fields. One clan's roster is a
 * handful of documents.
 *
 */
export async function getClanMembers(tag?: string): Promise<Record<string, unknown>[]> {
	return cached(tag ? `clan:${tag}` : 'clans:members', async () => {
		const d = await db();
		return d
			.collection('players')
			.find(tag ? { clan: tag } : { clan: { $nin: ['', null] } }, { projection: CLAN_PROJECTION })
			.toArray() as Promise<Record<string, unknown>[]>;
	});
}

/** Total profiles on record — a counter, not a reason to read the collection. */
export async function countPlayers(): Promise<number> {
	return cached('players:count', async () => (await db()).collection('players').countDocuments({}));
}

/**
 * Player rows without the per-game history and the unlock arrays — those
 * are only needed on a profile page, and carrying them for every player
 * made the leaderboard payload grow with the archive.
 */
const PLAYER_LIST_PROJECTION = { _id: 0, history: 0, unlocks: 0 };

/**
 * Leaderboard column -> the field Mongo sorts on. Two of them are stored only
 * so this mapping can exist: `careerXp` and `totalWins` are derived, and
 * sorting the whole table in JS meant reading the whole table (see
 * `withSortKeys`).
 */
const PLAYER_SORT_FIELDS: Record<string, string> = {
	name: 'name',
	career: 'careerXp',
	xpEn: 'xpEn',
	xpWo: 'xpWo',
	xpCo: 'xpCo',
	prestige: 'prestige',
	games: 'gamesPlayed',
	wins: 'totalWins',
	revives: 'revives',
	avg: 'avgGameTime'
};

/** Matches the old in-JS filter: name/clan case-insensitive, toon exact-case. */
function playerSearchFilter(q: string): Record<string, unknown> {
	if (!q) return {};
	const rx = escapeRegex(q);
	return {
		$or: [
			{ name: { $regex: rx, $options: 'i' } },
			{ clan: { $regex: rx, $options: 'i' } },
			{ toon: { $regex: rx } }
		]
	};
}

/**
 * One page of the leaderboard, sorted, searched and paged by the database.
 *
 * Every variant is cached, search included: the LRU bound is what keeps a
 * visitor-supplied `q` from growing the map without end.
 */
export async function getPlayersPage(opts: {
	sort: string;
	dir: 1 | -1;
	q: string;
	page: string | null;
}): Promise<Paged<Record<string, unknown>>> {
	const field = PLAYER_SORT_FIELDS[opts.sort] ?? 'careerXp';
	const filter = playerSearchFilter(opts.q);
	const d = await db();
	const col = d.collection('players');
	const total = opts.q ? await col.countDocuments(filter) : await countPlayers();
	const pages = Math.max(1, Math.ceil(total / PER_PAGE));
	// clamp before keying the cache — `?page=` is visitor input
	const page = pageNumber(opts.page, pages);
	// `_id` last makes the order total. Without it, players tied on the sort
	// column (plenty share 0 games / 0 career XP) come back in an arbitrary
	// order that can differ between queries — and once paging happens in the
	// database rather than over one sorted array, that means a row can show up
	// on two pages or on none. The careerXp tiebreak is skipped when it is
	// already the sort column, or the duplicate key would drop the direction.
	const sortSpec: Record<string, 1 | -1> =
		field === 'careerXp'
			? { careerXp: opts.dir, _id: 1 }
			: { [field]: opts.dir, careerXp: -1, _id: 1 };
	const read = async () =>
		(await col
			.find(filter, { projection: PLAYER_LIST_PROJECTION })
			// the name column sorted case-insensitively in JS; collation is how
			// the database does the same
			.collation({ locale: 'en', strength: 2 })
			.sort(sortSpec)
			.skip((page - 1) * PER_PAGE)
			.limit(PER_PAGE)
			.toArray()) as Record<string, unknown>[];
	const rows = await cached(`players:${field}:${opts.dir}:${page}:${opts.q}`, read);
	return { rows, page, pages, total, perPage: PER_PAGE };
}

export async function getPlayer(toon: string): Promise<Record<string, unknown> | null> {
	return cached(`player:${toon}`, async () => {
		const d = await db();
		return d.collection('players').findOne({ _id: toon } as never, { projection: { _id: 0 } });
	});
}

/**
 * A profile without its replay history — everything the page renders above the
 * history table. `history` is the only field on a player that grows without
 * bound (377 entries / 78 KB for the most active), and the page shows fifty
 * rows of it at a time, so it is fetched separately by
 * `getPlayerHistoryPage`.
 */
export async function getPlayerSummary(toon: string): Promise<Record<string, unknown> | null> {
	return cached(`playerSummary:${toon}`, async () => {
		const d = await db();
		return d
			.collection('players')
			.findOne({ _id: toon } as never, { projection: { _id: 0, history: 0 } });
	});
}

/**
 * One page of a player's replay history, newest first.
 *
 * History is stored oldest first — that ordering is what makes the per-row
 * deltas work, since the progress a game earned only shows up in the *next*
 * sighting. So a page is sliced from the end, and carries one extra entry
 * beyond its newest row (`lead`) precisely so that top row still has a next
 * sighting to diff against. `$slice` does the slicing in the database, so the
 * read shrinks rather than just the render.
 */
export async function getPlayerHistoryPage(
	toon: string,
	rawPage: string | null,
	total: number
): Promise<{ rows: Record<string, unknown>[]; lead: number; page: number; pages: number }> {
	const pages = Math.max(1, Math.ceil(total / PER_PAGE));
	const page = pageNumber(rawPage, pages);
	// negative skip counts back from the newest entry; Mongo clamps it at the
	// start of the array, which is exactly right for the oldest, partial page
	const skip = -(page * PER_PAGE);
	const lead = page > 1 ? 1 : 0;
	const rows = await cached(`playerHistory:${toon}:${page}`, async () => {
		const d = await db();
		const doc = await d
			.collection('players')
			.findOne({ _id: toon } as never, {
				projection: { _id: 0, history: { $slice: [skip, PER_PAGE + lead] } }
			});
		return ((doc as { history?: Record<string, unknown>[] } | null)?.history ??
			[]) as Record<string, unknown>[];
	});
	return { rows, lead, page, pages };
}

/**
 * The fields a replay list row renders. Deliberately no sightings: they are
 * ~95% of a replay doc's bytes, and since `rebuildPlayers` settles outcomes
 * onto the doc, no read path needs them to work out who won.
 */
const LIST_PROJECTION = {
	playedAt: 1,
	players: 1,
	size: 1,
	durationLoops: 1,
	blobPrunedAt: 1,
	outcome: 1,
	settledOutcome: 1
};

/**
 * The settled result if the counters have decided one, else whatever the
 * parser read out of the file. Same precedence as `replayOutcomes`, which
 * prefers its cross-replay verdict and falls back to the parser's hint.
 */
function replayOutcomeOf(r: Pick<ReplayDoc, 'settledOutcome' | 'outcome'>): Outcome | undefined {
	return r.settledOutcome ?? r.outcome;
}

function toRow(r: ReplayDoc): ReplayMeta {
	const outcome = replayOutcomeOf(r);
	return {
		file: r._id,
		playedAt: r.playedAt,
		players: r.players,
		size: r.size,
		durationLoops: r.durationLoops ?? 0,
		blobPruned: Boolean(r.blobPrunedAt),
		...(outcome ? { outcome } : {})
	};
}

/**
 * One page of replays, newest first, read as one page from the database
 * rather than by slicing the whole archive. `countDocuments` costs a single
 * server-side count and keeps the numbered pager honest.
 */
export async function getReplaysPage(
	rawPage: string | null,
	perPage = PER_PAGE
): Promise<Paged<ReplayMeta>> {
	const total = await cached('replays:count', async () => {
		const d = await db();
		return d.collection<ReplayDoc>('replays').countDocuments({});
	});
	const pages = Math.max(1, Math.ceil(total / perPage));
	// clamp before keying the cache: `?page=` is visitor input, and keying on
	// the raw value would let junk query strings grow the map without bound
	const page = pageNumber(rawPage, pages);
	const rows = await cached(`replays:page:${page}:${perPage}`, async () => {
		const d = await db();
		const docs = await d
			.collection<ReplayDoc>('replays')
			.find({}, { projection: LIST_PROJECTION })
			// `_id` breaks ties on the minute-resolution timestamp, so paging
			// cannot show the same game twice or skip one (see getPlayersPage)
			.sort({ playedAt: -1, _id: -1 })
			.skip((page - 1) * perPage)
			.limit(perPage)
			.toArray();
		return docs.map(toRow);
	});
	return { rows, page, pages, total, perPage };
}

/** The newest `n` games, for the homepage's Last games widget. */
export async function getRecentReplays(n: number): Promise<ReplayMeta[]> {
	return cached(`replays:recent:${n}`, async () => {
		const d = await db();
		const docs = await d
			.collection<ReplayDoc>('replays')
			.find({}, { projection: LIST_PROJECTION })
			.sort({ playedAt: -1 })
			.limit(n)
			.toArray();
		return docs.map(toRow);
	});
}

/**
 * Games overlapping the activity chart's trailing window. Reaches a day
 * further back than the window itself because a game that started before it
 * still credits the slots it runs into — `activityTimeline` clips such games
 * to the window rather than dropping them, and caps any one game at a day.
 */
export async function getActivityReplays(
	days: number
): Promise<{ playedAt: string; players: number; durationLoops?: number }[]> {
	return cached(`replays:activity:${days}`, async () => {
		const d = await db();
		const since = new Date(Date.now() - (days + 1) * 24 * 3600 * 1000)
			.toISOString()
			.slice(0, 19) + 'Z'; // same fixed-width shape the ingest writes
		return d
			.collection<ReplayDoc>('replays')
			.find(
				{ playedAt: { $gte: since } },
				{ projection: { playedAt: 1, players: 1, durationLoops: 1 } }
			)
			.sort({ playedAt: 1 })
			.toArray() as Promise<{ playedAt: string; players: number; durationLoops?: number }[]>;
	});
}

/** Archive-wide counters for the leaderboard header — two server-side reads. */
export async function getReplayStats(): Promise<{ count: number; latest: string }> {
	return cached('replays:stats', async () => {
		const d = await db();
		const col = d.collection<ReplayDoc>('replays');
		const [count, newest] = await Promise.all([
			col.countDocuments({ players: { $gt: 0 } }),
			col.find({}, { projection: { playedAt: 1 } }).sort({ playedAt: -1 }).limit(1).toArray()
		]);
		return { count, latest: newest[0]?.playedAt?.slice(0, 10) ?? '' };
	});
}

/**
 * file -> outcome and recording length, for pages that show individual games:
 * a profile's replay history, one replay's page. Takes the files the caller
 * already knows it will render, so the read scales with the page and not with
 * the archive.
 */
export async function getReplayFacts(
	cacheKey: string,
	files: string[]
): Promise<Record<string, { durationLoops: number; outcome?: Outcome }>> {
	if (!files.length) return {};
	// keyed by which page of whose history it is, so a revisit does not re-read
	return cached(`replayFacts:${cacheKey}`, async () => {
		const map: Record<string, { durationLoops: number; outcome?: Outcome }> = {};
		const d = await db();
		const docs = await d
			.collection<ReplayDoc>('replays')
			.find(
				{ _id: { $in: files } },
				{ projection: { durationLoops: 1, outcome: 1, settledOutcome: 1 } }
			)
			.toArray();
		for (const r of docs) {
			const outcome = replayOutcomeOf(r);
			map[r._id] = { durationLoops: r.durationLoops ?? 0, ...(outcome ? { outcome } : {}) };
		}
		return map;
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
		// the settled result rides on the doc itself now, so one game's page
		// no longer re-derives it from the whole archive
		outcome: replayOutcomeOf(doc) ?? null,
		blobPruned: Boolean(doc.blobPrunedAt),
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

/** Stored per-class board, written by `persistMosBoards`. */
const mosBoardId = (mosId: string) => `mosPlaytime:${mosId}`;

/**
 * One class's playtime board. All-time, so unlike the weekly widgets it cannot
 * be narrowed by a date window — instead it is aggregated once when the
 * archive changes and stored, so this is a point read of about a kilobyte
 * rather than a scan of every replay's sightings.
 *
 */
export async function getMosTopPlayers(mosId: string): Promise<MosTopPlayer[]> {
	return cached(`mosBoard:${mosId}`, async () => {
		const d = await db();
		const doc = await d.collection('meta').findOne({ _id: mosBoardId(mosId) } as never);
		return ((doc as { rows?: MosTopPlayer[] } | null)?.rows ?? []) as MosTopPlayer[];
	});
}

/**
 * Who this player has shared the most recorded game time with. Filtered to
 * the player's own replays server-side, so this stays a small read even as
 * the archive grows (unlike the boards above, which scan everything).
 */
/**
 * Who this player has shared the most recorded game time with.
 *
 * Aggregated when the archive changes (see `persistTeammates`) and stored on
 * the profile, so this rides along with the summary the page already reads
 * rather than being the 300 KB scan it used to be.
 */
export async function getTeammates(toon: string): Promise<Teammate[]> {
	const p = await getPlayerSummary(toon);
	return (p?.teammates ?? []) as Teammate[];
}

export async function getWeeklyBoards(): Promise<WeeklyBoards> {
	return cached('weeklyBoards', async () => {
		const d = await db();
		const now = new Date();
		// the boards only ever look at the last 7 days, and `weeklyBoards`
		// drops anything older outright — so don't pay to read the archive
		const since = new Date(now.getTime() - WINDOW_MS).toISOString().slice(0, 19) + 'Z';
		const docs = await d
			.collection<ReplayDoc>('replays')
			.find(
				{ playedAt: { $gte: since } },
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
		return weeklyBoards(docs, now);
	});
}

export async function replayExists(file: string): Promise<boolean> {
	const d = await db();
	return (await d.collection<ReplayDoc>('replays').findOne({ _id: file }, { projection: { _id: 1 } })) !== null;
}

/**
 * Upload-skip check for the companion (GET /api/replays?sha256=).
 *
 * Load-bearing for retention: this must keep answering true for replays whose
 * blob was pruned, or every companion would re-upload every pruned file on the
 * next backfill and undo the sweep in a loop. The sha lives on the doc, and
 * the doc is never deleted, so pruned games stay "known" — do not narrow this
 * to "has a blob".
 */
export async function replayExistsBySha(sha256: string): Promise<boolean> {
	const d = await db();
	return (await d.collection<ReplayDoc>('replays').findOne({ sha256 }, { projection: { _id: 1 } })) !== null;
}

/** As above, plus what the upload endpoint needs to explain the rejection. */
export async function findReplayBySha(
	sha256: string
): Promise<{ file: string; playedAt: string; blobPruned: boolean } | null> {
	const d = await db();
	const doc = await d
		.collection<ReplayDoc>('replays')
		.findOne({ sha256 }, { projection: { _id: 1, playedAt: 1, blobPrunedAt: 1 } });
	return doc
		? { file: doc._id, playedAt: doc.playedAt, blobPruned: Boolean(doc.blobPrunedAt) }
		: null;
}

export async function getReplayByLobby(
	lobbyId: number
): Promise<{ _id: string; durationLoops: number; blobPruned: boolean } | null> {
	const d = await db();
	const doc = await d
		.collection<ReplayDoc>('replays')
		.findOne({ lobbyId }, { projection: { _id: 1, durationLoops: 1, blobPrunedAt: 1 } });
	return doc
		? {
				_id: doc._id,
				durationLoops: doc.durationLoops ?? 0,
				blobPruned: Boolean(doc.blobPrunedAt)
			}
		: null;
}

/**
 * Both replay writers drop the read cache themselves rather than leaving it to
 * the rebuild that follows. A burst of uploads defers its rebuild by up to
 * `REBUILD_GAP_MS` (see `rebuildPlayersSoon`), and until that fires the game is
 * in the database but every cached read still predates it — so the replay list
 * would keep serving a list the new game is missing from.
 */
export async function replaceReplayDoc(doc: ReplayDoc): Promise<void> {
	const d = await db();
	await d.collection<ReplayDoc>('replays').replaceOne({ _id: doc._id }, doc, { upsert: true });
	invalidateCache();
}

export async function insertReplayDoc(doc: ReplayDoc): Promise<void> {
	const d = await db();
	await d.collection<ReplayDoc>('replays').insertOne(doc);
	invalidateCache();
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
 * A rebuild still costs one pass over the archive to settle outcomes and the
 * class boards, so a backfill of hundreds of uploads must not trigger hundreds
 * of them. Runs inline when the last one is old enough (the normal case: one
 * game, profiles live instantly), otherwise coalesces the burst into a single
 * trailing rebuild covering every player seen in the meantime.
 */
const REBUILD_GAP_MS = 15_000;
let lastRebuildAt = 0;
let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
/** Players touched by uploads not yet folded into a rebuild. */
const pendingToons = new Set<string>();

function takePending(): string[] {
	const batch = [...pendingToons];
	pendingToons.clear();
	return batch;
}

/** The work an upload triggers: the players it touched, then the archive-wide derivations. */
async function runRebuild(toons: string[]): Promise<number> {
	const count = await rebuildPlayersFor(toons);
	await refreshDerived(undefined, toons);
	invalidateCache();
	return count;
}

/** Returns how many profiles were rewritten, or null if a rebuild was deferred. */
export async function rebuildPlayersSoon(toons: string[]): Promise<number | null> {
	for (const t of toons) pendingToons.add(t);
	if (rebuildTimer) return null; // a trailing rebuild already covers this
	const since = Date.now() - lastRebuildAt;
	if (since >= REBUILD_GAP_MS) {
		const count = await runRebuild(takePending());
		lastRebuildAt = Date.now();
		return count;
	}
	rebuildTimer = setTimeout(() => {
		rebuildTimer = null;
		void runRebuild(takePending())
			.then(() => {
				lastRebuildAt = Date.now();
			})
			.catch((e) => console.error('deferred player rebuild failed:', e));
	}, REBUILD_GAP_MS - since);
	return null;
}

/**
 * Work out each game's settled result from the save-file counters across the
 * whole archive, and write down the ones that moved.
 *
 * This is the read path's shortcut: settling an outcome needs every replay's
 * sightings (a game's result is the delta to the next game each of its players
 * appears in), which is far too much to read on a page view. Doing it here
 * instead means it happens once per upload, from docs the rebuild already
 * holds — and a new game only settles the previous game of each of its
 * players, so the write is a handful of docs, not the archive.
 *
 * Idempotent: re-running with unchanged data writes nothing and returns 0.
 */
export async function persistSettledOutcomes(
	docs: Pick<ReplayDoc, '_id' | 'playedAt' | 'outcome' | 'settledOutcome' | 'sightings'>[]
): Promise<number> {
	const changes = outcomeChanges(
		docs.map((r) => ({
			file: r._id,
			playedAt: r.playedAt,
			outcome: r.outcome,
			settledOutcome: r.settledOutcome,
			sightings: (r.sightings ?? []).map((s) => ({
				toon: s.toon,
				wins: (s.winsByMode ?? []).reduce((a, b) => a + b, 0),
				gamesPlayed: s.gamesPlayed
			}))
		}))
	);
	if (changes.length) {
		const d = await db();
		await d.collection<ReplayDoc>('replays').bulkWrite(
			changes.map((c) =>
				c.outcome
					? { updateOne: { filter: { _id: c.file }, update: { $set: { settledOutcome: c.outcome } } } }
					: { updateOne: { filter: { _id: c.file }, update: { $unset: { settledOutcome: '' } } } }
			) as never[],
			// each op touches one doc and none depends on another, so there is
			// nothing to gain from applying them one at a time
			{ ordered: false }
		);
	}
	return changes.length;
}

/** Everything the derived-data pass needs, and nothing else. */
const DERIVED_PROJECTION = {
	playedAt: 1,
	durationLoops: 1,
	outcome: 1,
	settledOutcome: 1,
	'sightings.toon': 1,
	'sightings.name': 1,
	'sightings.clan': 1,
	'sightings.mos': 1,
	'sightings.winsByMode': 1,
	'sightings.gamesPlayed': 1
};

type DerivedDoc = Pick<
	ReplayDoc,
	'_id' | 'playedAt' | 'durationLoops' | 'outcome' | 'settledOutcome' | 'sightings'
>;

/** Recompute the all-time per-class playtime boards and store them. */
async function persistMosBoards(docs: DerivedDoc[]): Promise<number> {
	const boards = topPlayersByMos(
		docs.map((r) => ({
			playedAt: r.playedAt,
			durationLoops: r.durationLoops,
			sightings: r.sightings ?? []
		}))
	);
	const entries = Object.entries(boards);
	if (entries.length) {
		const d = await db();
		const at = new Date().toISOString();
		await d.collection('meta').bulkWrite(
			entries.map(([mos, rows]) => ({
				replaceOne: { filter: { _id: mosBoardId(mos) }, replacement: { rows, at }, upsert: true }
			})) as never[],
			{ ordered: false }
		);
	}
	return entries.length;
}

/**
 * Recompute everything derived from the archive as a whole: each game's settled
 * outcome, and the per-class playtime boards.
 *
 * Both need every replay, for the same reason — a game's result is a vote
 * across all its players, and the boards are all-time totals — so they share a
 * single narrow read rather than scanning twice. Pass `docs` when the caller
 * already holds them (the full rebuild does) to skip the read entirely.
 */
export async function refreshDerived(
	docs?: DerivedDoc[],
	onlyToons?: string[]
): Promise<{ outcomes: number; boards: number; mates: number }> {
	const rows =
		docs ??
		((await (await db())
			.collection<ReplayDoc>('replays')
			.find({}, { projection: DERIVED_PROJECTION })
			.toArray()) as DerivedDoc[]);
	const outcomes = await persistSettledOutcomes(rows);
	const boards = await persistMosBoards(rows);
	const mates = await persistTeammates(rows, onlyToons);
	return { outcomes, boards, mates };
}

/**
 * Store each player's top teammates on their profile.
 *
 * This is the read that used to dominate a profile page: working out who
 * someone played with means reading every roster of every game they appeared
 * in — 302 KB and 3.2s for the most active player, on every cold view. The
 * pass above already reads a superset of what `topTeammates` needs, so
 * computing it here costs no extra read at all.
 *
 * `onlyToons` narrows the write to the players an upload touched: a game can
 * only change the teammate lists of the people who were in it.
 */
async function persistTeammates(docs: DerivedDoc[], onlyToons?: string[]): Promise<number> {
	let keys: string[];
	if (onlyToons?.length) {
		keys = [...new Set(onlyToons.filter(Boolean))];
	} else {
		const seen = new Set<string>();
		for (const r of docs) for (const s of r.sightings ?? []) seen.add(s.toon || s.name);
		keys = [...seen];
	}
	if (!keys.length) return 0;
	const d = await db();
	await d.collection('players').bulkWrite(
		keys.map((key) => ({
			updateOne: {
				filter: { _id: key },
				update: { $set: { teammates: topTeammates(docs, key) } }
			}
		})) as never[],
		{ ordered: false }
	);
	return keys.length;
}

/**
 * Values derived from a profile and stored alongside it.
 *
 * None is a source of truth — each is recomputed from the same doc on every
 * rebuild. They exist so a page can be served without reading the parts of the
 * profile they summarise: `careerXp`/`totalWins` let the leaderboard sort and
 * page in the database, and the rest let a profile render without its whole
 * history in hand (`history` is the only unbounded field on a player, 377
 * entries and 78 KB for the most active).
 */
export function withDerived(p: Record<string, unknown>): Record<string, unknown> {
	const history = (p.history ?? []) as { file: string; mos: string[] }[];
	// class picks counted across every game — the one profile figure that
	// genuinely needs the whole history, so it is tallied here instead
	const classGames: Record<string, number> = {};
	for (const h of history) for (const id of h.mos) classGames[id] = (classGames[id] ?? 0) + 1;
	return {
		...p,
		careerXp: careerXp(p as Parameters<typeof careerXp>[0]),
		totalWins: totalWins(p as Parameters<typeof totalWins>[0]),
		historyCount: history.length,
		classGames,
		// the newest game, pinned by retention and offered as a bank backup
		latestFile: history.at(-1)?.file ?? null
	};
}

/**
 * Rebuild just the players named, from their own sightings.
 *
 * An upload can only change the players in it, and `$elemMatch` returns a
 * player's own sighting from each of their games rather than the whole lobby —
 * so this reads one player's history, not the archive. Measured on a real
 * 12-player game: 0.45 MB against the full rebuild's 7 MB.
 *
 * `buildPlayersData` is still the one merge function; only the fetch differs.
 * Its `replays` return value is meaningless here (rosters are partial by
 * design) and is deliberately ignored.
 */
export async function rebuildPlayersFor(toons: string[]): Promise<number> {
	const unique = [...new Set(toons.filter(Boolean))];
	if (!unique.length) return 0;
	const d = await db();
	const col = d.collection<ReplayDoc>('replays');
	const updated: Record<string, unknown>[] = [];
	// sequential: the cluster throttles on bytes returned, so concurrency buys
	// nothing here and only risks the ops-per-second ceiling
	for (const toon of unique) {
		const docs = await col
			.find(
				{ 'sightings.toon': toon },
				{
					projection: {
						playedAt: 1,
						title: 1,
						baseBuild: 1,
						lobbyId: 1,
						durationLoops: 1,
						outcome: 1,
						size: 1,
						sightings: { $elemMatch: { toon } }
					}
				}
			)
			.toArray();
		if (!docs.length) continue;
		const { players } = buildPlayersData(
			docs.map((r) => ({
				replay: {
					file: r._id,
					playedAt: r.playedAt,
					title: r.title,
					baseBuild: r.baseBuild,
					protocolExact: true,
					lobbyId: r.lobbyId ?? 0,
					durationLoops: r.durationLoops ?? 0,
					outcome: r.outcome ?? null,
					sightings: r.sightings
				},
				size: r.size
			}))
		);
		updated.push(...players);
	}
	if (updated.length) {
		await d.collection('players').bulkWrite(
			updated.map((p) => ({
				replaceOne: {
					filter: { _id: p.toon as string },
					replacement: withDerived(p),
					upsert: true
				}
			})) as never[],
			{ ordered: false }
		);
	}
	invalidateCache();
	return updated.length;
}

/**
 * Rebuild every player from every stored replay. The from-scratch path: slow
 * by nature (it reads the whole archive, sightings and all), so uploads use
 * `rebuildPlayersFor`. Kept because it is the only thing that can repair or
 * seed the collection, and the only place a player who has left every replay
 * gets pruned.
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
				outcome: r.outcome ?? null,
				sightings: r.sightings
			},
			size: r.size
		}))
	);

	const col = d.collection('players');
	if (players.length) {
		await col.bulkWrite(
			players.map((p) => ({
				replaceOne: { filter: { _id: p.toon as string }, replacement: withDerived(p), upsert: true }
			})) as never[]
		);
	}
	await col.deleteMany({ _id: { $nin: players.map((p) => p.toon as string) } } as never);
	// derive from the same docs already in hand, so the read paths can render an
	// outcome or a class board without re-deriving either from the whole archive
	await refreshDerived(replayDocs);
	invalidateCache();
	// The retention sweep needs exactly the docs already in hand, so it costs
	// no extra read. Deliberately not awaited: this call sits inside the
	// ingest lock (see routes/api/replays), and bucket deletes must never
	// hold an upload open. A failed delete just stays unpruned and the next
	// rebuild retries it.
	void sweepReplayBlobs(replayDocs).catch((e) => console.error('replay blob sweep failed:', e));
	return players.length;
}

/**
 * Drop bucket blobs that no player still needs as a bank backup, keeping
 * every doc. Gated on REPLAY_PRUNE so the code can ship before the archive is
 * settled enough to start deleting.
 *
 * Each file is deleted under the ingest lock, one at a time, because the sweep
 * runs concurrently with uploads. Without it the `replace` path races us: an
 * upload stores a longer recording of a known game just as we delete that
 * game's blob, and since its sha256 now matches a stored doc the dedupe would
 * refuse the re-upload — the better recording would be unrecoverable. Four
 * companions backfilling the same shared lobbies makes that path common, not
 * theoretical. Taking the lock per file (rather than for the whole sweep)
 * keeps uploads interleaving between deletes instead of queueing behind all
 * of them.
 */
let sweepRunning = false;

export function pruneEnabled(): boolean {
	return process.env.REPLAY_PRUNE === '1';
}

export async function sweepReplayBlobs(docs: ReplayDoc[]): Promise<number> {
	if (!pruneEnabled() || !bucketConfigured() || sweepRunning) return 0;
	sweepRunning = true;
	try {
		const files = prunableReplays(
			docs.map((r) => ({
				file: r._id,
				playedAt: r.playedAt,
				toons: r.sightings.map((s) => s.toon).filter(Boolean),
				blobPruned: Boolean(r.blobPrunedAt)
			})),
			Number(process.env.REPLAY_KEEP_PER_PLAYER ?? 1)
		);
		if (!files.length) return 0;

		// sha at decision time — if it changed, an upload replaced this game
		// with a longer recording and the blob we meant to drop is not the
		// blob that is there now
		const shaAtDecision = new Map(docs.map((r) => [r._id, r.sha256]));

		const d = await db();
		const col = d.collection<ReplayDoc>('replays');
		let done = 0;
		for (const file of files) {
			try {
				done += await withLock('replay-ingest', async () => {
					const cur = await col.findOne(
						{ _id: file },
						{ projection: { sha256: 1, blobPrunedAt: 1 } }
					);
					// re-checked under the lock: another sweep or an upload may
					// have moved on since the set was computed
					if (!cur || cur.blobPrunedAt) return 0;
					if (cur.sha256 !== shaAtDecision.get(file)) return 0;
					await deleteObject(`replays/${file}`);
					// marked only after the bytes are actually gone, so a
					// failure here leaves the file eligible for a retry
					await col.updateOne(
						{ _id: file },
						{ $set: { blobPrunedAt: new Date().toISOString() } }
					);
					return 1;
				});
			} catch (e) {
				console.error(`prune ${file} failed:`, e);
			}
		}
		if (done) {
			console.log(`replay blob sweep: pruned ${done}/${files.length}`);
			invalidateCache();
		}
		return done;
	} finally {
		sweepRunning = false;
	}
}
