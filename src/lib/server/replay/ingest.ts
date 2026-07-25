/**
 * Pure ingest decision logic — what to do with an uploaded replay given
 * what's already stored. Kept free of HTTP/Mongo so it's unit-testable.
 *
 * Identity is the lobby id (same in every participant's recording of a
 * game). A longer recording of a known game replaces the stored one; equal
 * or shorter is a duplicate. New games get a game-time file name, with a
 * lobby-id suffix if a different game already took that minute.
 */

export interface PeekedIdentity {
	playedAt: string;
	lobbyId: number;
	durationLoops: number;
}

export type IngestDecision =
	| { kind: 'duplicate' }
	| { kind: 'insert'; name: string }
	| { kind: 'replace'; name: string };

/** YYYYMMDD-HHMM.SC2Replay from the game's UTC start time. */
export function canonicalName(playedAt: string, lobbyId?: number): string {
	const stamp = playedAt.replace(/[-:]/g, '').slice(0, 13).replace('T', '-');
	return lobbyId === undefined ? `${stamp}.SC2Replay` : `${stamp}-${lobbyId}.SC2Replay`;
}

export function decideIngest(
	peeked: PeekedIdentity,
	existingSameLobby: { _id: string; durationLoops: number } | null,
	canonicalNameTaken: boolean
): IngestDecision {
	if (existingSameLobby) {
		if (peeked.durationLoops <= existingSameLobby.durationLoops) return { kind: 'duplicate' };
		return { kind: 'replace', name: existingSameLobby._id };
	}
	return {
		kind: 'insert',
		name: canonicalNameTaken
			? canonicalName(peeked.playedAt, peeked.lobbyId)
			: canonicalName(peeked.playedAt)
	};
}
