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
import { modeChanges } from '../mode.ts';
import { PER_PAGE, pageNumber, type Paged } from 'sveltekit-commons/paging';
import { cacheKeyMatches, cacheState } from 'sveltekit-commons/cache';
import { escapeRegex } from 'sveltekit-commons/text';
import { careerXp, totalWins } from '../xp.ts';
import { restorePins, type CutEntry } from '../progressionCuts.ts';
import { BANNED_TOONS } from '../banned.ts';
import { bucketConfigured, deleteObject } from './replay/s3.ts';
import { pinnedOnArrival, prunableReplays } from '../replayRetention.ts';
import { withLock } from '../mutex.ts';
import { classBoardsByMos, type MosBoard } from './playtime.ts';
import { topTeammates } from './teammates.ts';
import { startedAtOf } from '../gameEnd.ts';
import type { ActivityGame } from '../activity.ts';
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
	/**
	 * The replay's `m_timeUTC`, which SC2 stamps when it writes the file — so
	 * the moment the *recording stopped*, not the moment the game began. The
	 * name predates knowing that, and the document id is built from it, so it
	 * stays as it is; anything that wants a start time derives one with
	 * `startedAtOf` (or reads `startedAt` below).
	 */
	playedAt: string;
	/**
	 * When the game began, UTC — `playedAt` less the recording's length.
	 * Stored rather than derived on read so the activity window can range on
	 * it. Absent on docs written before it existed; the read paths fall back
	 * to deriving it.
	 */
	startedAt?: string;
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
	 * How long the game itself lasted, in the same loops — see lib/gameEnd.ts.
	 * Shorter than `durationLoops` when the uploader's client sat in the map
	 * after the game was over; equal for every ordinary recording. This is
	 * what pages show and what the playtime aggregations credit, while
	 * `durationLoops` remains the recording's own length for the dedupe.
	 * Absent on docs written before it existed.
	 */
	gameLoops?: number;
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
	 * The game mode the parser counted out of the opening vote, 1..12. Absent
	 * on games ingested before modes were read, and on recordings that stopped
	 * before the vote closed — `replayModes` settles those from the save-file
	 * win counters instead, so this is a hint, not the answer.
	 */
	mode?: number;
	/**
	 * The settled mode, written by `rebuildPlayers` from the win counters
	 * across every stored game (see lib/mode.ts). Derived, never authored, for
	 * the same reason as `settledOutcome` — and the reason a game whose blob
	 * is long gone can still gain a mode it never had.
	 */
	settledMode?: number;
	/**
	 * Modifier ids the lobby voted on (see lib/modifiers.ts). An empty array
	 * means the vote was read and the lobby wanted none; absent means the
	 * recording never covered that vote, and nothing else can recover it —
	 * unlike the mode, no save-file counter names a modifier.
	 */
	modifiers?: number[];
	/**
	 * When the bucket blob was dropped by the retention sweep, ISO. Absent
	 * means the bytes are still downloadable. The doc itself is never
	 * deleted, so lobbyId/sha256/size/sightings survive as the game's record
	 * (and keep the upload dedupe answering "known" — see replayExistsBySha).
	 */
	blobPrunedAt?: string;
	/**
	 * The parser generation that wrote `sightings` — see PARSER_GENERATION in
	 * replay/extract.ts. Absent on docs from before it was stamped, which a
	 * backfill treats as generation 0: readable docs below the current one
	 * are re-read from the bucket for whatever the newer parser adds.
	 */
	parser?: number;
	/** Which version of the map was played — see ParsedReplay.mapChecksum. */
	mapChecksum?: number;
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

// Presence is not stored here: a heartbeat is stale in two minutes and is
// never read historically, so it lives in this process — see
// server/presenceStore.ts for why, and for what a deploy costs.

/**
 * One browser's Web Push subscription. Keyed by endpoint, so re-subscribing
 * the same browser replaces its row rather than accumulating dead ones —
 * which matters because a browser that revokes permission or clears its
 * storage tells the site nothing, and the only other way a row is ever
 * removed is a push service answering 404/410.
 */
export interface PushSubDoc {
	_id: string; // the push service endpoint URL
	sub: string; // Battle.net account id — who to leave out of their own news
	battletag: string;
	/** UA public key, base64url. */
	p256dh: string;
	/** UA auth secret, base64url. */
	auth: string;
	prefs: { ready: boolean; lobby: boolean };
	createdAt: string;
	seenAt: string;
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
		d.collection('players').createIndex({ clan: 1 }, { name: 'clan' }),
		// the sweep's under-lock question, asked once per file it means to
		// delete: "is this somebody's restore point?" (multikey over the array)
		d.collection('players').createIndex({ restoreFiles: 1 }, { name: 'restoreFiles' }),
		// an account by one of its handles: who a ping names, who may publish (multikey over the array)
		d.collection('accounts').createIndex({ toons: 1 }, { name: 'toons' })
	]);
}

/**
 * Fill the read cache with what the landing pages need, at boot.
 *
 * A deploy restarts the machine, and the cache lives in its memory — so
 * without this the first visitor after every release pays the full cold read
 * of whichever page they happen to open. They are the least deserving person
 * to charge for it, and on a release day it is the same person repeatedly.
 *
 * Sequential on purpose: the cluster throttles on bytes returned, so firing
 * these together would only make them queue, and nobody is waiting on this.
 */
