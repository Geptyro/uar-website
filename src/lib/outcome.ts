/**
 * Win/loss per game.
 *
 * Two independent sources, because neither covers everything:
 *
 * 1. The replay itself (`parsed`, from the parser's end-of-game markers).
 *    Immediate, but only for a recording that saw the game end — a replay
 *    uploaded by someone who left early says nothing about the outcome.
 *
 * 2. The map's own win counter, which every player carries in their save
 *    file. It is snapshot at the start of every game, so the result of game
 *    N is the delta between the snapshots in game N and game N+1: the
 *    outcome of a game becomes readable once one of its players shows up in
 *    a later replay. Exact, but always one game behind.
 *
 * The counter only moves on a win, so a player who gained none voted loss —
 * with one asymmetry: a win is credited to the players still in the game at
 * the end, and in round-based modes to how many rounds each of them took. A
 * player who left, or took no round, gains nothing from a won game. So any
 * player gaining a win settles the game as won, and it takes every voter
 * agreeing to call it a loss.
 *
 * Note: `replay.details` cannot answer this. Its per-player m_result is
 * "undecided" for every UAR game — the map only reports a result to the
 * engine if a player clicks through the end screen, and the recording has
 * normally stopped by then.
 */

export type Outcome = 'win' | 'loss';

export interface OutcomeReplay {
	file: string;
	playedAt: string;
	/** What the parser read out of the replay file itself, if anything. */
	outcome?: Outcome | null;
	/** One entry per player profile in the game, as of game start. */
	sightings: { toon: string; wins: number; gamesPlayed: number }[];
}

/**
 * file -> outcome, for every game either source can settle. Files absent
 * from the result are games nobody has played a follow-up to yet (and whose
 * uploader left before the end).
 */
export function replayOutcomes(replays: OutcomeReplay[]): Record<string, Outcome> {
	// each player's sightings in game order
	const byToon = new Map<string, { file: string; playedAt: string; wins: number; gamesPlayed: number }[]>();
	for (const r of replays) {
		for (const s of r.sightings) {
			if (!s.toon) continue;
			const list = byToon.get(s.toon);
			const row = { file: r.file, playedAt: r.playedAt, wins: s.wins, gamesPlayed: s.gamesPlayed };
			if (list) list.push(row);
			else byToon.set(s.toon, [row]);
		}
	}

	const votes = new Map<string, { win: number; loss: number }>();
	for (const list of byToon.values()) {
		list.sort((a, b) => (a.playedAt < b.playedAt ? -1 : a.playedAt > b.playedAt ? 1 : 0));
		for (let i = 0; i < list.length - 1; i++) {
			const cur = list[i];
			const next = list[i + 1];
			// exactly one game apart, or the delta covers games we never saw
			// (and a negative delta means the save file was reset in between)
			if (next.gamesPlayed - cur.gamesPlayed !== 1) continue;
			const v = votes.get(cur.file) ?? { win: 0, loss: 0 };
			if (next.wins > cur.wins) v.win++;
			else v.loss++;
			votes.set(cur.file, v);
		}
	}

	const out: Record<string, Outcome> = {};
	for (const r of replays) {
		const v = votes.get(r.file);
		if (r.outcome === 'win' || (v && v.win > 0)) out[r.file] = 'win';
		else if (v) out[r.file] = 'loss';
		else if (r.outcome) out[r.file] = r.outcome;
	}
	return out;
}

/**
 * Which stored games' recorded outcome no longer matches what the counters
 * say, as the write list a rebuild should apply. `outcome: undefined` means
 * the game is no longer settleable and its stored verdict should be dropped.
 *
 * Split out from the write itself so it can be tested without a database, and
 * so a rebuild that settles nothing new writes nothing: a new game only
 * settles the previous game of each of its players, not the whole archive.
 */
export function outcomeChanges(
	replays: (OutcomeReplay & { settledOutcome?: Outcome })[]
): { file: string; outcome?: Outcome }[] {
	const settled = replayOutcomes(replays);
	return replays
		.filter((r) => settled[r.file] !== r.settledOutcome)
		.map((r) => ({ file: r.file, ...(settled[r.file] ? { outcome: settled[r.file] } : {}) }));
}

/** Recording length as m:ss / h:mm:ss. */
export function fmtDuration(loops: number): string {
	const total = Math.round(loops / 16);
	const s = total % 60;
	const m = Math.floor(total / 60) % 60;
	const h = Math.floor(total / 3600);
	return h
		? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
		: `${m}:${String(s).padStart(2, '0')}`;
}
