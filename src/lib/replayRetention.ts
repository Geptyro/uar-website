/**
 * Which replay blobs must stay in the bucket.
 *
 * The blob is a backup: a player who loses their UAR bank can download their
 * most recent replay and recover their progression from it. So a blob is kept
 * while it is *some* participant's latest recorded game, and may be dropped
 * once every player in it has a more recent replay of their own. The Mongo doc
 * (lobbyId, sha256, sightings) is never deleted — only the bytes go.
 *
 * That rule alone throws away the backups that matter most. A player who lost
 * their save file goes on playing from a fresh bank, and those games are newer
 * than the one worth keeping — so the last recording of the progression they
 * lost is released the moment the rest of that lobby has moved on too. Hence
 * the second source of pins, `alwaysKeep`: the files named by
 * $lib/progressionCuts.ts as sitting immediately before a backwards step, which
 * retention holds regardless of how many newer games their players have.
 *
 * The "latest" half is monotonic: ingesting an older replay never un-prunes
 * anything, and ingesting a newer one only ever releases older blobs.
 * "Nobody's latest" can therefore never revert to false, which is why the pass
 * is safe to run incrementally and why a blob can wait for the next daily sweep
 * with no risk.
 *
 * `alwaysKeep` is deliberately *not* monotonic and cannot be made so: a cut
 * only becomes visible when the player uploads the game that shows the
 * diminished bank, which can be months after the pre-cut replay stopped being
 * anybody's latest. A file can therefore be released, pruned, and only then
 * named as a restore point — at which point the bytes are already gone and the
 * pin has nothing left to hold. Nothing here can recover those; the pin exists
 * so it stops happening from now on, and the sweep re-checks the set under its
 * lock (see `sweepReplayBlobs`) so a cut landing mid-sweep still wins.
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
 * most recent replays, plus every file in `alwaysKeep` that the archive still
 * has a document for.
 *
 * Ties on playedAt are broken by file name so the result never depends on
 * the input order — two replays of the same minute (distinct lobbies, hence
 * the `-<lobbyId>` suffix) would otherwise pin nondeterministically.
 *
 * `alwaysKeep` is intersected with `replays` rather than added blind, so the
 * returned set keeps its meaning: files this archive holds and must not delete.
 * A restore point naming a game that has since been pruned is expected — see
 * the note on monotonicity above — and simply has nothing to pin.
 */
export function pinnedReplays(
	replays: RetentionReplay[],
	keepPerPlayer = 1,
	alwaysKeep: Iterable<string> = []
): Set<string> {
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
	const known = new Set(replays.map((r) => r.file));
	for (const file of alwaysKeep) if (known.has(file)) pinned.add(file);
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
export function prunableReplays(
	replays: RetentionReplay[],
	keepPerPlayer = 1,
	alwaysKeep: Iterable<string> = []
): string[] {
	const pinned = pinnedReplays(replays, keepPerPlayer, alwaysKeep);
	return replays
		.filter((r) => !pinned.has(r.file) && !r.blobPruned && r.toons.length > 0)
		.map((r) => r.file)
		.sort();
}

/**
 * Whether a replay arriving now has to keep its bytes at all.
 *
 * The same rule as `pinnedReplays`, asked from the other end: rather than rank
 * the archive newest-first and hand out `keepPerPlayer` pins per player, take
 * one replay and how many newer replays each of its participants already has.
 * A single participant short of their quota pins it — a player whose latest
 * game this still is has to be able to recover their bank from it.
 *
 * `newerPerToon` is one count per distinct participant, and each may be capped
 * at `keepPerPlayer` since nothing above that changes the answer. An empty list
 * is the no-sightings replay, kept for the reason `prunableReplays` gives.
 */
export function pinnedOnArrival(newerPerToon: number[], keepPerPlayer = 1): boolean {
	if (keepPerPlayer < 1) throw new RangeError('keepPerPlayer must be at least 1');
	return newerPerToon.length === 0 || newerPerToon.some((n) => n < keepPerPlayer);
}