export async function warmCache(): Promise<void> {
	if (!dbConfigured()) return;
	const warmers: [string, () => Promise<unknown>][] = [
		['replays', () => getReplaysPage(null)],
		['players', () => getPlayersPage({ sort: 'career', dir: -1, q: '', page: null })],
		['clans', () => getClanMembers()],
		['overview', () => getWeeklyBoards()],
		['overview:recent', () => getRecentReplays(5)],
		['overview:stats', () => getReplayStats()],
		['avatars', () => getAvatarsByToon()]
	];
	for (const [name, run] of warmers) {
		try {
			await run();
		} catch (e) {
			// a cold cache is the worst this can cost; never hold up the server
			console.error(`cache warm failed (${name}):`, e);
		}
	}
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

/**
 * How long a cached value is served without rechecking.
 *
 * What keeps this cache honest is `invalidateCache`, not the clock: every
 * write path clears it, so data that only changes on upload — replays,
 * profiles, clans, the class boards — cannot go stale between uploads however
 * long the TTL is. A short TTL there buys nothing and costs a re-read.
 *
 * The clock only matters for the things nothing in this process invalidates:
 * feedback triage (written straight to Atlas by the admin tool), the ready
 * flags (which expire on a timestamp), and the windowed boards (whose window
 * slides even when the data behind it does not).
 */
const TTL_MS = 10 * 60_000;
/** Keys whose value ages on its own, and so cannot rely on invalidation. */
const SHORT_TTL_KEYS = new Set(['ready', 'weeklyBoards']);
const SHORT_TTL_MS = 30_000;
const ttlFor = (key: string) =>
	SHORT_TTL_KEYS.has(key) || key.startsWith('replays:activity') || key.startsWith('mosWeek:')
		? SHORT_TTL_MS
		: TTL_MS;
/**
 * How long past its TTL an entry may still be served while its refresh runs.
 * Past the TTL the value is refetched, but nobody is made to *wait* for that
 * refetch — otherwise whichever page view happens to land on the expiry pays
 * the whole read, which is exactly how a slow query turns into a random
 * multi-second stall for one unlucky visitor.
 *
 * A window measured *from the TTL*, not an absolute age. It was the latter
 * once, which quietly broke the moment the TTL was raised past it: the
 * stale branch became unreachable and every expiry blocked a visitor again.
 * Expressed this way it cannot be outrun by whatever a TTL is set to.
 */
const STALE_WINDOW_MS = 30 * 60_000;
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

/**
 * Cache telemetry, grouped by the kind of key rather than the key itself.
 *
 * Per-key would be the wrong grain: with hundreds of players against an LRU of
 * a few hundred entries, most keys are evicted long before they say anything.
 * By category it answers the questions worth asking — is a TTL set wrong, and
 * which reads are actually expensive.
 *
 * In memory only, and deliberately so: persisting it would mean writing to the
 * very database this cache exists to read less of.
 */
interface CacheStat {
	hits: number;
	stale: number;
	builds: number;
	totalMs: number;
	maxMs: number;
}
const stats = new Map<string, CacheStat>();

/** `playerHistory:2-S2-1-7486118:3` -> `playerHistory`. */
const categoryOf = (key: string) => key.split(':')[0];

function stat(key: string): CacheStat {
	const c = categoryOf(key);
	let s = stats.get(c);
	if (!s) stats.set(c, (s = { hits: 0, stale: 0, builds: 0, totalMs: 0, maxMs: 0 }));
	return s;
}

/** One line per category: hit rate, and what a miss costs. */
export function cacheStats(): string[] {
	return [...stats.entries()]
		.sort((a, b) => b[1].hits + b[1].builds - (a[1].hits + a[1].builds))
		.map(([name, s]) => {
			const total = s.hits + s.stale + s.builds;
			const pct = total ? Math.round((s.hits / total) * 100) : 0;
			const avg = s.builds ? Math.round(s.totalMs / s.builds) : 0;
			return `${name}: ${pct}% hit (${s.hits} hit, ${s.stale} stale, ${s.builds} built) build avg ${avg}ms max ${Math.round(s.maxMs)}ms`;
		});
}

/** Reads currently in flight, so N concurrent misses share one query. */
const inFlight = new Map<string, { gen: number; promise: Promise<unknown> }>();
/** Bumped by every invalidation, so a read cannot cache pre-write data. */
let generation = 0;

function refresh<T>(key: string, load: () => Promise<T>): Promise<T> {
	const running = inFlight.get(key);
	if (running && running.gen === generation) return running.promise as Promise<T>;
	const gen = generation;
	const startedAt = Date.now();
	const entry = {
		gen,
		promise: load()
			.then((value) => {
				const took = Date.now() - startedAt;
				const s = stat(key);
				s.builds++;
				s.totalMs += took;
				if (took > s.maxMs) s.maxMs = took;
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

export async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
	const hit = cache.get(key);
	if (hit) {
		const state = cacheState(Date.now() - hit.at, ttlFor(key), STALE_WINDOW_MS);
		if (state === 'fresh') {
			stat(key).hits++;
			touch(key, hit); // keep hot entries out of the LRU's way
			return hit.value as T;
		}
		if (state === 'stale') {
			stat(key).stale++;
			// serve what we have and let the refresh finish in the background;
			// a failed refresh just leaves the stale value for the next attempt
			void refresh(key, load).catch(() => {});
			return hit.value as T;
		}
	}
	return refresh(key, load);
}

/**
 * Drop cached values, optionally only those under the given key prefixes.
 *
 * Scope matters far more than it looks. Presence heartbeats arrive from every
 * running Companion every half-minute or so, and while this cleared everything
 * unconditionally each one threw away the replay list, the leaderboard, the
 * clan boards and every cached profile — so almost every page view was a cold
 * read, and no amount of TTL could help, because a cleared entry is not even
 * stale enough to serve while it refreshes.
 *
 * Called with no arguments it still clears the lot; that is right for an upload,
 * which can change nearly anything derived.
 */
export function invalidateCache(...prefixes: string[]): void {
	generation++;
	if (!prefixes.length) {
		cache.clear();
		return;
	}
	for (const key of [...cache.keys()]) {
		if (cacheKeyMatches(key, prefixes)) cache.delete(key);
	}
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
 * The clause that keeps the map's banned handles off a board (see $lib/banned).
 * Spread into a filter rather than exported as one, so each call site still
 * reads as its own query.
 */
const NOT_BANNED: Record<string, unknown> = { _id: { $nin: BANNED_TOONS } };

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
		const filter: Record<string, unknown> = tag
			? { clan: tag, ...NOT_BANNED }
			: { clan: { $nin: ['', null] }, ...NOT_BANNED };
		return d
			.collection('players')
			.find(filter, { projection: CLAN_PROJECTION })
			.toArray() as Promise<Record<string, unknown>[]>;
	});
}

/**
 * Profiles the boards will show — a counter, not a reason to read the
 * collection. Banned handles are left out so this agrees with the leaderboard
 * it is printed above, rather than promising a row the list will not produce.
 */
export async function countPlayers(): Promise<number> {
	return cached('players:count', async () =>
		(await db()).collection('players').countDocuments(NOT_BANNED)
	);
}

/**
 * Player rows without the per-game history and the unlock arrays — those
 * are only needed on a profile page, and carrying them for every player
 * made the leaderboard payload grow with the archive. The per-profile maps
 * `withDerived` and the merge store (class tallies, teammates, restore pins)
 * are left off for the same reason: the board renders none of them, and on
 * a cluster metered by bytes fifty rows of them is a page of nothing.
 */
const PLAYER_LIST_PROJECTION = {
	_id: 0,
	history: 0,
	unlocks: 0,
	classGames: 0,
	classSeconds: 0,
	teammates: 0,
	restoreFiles: 0
};

/**
 * Leaderboard column -> the field Mongo sorts on. Two of them are stored only
 * so this mapping can exist: `careerXp` and `totalWins` are derived, and
 * sorting the whole table in JS meant reading the whole table (see
 * `withSortKeys`).
 */
const PLAYER_SORT_FIELDS: Record<string, string> = {
	name: 'name',
	career: 'careerXp',
	prestige: 'prestige',
	games: 'gamesPlayed',
	wins: 'totalWins',
	revives: 'revives',
	// absent on profiles not rebuilt since it was added; Mongo ranks a missing
	// field below every number, so those rows simply trail the board
	time: 'playSeconds',
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
	/* Browsing this table is reading a board, so it drops the handles the map
	   bans. Searching it is looking someone up, and that still finds them: the
	   point of the exclusion is that a forged career does not outrank an earned
	   one, not that the profile becomes unreachable — it stays linked from every
	   game they played, and the command palette finds it too. */
	const filter = opts.q ? playerSearchFilter(opts.q) : NOT_BANNED;
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

/** The five fields a palette row shows, and nothing else. */
const PLAYER_SEARCH_PROJECTION = { _id: 0, name: 1, toon: 1, clan: 1, careerXp: 1 };

/**
 * The best few players matching `q`, for the command palette.
 *
 * Deliberately not `getPlayersPage`: this one runs behind a search box, so it
 * is on the hook for a read per (debounced) keystroke. It carries no count —
 * `countDocuments` is a second query and the palette shows a handful of rows,
 * not a total — a five-field projection, and a hard `limit`, which together
 * put a ceiling of a few kilobytes on what any one query can pull back. That
 * ceiling is the point on a free-tier cluster with a read-throughput cap.
 *
 * Cached per query string, so a visitor deleting and retyping a name pays for
 * one read; the LRU bound on the cache is what keeps visitor-supplied keys
 * from growing the map without end.
 */
export async function searchPlayers(q: string, limit: number): Promise<Record<string, unknown>[]> {
	if (!q) return [];
	return cached(`playerSearch:${q.toLowerCase()}:${limit}`, async () => {
		const d = await db();
		return (await d
			.collection('players')
			.find(playerSearchFilter(q), { projection: PLAYER_SEARCH_PROJECTION })
			// the career board's own order, so the palette offers the player most
			// people mean first when several names share a fragment
			.sort({ careerXp: -1, _id: 1 })
			.limit(limit)
			.toArray()) as Record<string, unknown>[];
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
 * The games in a player's history that gave them something, newest first.
 *
 * `$filter` runs in the database, so what comes back is the handful of games
 * that produced an award rather than the whole history for this process to
 * sift — which for the most active player is 377 entries and 78 KB, on a
 * cluster whose only lever is bytes returned. That is the entire reason ranks
 * and prestige are written down beside the unlocks: if half an award were
 * worked out here, nothing could be filtered there.
 *
 * `gamesPlayed` rides along because the feed needs the run between each pair —
 * the games nobody uploaded, which is what makes an award approximate.
 */
export async function getPlayerAwards(
	toon: string,
	limit = 60
): Promise<Record<string, unknown>[]> {
	return cached(`playerAwards:${toon}:${limit}`, async () => {
		const d = await db();
		const rows = await d
			.collection('players')
			.aggregate([
				{ $match: { _id: toon } },
				{
					$project: {
						_id: 0,
						history: {
							$filter: {
								input: '$history',
								as: 'h',
								cond: { $gt: [{ $size: { $ifNull: ['$$h.awards', []] } }, 0] }
							}
						},
						// every entry's game counter, so a run can be measured across
						// the games that gave nothing and were therefore filtered out
						counters: {
							$map: { input: '$history', as: 'h', in: '$$h.gamesPlayed' }
						}
					}
				}
			])
			.toArray();
		const doc = rows[0] as
			| { history?: Record<string, unknown>[]; counters?: number[] }
			| undefined;
		if (!doc?.history?.length) return [];
		// oldest first out of the database; the feed reads the other way
		const counters = doc.counters ?? [];
		return doc.history
			.map((h) => {
				/* The run this game opens: from its own counter to the next game
				   that was actually uploaded.

				   Found as the first counter strictly greater than this one,
				   rather than by looking this counter up and stepping forward.
				   Two stored games can share a counter — the same game recorded
				   by two players, or a save restored — and an index lookup would
				   then step on from the wrong one and measure a run that never
				   happened. */
				const here = h.gamesPlayed as number;
				const next = counters.find((c) => c > here);
				const span = next === undefined ? 1 : Math.max(1, next - here);
				return { ...h, span };
			})
			.reverse()
			.slice(0, limit);
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
	startedAt: 1,
	players: 1,
	size: 1,
	durationLoops: 1,
	gameLoops: 1,
	blobPrunedAt: 1,
	outcome: 1,
	settledOutcome: 1,
	mode: 1,
	settledMode: 1,
	modifiers: 1
};

/**
 * The settled result if the counters have decided one, else whatever the
 * parser read out of the file. Same precedence as `replayOutcomes`, which
 * prefers its cross-replay verdict and falls back to the parser's hint.
 */
function replayOutcomeOf(r: Pick<ReplayDoc, 'settledOutcome' | 'outcome'>): Outcome | undefined {
	return r.settledOutcome ?? r.outcome;
}

/**
 * The settled mode if the counters produced one worth trusting, else what the
 * parser counted out of the vote. `settledMode` is only written where the
 * counters were corroborated or the vote had nothing to say, so this is the
 * same precedence `replayModes` applies — not a blanket win for the counters.
 */
function replayModeOf(r: Pick<ReplayDoc, 'settledMode' | 'mode'>): number | undefined {
	return r.settledMode ?? r.mode;
}

/**
 * The game's own length, falling back to the recording's on the docs written
 * before the two were told apart (see lib/gameEnd.ts). Those are equal for
 * every recording that did not idle past the end, which is nearly all of
 * them — and `scripts/backfill-gameend.ts` settles the rest from the blobs.
 */
function gameLoopsOf(r: Pick<ReplayDoc, 'gameLoops' | 'durationLoops'>): number {
	return r.gameLoops ?? r.durationLoops ?? 0;
}

function toRow(r: ReplayDoc): ReplayMeta {
	const outcome = replayOutcomeOf(r);
	const mode = replayModeOf(r);
	return {
		file: r._id,
		playedAt: r.playedAt,
		startedAt: r.startedAt ?? startedAtOf(r.playedAt, r.durationLoops),
		players: r.players,
		size: r.size,
		durationLoops: r.durationLoops ?? 0,
		gameLoops: gameLoopsOf(r),
		blobPruned: Boolean(r.blobPrunedAt),
		...(outcome ? { outcome } : {}),
		...(mode ? { mode } : {}),
		...(r.modifiers?.length ? { modifiers: r.modifiers } : {})
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
 * Games overlapping the activity chart's trailing window, each with the time
 * it actually started (`playedAt` is when its recording stopped, so the raw
 * field would place a game a full game-length late — see gameEnd.ts).
 *
 * Still ranged on `playedAt`: it is the indexed field, and the day of slack it
 * already carries — there for games that began before the window and credit
 * the slots they run into — is far more than the couple of hours the two
 * timestamps differ by. `activityTimeline` clips such games to the window
 * rather than dropping them, and caps any one game at a day.
 */
export async function getActivityReplays(days: number): Promise<ActivityGame[]> {
	return cached(`replays:activity:${days}`, async () => {
		const d = await db();
		const since = new Date(Date.now() - (days + 1) * 24 * 3600 * 1000)
			.toISOString()
			.slice(0, 19) + 'Z'; // same fixed-width shape the ingest writes
		const docs = await d
			.collection<ReplayDoc>('replays')
			.find(
				{ playedAt: { $gte: since } },
				{
					projection: {
						playedAt: 1,
						startedAt: 1,
						players: 1,
						durationLoops: 1,
						gameLoops: 1,
						outcome: 1,
						settledOutcome: 1,
						mode: 1,
						settledMode: 1
					}
				}
			)
			.sort({ playedAt: 1 })
			.toArray();
		return docs.map((r) => {
			const outcome = replayOutcomeOf(r);
			const mode = replayModeOf(r);
			return {
				file: r._id,
				startedAt: r.startedAt ?? startedAtOf(r.playedAt, r.durationLoops),
				players: r.players,
				gameLoops: gameLoopsOf(r),
				...(outcome ? { outcome } : {}),
				...(mode ? { mode } : {})
			};
		});
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

/** What a page needs about a game it lists but does not load in full. */
export interface ReplayFacts {
	/** When the game began, UTC — what a history row should date itself by. */
	startedAt: string;
	/** The recording's length — what the "recorded" tile reports. */
	durationLoops: number;
	/** The game's own length — what a duration column should show. */
	gameLoops: number;
	outcome?: Outcome;
	mode?: number;
	modifiers?: number[];
}

/**
 * file -> outcome and length, for pages that show individual games:
 * a profile's replay history, one replay's page. Takes the files the caller
 * already knows it will render, so the read scales with the page and not with
 * the archive.
 */
export async function getReplayFacts(
	cacheKey: string,
	files: string[]
): Promise<Record<string, ReplayFacts>> {
	if (!files.length) return {};
	// keyed by which page of whose history it is, so a revisit does not re-read
	return cached(`replayFacts:${cacheKey}`, async () => {
		const map: Record<string, ReplayFacts> = {};
		const d = await db();
		const docs = await d
			.collection<ReplayDoc>('replays')
			.find(
				{ _id: { $in: files } },
				{
					projection: {
						playedAt: 1,
						startedAt: 1,
						durationLoops: 1,
						gameLoops: 1,
						outcome: 1,
						settledOutcome: 1,
						mode: 1,
						settledMode: 1,
						modifiers: 1
					}
				}
			)
			.toArray();
		for (const r of docs) {
			const outcome = replayOutcomeOf(r);
			const mode = replayModeOf(r);
			map[r._id] = {
				startedAt: r.startedAt ?? startedAtOf(r.playedAt, r.durationLoops),
				durationLoops: r.durationLoops ?? 0,
				gameLoops: gameLoopsOf(r),
				...(outcome ? { outcome } : {}),
				...(mode ? { mode } : {}),
				...(r.modifiers?.length ? { modifiers: r.modifiers } : {})
			};
		}
		return map;
	});
}

/**
 * Exactly the per-player fields one game's page shows. Notably not `unlocks`,
 * which is around 62% of a replay document's bytes and which this page has
 * never rendered — it was being read in full on every view because the read
 * asked for the whole document.
 */
const REPLAY_DETAIL_PROJECTION = {
	playedAt: 1,
	startedAt: 1,
	title: 1,
	baseBuild: 1,
	size: 1,
	durationLoops: 1,
	gameLoops: 1,
	outcome: 1,
	settledOutcome: 1,
	mode: 1,
	settledMode: 1,
	modifiers: 1,
	blobPrunedAt: 1,
	'sightings.name': 1,
	'sightings.clan': 1,
	'sightings.toon': 1,
	'sightings.mos': 1,
	'sightings.xpEn': 1,
	'sightings.xpWo': 1,
	'sightings.xpCo': 1,
	'sightings.prestige': 1,
	'sightings.gamesPlayed': 1,
	'sightings.revives': 1
};

export async function getReplay(file: string): Promise<ReplayDetail | null> {
	return cached(`replay:${file}`, () => readReplay(file));
}

async function readReplay(file: string): Promise<ReplayDetail | null> {
	const d = await db();
	const doc = await d
		.collection<ReplayDoc>('replays')
		.findOne({ _id: file }, { projection: REPLAY_DETAIL_PROJECTION });
	if (!doc) return null;
	return {
		file: doc._id,
		playedAt: doc.playedAt,
		startedAt: doc.startedAt ?? startedAtOf(doc.playedAt, doc.durationLoops),
		title: doc.title,
		baseBuild: doc.baseBuild,
		size: doc.size,
		durationLoops: doc.durationLoops ?? 0,
		gameLoops: gameLoopsOf(doc),
		// the settled result rides on the doc itself now, so one game's page
		// no longer re-derives it from the whole archive
		outcome: replayOutcomeOf(doc) ?? null,
		mode: replayModeOf(doc) ?? null,
		modifiers: doc.modifiers ?? [],
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

/** What `persistMosBoards` stores per class: the board, its totals, the last games, and when. */
export type MosBoardDoc = MosBoard & { at: string };

/**
 * A class's stored board — everything its Players tab shows — or null when
 * no recorded game has had the class in it.
 *
 * A doc written before the totals existed carries rows alone. Rather than
 * show that page degraded until the next upload happens to recompute the
 * boards, the first read of one rebuilds them — the same read and the same
 * write the upload pipeline would do, once, for every class at once — and
 * reads again. Under the ingest lock, so it cannot race an upload's own
 * rebuild, and behind the cache, so a burst of views does not queue up
 * archive scans.
 */
export async function getMosBoard(mosId: string): Promise<Partial<MosBoardDoc> | null> {
	return cached(`mosBoard:${mosId}`, async () => {
		const d = await db();
		const read = async () =>
			((await d.collection('meta').findOne({ _id: mosBoardId(mosId) } as never)) as
				| Partial<MosBoardDoc>
				| null) ?? null;
		let doc = await read();
		if (doc && !doc.stats) {
			await withLock('replay-ingest', async () => {
				const rows = (await d
					.collection<ReplayDoc>('replays')
					.find({}, { projection: DERIVED_PROJECTION })
					.toArray()) as DerivedDoc[];
				await persistMosBoards(rows);
			});
			// the other classes' cached docs are old-shape too
			invalidateCache('mosBoard:');
			doc = await read();
		}
		return doc;
	});
}

/**
 * One class's playtime board. All-time, so unlike the weekly widgets it cannot
 * be narrowed by a date window — instead it is aggregated once when the
 * archive changes and stored, so this is a point read of about a kilobyte
 * rather than a scan of every replay's sightings.
 *
 */
/**
 * A class's last seven days: the same board, over only the games in the
 * window. Computed at read time from a narrow query — seven days, this class
 * — the way the front page's weekly boards are, because a sliding window is
 * the one thing the derived pass cannot store. Null when the window is empty.
 */
export async function getMosWeek(mosId: string): Promise<MosBoard | null> {
	return cached(`mosWeek:${mosId}`, async () => {
		const d = await db();
		const since = new Date(Date.now() - WINDOW_MS).toISOString().slice(0, 19) + 'Z';
		const docs = (await d
			.collection<ReplayDoc>('replays')
			.find({ playedAt: { $gte: since }, 'sightings.mos': mosId }, { projection: DERIVED_PROJECTION })
			.toArray()) as DerivedDoc[];
		const boards = classBoardsByMos(
			docs.map((r) => ({
				file: r._id,
				playedAt: r.playedAt,
				durationLoops: r.durationLoops,
				gameLoops: r.gameLoops,
				outcome: replayOutcomeOf(r) ?? null,
				mode: replayModeOf(r) ?? null,
				sightings: r.sightings ?? []
			})),
			// the same twenty-five the all-time board keeps
			{ limit: 25, recent: 0, alongside: 0 }
		);
		return boards[mosId] ?? null;
	});
}

export async function getMosTopPlayers(mosId: string): Promise<MosTopPlayer[]> {
	// the API's ten, off the stored board's longer list
	return ((await getMosBoard(mosId))?.rows ?? []).slice(0, 10);
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
						players: 1,
						outcome: 1,
						settledOutcome: 1,
						mode: 1,
						settledMode: 1,
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
		return weeklyBoards(
			docs.map((r) => ({ ...r, outcome: replayOutcomeOf(r), mode: replayModeOf(r) })),
			now
		);
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
): Promise<{ file: string; startedAt: string; blobPruned: boolean } | null> {
	const d = await db();
	const doc = await d
		.collection<ReplayDoc>('replays')
		.findOne(
			{ sha256 },
			{ projection: { _id: 1, playedAt: 1, startedAt: 1, durationLoops: 1, blobPrunedAt: 1 } }
		);
	// the start, so a rejection names the game by the time the uploader played
	// it rather than by the time their recording happened to stop
	return doc
		? {
				file: doc._id,
				startedAt: doc.startedAt ?? startedAtOf(doc.playedAt, doc.durationLoops),
				blobPruned: Boolean(doc.blobPrunedAt)
			}
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
	invalidateCache('ready');
}

export async function clearReady(sub: string): Promise<void> {
	const d = await db();
	await d.collection<ReadyDoc>('ready').deleteOne({ _id: sub });
	invalidateCache('ready');
}

/**
 * Every push subscription, for the fan-out.
 *
 * Cached because the fan-out re-reads it on every roster change while the
 * collection itself changes about once per player per device, ever — and the
 * cluster throttles on bytes returned, not on queries.
 */
export async function getPushSubs(): Promise<PushSubDoc[]> {
	return cached('push', async () => {
		const d = await db();
		return d.collection<PushSubDoc>('pushSubs').find().toArray();
	});
}

/** This account's subscriptions — the account page reads its own state. */
export async function getPushSubsForAccount(sub: string): Promise<PushSubDoc[]> {
	const d = await db();
	return d.collection<PushSubDoc>('pushSubs').find({ sub }).toArray();
}

/** Cap per account, so a browser that re-subscribes on a loop cannot grow it. */
const MAX_SUBS_PER_ACCOUNT = 10;

export async function upsertPushSub(doc: PushSubDoc): Promise<void> {
	const d = await db();
	const col = d.collection<PushSubDoc>('pushSubs');
	await col.replaceOne({ _id: doc._id }, doc, { upsert: true });
	// oldest first, drop the overflow: the browsers someone actually uses are
	// the ones that re-subscribed most recently
	const mine = await col.find({ sub: doc.sub }, { projection: { _id: 1, seenAt: 1 } }).toArray();
	if (mine.length > MAX_SUBS_PER_ACCOUNT) {
		const stale = mine
			.sort((a, b) => a.seenAt.localeCompare(b.seenAt))
			.slice(0, mine.length - MAX_SUBS_PER_ACCOUNT)
			.map((s) => s._id);
		await col.deleteMany({ _id: { $in: stale } });
	}
	invalidateCache('push');
}

export async function deletePushSub(endpoint: string): Promise<void> {
	const d = await db();
	await d.collection<PushSubDoc>('pushSubs').deleteOne({ _id: endpoint });
	invalidateCache('push');
}

/** Drops every device — what unlinking an account has to do. */
export async function deletePushSubsForAccount(sub: string): Promise<void> {
	const d = await db();
	await d.collection<PushSubDoc>('pushSubs').deleteMany({ sub });
	invalidateCache('push');
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
	invalidateCache('avatars', 'names', 'playerDirectory', 'accountByToon');
}

/** The account's primary profile: first seen in UAR replays, else the first. */
export async function pickPrimaryProfile(profiles: Sc2Profile[]): Promise<Sc2Profile | undefined> {
	for (const p of profiles) {
		if (await getPlayerSummary(p.toon)) return p;
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

/**
 * Every profile that has a page, with the date its data last moved — the
 * sitemap's rows and their `lastmod`.
 *
 * Deliberately not getPlayerDirectory: that map is keyed by in-game name, so a
 * player carrying no name, or sharing one with somebody else, loses their
 * entry — five real profiles were missing from the sitemap that way. Two
 * fields over the collection is as narrow as a read of it gets.
 */
export async function getPlayerSitemap(): Promise<{ toon: string; lastSeen?: string }[]> {
	return cached('playerSitemap', async () => {
		const d = await db();
		/* Banned handles are left out: their page still loads and is still
		   findable on the site, but it carries a statement about a named person's
		   account, and there is no reason to go asking search engines to index
		   that against their name. */
		const docs = (await d
			.collection('players')
			.find(NOT_BANNED, { projection: { _id: 1, lastSeen: 1 } })
			.toArray()) as unknown as { _id: string; lastSeen?: string }[];
		return docs.map((p) => ({ toon: p._id, lastSeen: p.lastSeen }));
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

/**
 * toon -> SC2 profile name, across every linked account.
 *
 * Ready flags and presence heartbeats are keyed by Battle.net account, and an
 * account only knows its battletag — so the rosters used to read out as
 * "Kanax#2515" where the lobby, the player pages and everything else say
 * "KanaxStratz". Resolved here rather than stamped into the session or the
 * documents: it then also covers flags raised before this shipped, and a
 * player who renames does not have to sign in again.
 */
export async function getNamesByToon(): Promise<Record<string, string>> {
	return cached('names', async () => {
		const d = await db();
		const docs = await d
			.collection<AccountDoc>('accounts')
			.find({}, { projection: { profiles: 1 } })
			.toArray();
		const map: Record<string, string> = {};
		for (const a of docs) {
			for (const p of a.profiles ?? []) if (p.name) map[p.toon] = p.name;
		}
		return map;
	});
}

export async function getAccount(sub: string): Promise<AccountDoc | null> {
	const d = await db();
	return d.collection<AccountDoc>('accounts').findOne({ _id: sub });
}

/**
 * The account that owns this toon, if anyone has linked it. Read on every
 * profile page and changed only by linking or unlinking, so it is cached and
 * dropped by those two writes.
 */
export async function getAccountByToon(toon: string): Promise<AccountDoc | null> {
	return cached(`accountByToon:${toon}`, async () => {
		const d = await db();
		return d.collection<AccountDoc>('accounts').findOne({ toons: toon });
	});
}

export async function deleteAccount(sub: string): Promise<void> {
	const d = await db();
	await d.collection<AccountDoc>('accounts').deleteOne({ _id: sub });
	invalidateCache('avatars', 'names', 'playerDirectory', 'accountByToon');
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

/**
 * Work out each game's settled mode from the per-mode win counters across the
 * whole archive, and write down the ones that moved.
 *
 * Same shape and the same reasoning as `persistSettledOutcomes`: settling a
 * mode needs every replay's sightings, which no page view can afford to read,
 * and a new game only settles the previous game of each of its players — so
 * the write is a handful of docs, not the archive.
 *
 * Idempotent: re-running with unchanged data writes nothing and returns 0.
 */
export async function persistSettledModes(
	docs: Pick<ReplayDoc, '_id' | 'playedAt' | 'mode' | 'settledMode' | 'sightings'>[]
): Promise<number> {
	const changes = modeChanges(
		docs.map((r) => ({
			file: r._id,
			playedAt: r.playedAt,
			mode: r.mode,
			settledMode: r.settledMode,
			sightings: (r.sightings ?? []).map((s) => ({
				toon: s.toon,
				winsByMode: s.winsByMode ?? [],
				gamesPlayed: s.gamesPlayed
			}))
		}))
	);
	if (changes.length) {
		const d = await db();
		await d.collection<ReplayDoc>('replays').bulkWrite(
			changes.map((c) =>
				c.mode
					? { updateOne: { filter: { _id: c.file }, update: { $set: { settledMode: c.mode } } } }
					: { updateOne: { filter: { _id: c.file }, update: { $unset: { settledMode: '' } } } }
			) as never[],
			{ ordered: false }
		);
	}
	return changes.length;
}

/** Everything the derived-data pass needs, and nothing else. */
const DERIVED_PROJECTION = {
	playedAt: 1,
	durationLoops: 1,
	gameLoops: 1,
	outcome: 1,
	settledOutcome: 1,
	mode: 1,
	settledMode: 1,
	'sightings.toon': 1,
	'sightings.name': 1,
	'sightings.clan': 1,
	'sightings.mos': 1,
	'sightings.winsByMode': 1,
	'sightings.gamesPlayed': 1,
	'sightings.leftLoop': 1
};

type DerivedDoc = Pick<
	ReplayDoc,
	| '_id'
	| 'playedAt'
	| 'durationLoops'
	| 'gameLoops'
	| 'outcome'
	| 'settledOutcome'
	| 'mode'
	| 'settledMode'
	| 'sightings'
>;

/**
 * Recompute the all-time per-class boards — top players, totals, last games —
 * and store them, one doc per class (see playtime.ts for what is counted).
 */
async function persistMosBoards(docs: DerivedDoc[]): Promise<number> {
	const boards = classBoardsByMos(
		docs.map((r) => ({
			file: r._id,
			playedAt: r.playedAt,
			durationLoops: r.durationLoops,
			gameLoops: r.gameLoops,
			outcome: replayOutcomeOf(r) ?? null,
			mode: replayModeOf(r) ?? null,
			sightings: r.sightings ?? []
		}))
	);
	const entries = Object.entries(boards);
	if (entries.length) {
		const d = await db();
		const at = new Date().toISOString();
		await d.collection('meta').bulkWrite(
			entries.map(([mos, board]) => ({
				replaceOne: {
					filter: { _id: mosBoardId(mos) },
					replacement: { ...board, at } satisfies MosBoardDoc,
					upsert: true
				}
			})) as never[],
			{ ordered: false }
		);
	}
	return entries.length;
}

/**
 * Recompute everything derived from the archive as a whole: each game's settled
 * outcome and mode, and the per-class playtime boards.
 *
 * All of them need every replay, for the same reason — a game's result and its
 * mode are both a vote across all its players, and the boards are all-time
 * totals — so they share a single narrow read rather than scanning three
 * times. Pass `docs` when the caller already holds them (the full rebuild
 * does) to skip the read entirely.
 */
export async function refreshDerived(
	docs?: DerivedDoc[],
	onlyToons?: string[]
): Promise<{ outcomes: number; modes: number; boards: number; mates: number }> {
	const rows =
		docs ??
		((await (await db())
			.collection<ReplayDoc>('replays')
			.find({}, { projection: DERIVED_PROJECTION })
			.toArray()) as DerivedDoc[]);
	const outcomes = await persistSettledOutcomes(rows);
	const modes = await persistSettledModes(rows);
	const boards = await persistMosBoards(rows);
	const mates = await persistTeammates(rows, onlyToons);
	return { outcomes, modes, boards, mates };
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
	const history = (p.history ?? []) as ({ file: string; mos: string[] } & CutEntry)[];
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
		latestFile: history.at(-1)?.file ?? null,
		/* The games recording a bank this profile went on to lose (see
		   $lib/progressionCuts.ts). Stored rather than derived in the sweep for
		   the reason every other field here is: the retention pass would
		   otherwise have to read every sighting's XP out of the whole archive on
		   every run, where this costs one array of file names per profile and
		   only 91 of them have anything in it at all. */
		restoreFiles: restorePins(history)
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
						gameLoops: 1,
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
					gameLoops: gameLoopsOf(r),
					outcome: r.outcome ?? null,
					mode: r.mode ?? null,
					modifiers: r.modifiers ?? [],
					modifiersRead: Boolean(r.modifiers),
					mapChecksum: r.mapChecksum ?? 0,
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
				gameLoops: gameLoopsOf(r),
				outcome: r.outcome ?? null,
				mode: r.mode ?? null,
				modifiers: r.modifiers ?? [],
				modifiersRead: Boolean(r.modifiers),
				mapChecksum: r.mapChecksum ?? 0,
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
 * Runs on a clock (see hooks.server.ts), not off an upload, because that is
 * the shape of the rule: a file stops being someone's backup when a *different*
 * player uploads a later game, so no single upload can be told "and now that
 * one is droppable" without re-deciding the archive. The upload path narrows
 * the same question to the file in front of it (`replayPinnedOnArrival`); this
 * is what catches everything the passage of time releases afterwards.
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

export function keepPerPlayer(): number {
	return Number(process.env.REPLAY_KEEP_PER_PLAYER ?? 1);
}

/**
 * All the retention rule actually reads: the id, the ordering key, the race
 * guard, and who played. A fraction of a full doc — a few hundred bytes a game
 * against the megabytes a whole archive of sightings would be — which is what
 * lets the sweep read the collection itself instead of waiting for a caller
 * that happens to be holding it.
 */
type RetentionDoc = Pick<ReplayDoc, '_id' | 'playedAt' | 'sha256' | 'blobPrunedAt'> & {
	sightings?: { toon: string }[];
};

async function retentionDocs(): Promise<RetentionDoc[]> {
	const d = await db();
	return (await d
		.collection<ReplayDoc>('replays')
		.find(
			{},
			{ projection: { _id: 1, playedAt: 1, sha256: 1, blobPrunedAt: 1, 'sightings.toon': 1 } }
		)
		.toArray()) as unknown as RetentionDoc[];
}

/**
 * Every file some profile needs kept as a restore point, from the `restoreFiles`
 * each rebuild writes (see `withDerived`).
 *
 * Asked of the profiles that have one rather than of the whole collection: the
 * overwhelming majority of players have never lost progression and carry an
 * empty array, and this runs on a cluster that charges by the byte returned.
 */
async function restorePinnedFiles(): Promise<Set<string>> {
	const d = await db();
	const rows = await d
		.collection('players')
		.find({ 'restoreFiles.0': { $exists: true } }, { projection: { restoreFiles: 1 } })
		.toArray();
	return new Set(rows.flatMap((r) => (r.restoreFiles ?? []) as string[]));
}

/**
 * @param docs the archive to decide over, when the caller already holds it.
 * Omitted, the sweep reads its own narrow projection — the case for a run on a
 * clock, which is the only one that can catch a blob released by *another*
 * player's upload.
 */
export async function sweepReplayBlobs(docs?: RetentionDoc[]): Promise<number> {
	if (!pruneEnabled() || !bucketConfigured() || sweepRunning) return 0;
	sweepRunning = true;
	try {
		const all = docs ?? (await retentionDocs());
		const restorePinned = await restorePinnedFiles();
		const files = prunableReplays(
			all.map((r) => ({
				file: r._id,
				playedAt: r.playedAt,
				toons: (r.sightings ?? []).map((s) => s.toon).filter(Boolean),
				blobPruned: Boolean(r.blobPrunedAt)
			})),
			keepPerPlayer(),
			restorePinned
		);
		if (!files.length) return 0;

		// sha at decision time — if it changed, an upload replaced this game
		// with a longer recording and the blob we meant to drop is not the
		// blob that is there now
		const shaAtDecision = new Map(all.map((r) => [r._id, r.sha256]));

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
					/* Asked again here, and not only when the set was built,
					   because this is the one pin that can appear *while* the
					   sweep runs: the upload that reveals a player's bank went
					   backwards rebuilds their profile inside this same lock,
					   and may have done so since. Cheap — an indexed existence
					   check against the ~91 profiles that carry any. */
					if (
						await d
							.collection('players')
							.findOne({ restoreFiles: file }, { projection: { _id: 1 } })
					)
						return 0;
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

/**
 * Whether an arriving replay has to be stored at all — the ingest-side half of
 * the retention rule (see lib/replayRetention.ts).
 *
 * One counted lookup per participant, capped at `keep` so it stops there
 * instead of counting a regular's whole history, and returning on the first
 * participant who is short. The ordinary upload is a game that has just
 * finished, so nobody has anything newer and the first lookup answers it; the
 * full set of lookups is only reached for a backfilled game, where it saves a
 * pointless multi-megabyte round trip to the bucket.
 *
 * Strictly newer only: `pinnedReplays` breaks `playedAt` ties by file name and
 * a count cannot see that. Two recordings stopping in the same millisecond is
 * not a thing that happens, and if it did this would keep the replay rather
 * than drop it — the harmless direction.
 */
export async function replayPinnedOnArrival(
	toons: string[],
	playedAt: string,
	keep = keepPerPlayer()
): Promise<boolean> {
	const d = await db();
	const col = d.collection<ReplayDoc>('replays');
	const counts: number[] = [];
	for (const toon of new Set(toons.filter(Boolean))) {
		counts.push(
			await col.countDocuments(
				{ 'sightings.toon': toon, playedAt: { $gt: playedAt } },
				{ limit: keep }
			)
		);
		if (pinnedOnArrival(counts, keep)) return true;
	}
	// only reached with a count for every participant, none of them short —
	// or, for a replay with no participants at all, with the empty list the
	// rule answers `true` to
	return pinnedOnArrival(counts, keep);
}
