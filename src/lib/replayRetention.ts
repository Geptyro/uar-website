/**
 * Which replay blobs must stay in the bucket.
 *
 * The blob is a backup: a player who loses their UAR bank can download their
 * most recent replay and recover their progression from it. So a blob is kept
 * while it is *some* participant's latest recorded game, and may be dropped
 * once every player in it has a more recent replay of their own. The Mongo doc
 * (lobbyId, sha256, sightings) is never deleted — only the bytes go.
 *
 * The rule is monotonic: ingesting an older replay never un-prunes anything,
 * and ingesting a newer one only ever releases older blobs. "Nobody's latest"
 * can therefore never revert to false, which is why the pass is safe to run
 * incrementally and why a blob can wait for the next daily sweep with no risk.
 *
 * Dependency-free on purpose (CLAUDE.md) so node:test can load it directly.
 */

export interface RetentionReplay {
	/** Replay doc _id — the file name, which is also the bucket key suffix. */
	file: string;
	/** Game start, ISO UTC. Ordering key: "latest" means greatest playedAt. */
	playedAt: string;
	/** Toon handles seen in the replay (duplicates are tolerated). */
	toons: string[];
	/** Whether the blob is still in the bucket. Pruned ones stay pinned-or-not
	 * by the same rule; they just have nothing left to delete. */
	blobPruned?: boolean;
}

/**
 * Files that must keep their blob: for every player, their `keepPerPlayer`
 * most recent replays.
 *
 * Ties on playedAt are broken by file name so the result never depends on
 * the input order — two replays of the same minute (distinct lobbies, hence
 * the `-<lobbyId>` suffix) would otherwise pin nondeterministically.
 */
export function pinnedReplays(replays: RetentionReplay[], keepPerPlayer = 1): Set<string> {
	if (keepPerPlayer < 1) throw new RangeError('keepPerPlayer must be at least 1');
	const newestFirst = [...replays].sort(
		(a, b) => b.playedAt.localeCompare(a.playedAt) || b.file.localeCompare(a.file)
	);
	const kept = new Map<string, number>();
	const pinned = new Set<string>();
	for (const replay of newestFirst) {
		for (const toon of new Set(replay.toons)) {
			const n = kept.get(toon) ?? 0;
			if (n >= keepPerPlayer) continue;
			kept.set(toon, n + 1);
			pinned.add(replay.file);
		}
	}
	return pinned;
}

/**
 * Files whose blob can be deleted now: not pinned, and still holding bytes.
 *
 * A replay with no parsed sightings pins nothing and would be deleted on the
 * first pass — but it is also the case we understand least (truncated
 * recording, or a bank the decoder could not read), so it is kept instead.
 * Those are the replays most likely to be worth re-parsing later, and once the
 * bytes are gone no future parser fix can reach them.
 */
export function prunableReplays(replays: RetentionReplay[], keepPerPlayer = 1): string[] {
	const pinned = pinnedReplays(replays, keepPerPlayer);
	return replays
		.filter((r) => !pinned.has(r.file) && !r.blobPruned && r.toons.length > 0)
		.map((r) => r.file)
		.sort();
}
