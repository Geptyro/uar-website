/**
 * Which of the map's twelve game modes a game was played on.
 *
 * The mode is not a field of the replay: SC2 records the lobby, and UAR picks
 * its mode after the lobby, from inside the game. So it has to be reconstructed
 * — from two independent sources, the same shape as lib/outcome.ts:
 *
 * 1. The vote (`parsed`, from the parser). Every player clicks a mode button
 *    in the map's twenty-second opening vote, those clicks are synced game
 *    events, and `tallyModeVotes` re-runs the map's own count over them.
 *    Immediate and exact — but only for a recording that lasted past the
 *    vote, and it cannot resolve the map's random tie-break.
 *
 * 2. The map's per-mode win counters, which every player carries in their save
 *    file. Snapshot at the start of every game, so a game won on mode k shows
 *    up as +1 on slot k of the next snapshot: the mode of a won game becomes
 *    readable once one of its players shows up in a later replay. Exact, but
 *    silent about lost games — the counters only move on a win.
 *
 * Neither source outranks the other outright. The vote is the wider one — it
 * covers losses, and it is the whole lobby agreeing in the moment. The
 * counters need no assumption about the map's dialog controls, but a reading
 * backed by a single player is not evidence (see `counterModes`), so it is
 * corroborated counters that win, and a lone one that yields.
 */

/** Modes are numbered 1..12, aligned with `modeNames` / `winsByMode`. */
export const MODE_COUNT = 12;

/** Career XP a player needs before the map accepts their vote for a mode. */
const MODE_MIN_XP: Record<number, number> = { 3: 20000, 4: 40000, 5: 60000, 12: 200000 };

/** Competitive is only offered to a lobby of at least this many players. */
const COMPETITIVE_MIN_PLAYERS = 4;
const COMPETITIVE = 6;

export interface ModeVoter {
	/** Career XP (enlisted + warrant + commissioned) as of game start. */
	xp: number;
	prestige: number;
	/**
	 * Every mode button this player clicked, in the order they clicked them.
	 *
	 * Not one vote but a sequence, because the map refuses a click for a mode
	 * the player has not unlocked and simply returns — their vote stays unset,
	 * the buttons stay live, and they click again. Reading only the first click
	 * loses the vote that actually counted, and reads the lobby as keener than
	 * it was.
	 */
	clicks: number[];
}

/**
 * The mode the map would have started, given who voted for what — a
 * transcription of gt_ModeSelect_Func (which clicks it refuses) and
 * gt_SetMode_Func (how it counts them) in MapScript.galaxy.
 *
 * Null when the map's own answer was a coin toss: with most votes on the
 * special modes and no single leader among them, it picks at random between
 * the tied ones, and no amount of replay reading can recover which.
 */
export function tallyModeVotes(voters: ModeVoter[], playerCount: number): number | null {
	// gt_ModeSelect_Func rejects a click for a mode the player has not unlocked
	// without recording anything, so what counts is the first click it accepts
	// — and a player whose every click was refused counts as not having voted
	const votes = voters
		.map((v) => v.clicks.find((mode) => voteAccepted(mode, v, playerCount)))
		.filter((mode): mode is number => mode !== undefined);

	const counted: number[] = Array(MODE_COUNT + 1).fill(0);
	for (const m of votes) counted[m] += 1;
	const total = votes.length;
	// Galaxy integer division: an outright majority is *more* than half
	const half = Math.floor(total / 2);

	for (let m = 1; m <= MODE_COUNT; m++) {
		if (total > 0 && counted[m] > half) return m;
	}

	// Fewer than half the votes on the regular difficulties (1..5): the map
	// reads the lobby as wanting a special mode and takes the most-voted one.
	const regular = votes.filter((m) => m >= 1 && m <= 5);
	if (total > 0 && regular.length < half) {
		const picked = specialModeWinner(counted);
		if (picked === null) return null; // the map tossed a coin
		if (picked !== 0) return picked;
	}

	// "Smart selection": the average of the regular votes, each worth its own
	// number × 100, rounded down to the difficulty band it lands in.
	if (regular.length > 0) {
		const average = Math.floor(regular.reduce((a, m) => a + m * 100, 0) / regular.length);
		if (average < 150) return 1;
		if (average < 250) return 2;
		if (average < 350) return 3;
		if (average < 450) return 4;
		if (average < 550) return 5;
	}

	return 2; // nobody voted — the map falls back to Normal
}

/** Whether the map would record this click at all (gt_ModeSelect_Func). */
function voteAccepted(mode: number, v: ModeVoter, playerCount: number): boolean {
	if (mode < 1 || mode > MODE_COUNT) return false;
	if (mode === COMPETITIVE && playerCount < COMPETITIVE_MIN_PLAYERS) return false;
	if (mode === 12 && v.prestige > 0) return true; // prestige unlocks Apocalypse outright
	return v.xp >= (MODE_MIN_XP[mode] ?? 0);
}

/**
 * The special-mode branch of gt_SetMode_Func: walk 7..12 against mode 6's
 * count, then draw at random between everything tied at the top.
 *
 * Returns the mode when the draw could only have gone one way, 0 when it
 * leaves the map with no mode at all (the branch falls through to the regular
 * average), and null when more than one result was reachable — a coin toss no
 * reading of the file can undo. The map's own quirk that a clear win for
 * Competitive itself is never assigned is reproduced, not corrected: what we
 * want is the mode the players got, not the one they voted for.
 */
function specialModeWinner(counted: number[]): number | null {
	let max = counted[COMPETITIVE];
	let leader = 0;
	let exAequo = 0;
	for (let m = 7; m <= MODE_COUNT; m++) {
		if (counted[m] > max) {
			max = counted[m];
			leader = m;
			exAequo = 1;
		}
		if (counted[m] === max) exAequo += 1;
	}
	if (exAequo <= 1) return leader;

	// the draw walks 6..12 and stops on the n-th mode holding `max`, n drawn
	// from 1..exAequo — so the reachable results are the first `exAequo` of
	// them, plus whatever `leader` already held for a draw that walks off the
	// end without landing
	const tied: number[] = [];
	for (let m = COMPETITIVE; m <= MODE_COUNT; m++) if (counted[m] === max) tied.push(m);
	const reachable = new Set(tied.slice(0, exAequo));
	if (tied.length < exAequo) reachable.add(leader);
	return reachable.size === 1 ? [...reachable][0] : null;
}

/** One replay, as much of it as settling modes needs. */
export interface ModeReplay {
	file: string;
	playedAt: string;
	/** What the parser counted out of the vote in the file itself, if anything. */
	mode?: number | null;
	/** One entry per player profile in the game, as of game start. */
	sightings: { toon: string; winsByMode: number[]; gamesPlayed: number }[];
}

/**
 * What the win counters alone say about each game, and how many of its players
 * say it.
 *
 * The support matters, because a single player's delta is not evidence. The
 * counters only move for someone who was still in the game at the end, and a
 * player who *left* gains nothing from it — so their next snapshot is one game
 * later than this one only if they went and played something else in between.
 * Their counter then moves for that other game, and lands here.
 *
 * Observed, not theorised. Graded against the vote across the whole archive,
 * every single-player reading that disagreed was one leaver's stray delta
 * outvoting nine to eleven concurring ballots; readings two or more players
 * agree on matched the vote 170 times out of 171. Corroboration is what tells
 * the two apart — teammates who finish a game together all move the same
 * counter, and a leaver's next game is nobody else's.
 */
export function counterModes(
	replays: ModeReplay[]
): Record<string, { mode: number; support: number }> {
	// each player's sightings in game order
	const byToon = new Map<
		string,
		{ file: string; playedAt: string; winsByMode: number[]; gamesPlayed: number }[]
	>();
	for (const r of replays) {
		for (const s of r.sightings) {
			if (!s.toon) continue;
			const row = {
				file: r.file,
				playedAt: r.playedAt,
				winsByMode: s.winsByMode ?? [],
				gamesPlayed: s.gamesPlayed
			};
			const list = byToon.get(s.toon);
			if (list) list.push(row);
			else byToon.set(s.toon, [row]);
		}
	}

	const votes = new Map<string, Map<number, number>>();
	for (const list of byToon.values()) {
		list.sort((a, b) => (a.playedAt < b.playedAt ? -1 : a.playedAt > b.playedAt ? 1 : 0));
		for (let i = 0; i < list.length - 1; i++) {
			const cur = list[i];
			const next = list[i + 1];
			// One game apart — necessary, but not sufficient, and this is exactly
			// where a lone reading goes wrong: the counter does not move for a
			// player who left, so "one game later" can mean one game *elsewhere*.
			// Only agreement between players rules that out (see below).
			if (next.gamesPlayed - cur.gamesPlayed !== 1) continue;
			const moved = movedSlots(cur.winsByMode, next.winsByMode);
			// a game is played on one mode: two counters moving means the save
			// file was edited or reset, and says nothing trustworthy
			if (moved.length !== 1) continue;
			const tally = votes.get(cur.file) ?? new Map<number, number>();
			tally.set(moved[0], (tally.get(moved[0]) ?? 0) + 1);
			votes.set(cur.file, tally);
		}
	}

	const out: Record<string, { mode: number; support: number }> = {};
	for (const [file, tally] of votes) {
		// teammates who finished the same game all moved the same counter, so
		// the plurality is the reading and its size is how much to trust it;
		// lowest mode first so a tie does not depend on map iteration order
		const [mode, support] = [...tally].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
		out[file] = { mode, support };
	}
	return out;
}

/** Counter readings backed by more than one player — safe to treat as fact. */
const CORROBORATED = 2;

/**
 * file -> mode, merging both sources. Files absent from the result are games
 * neither could settle: lost, and with no readable vote.
 *
 * Corroborated counters outrank the vote, because they are the map's own
 * bookkeeping and need no assumption about where its dialog controls are
 * numbered. A lone counter reading does not: against a vote it loses, and it
 * only stands where there is no vote to prefer.
 */
export function replayModes(replays: ModeReplay[]): Record<string, number> {
	const counters = counterModes(replays);
	const out: Record<string, number> = {};
	for (const r of replays) {
		const c = counters[r.file];
		if (c && (c.support >= CORROBORATED || !r.mode)) out[r.file] = c.mode;
		else if (r.mode) out[r.file] = r.mode;
	}
	return out;
}

/**
 * Mode slots (1-based) whose win counter grew between two snapshots.
 *
 * Bounded at twelve: the bank string is whitespace-separated and a stray
 * trailing field would otherwise read as a thirteenth mode that does not
 * exist.
 */
function movedSlots(before: number[], after: number[]): number[] {
	const slots: number[] = [];
	for (let i = 0; i < Math.min(MODE_COUNT, Math.max(before.length, after.length)); i++) {
		if ((after[i] ?? 0) > (before[i] ?? 0)) slots.push(i + 1);
	}
	return slots;
}

/**
 * Which stored games' recorded mode no longer matches what the counters say,
 * as the write list a rebuild should apply. `mode: undefined` means the game
 * is no longer settleable and its stored answer should be dropped.
 *
 * Split out from the write itself so it can be tested without a database, and
 * so a rebuild that settles nothing new writes nothing (see outcomeChanges).
 */
export function modeChanges(
	replays: (ModeReplay & { settledMode?: number })[]
): { file: string; mode?: number }[] {
	const settled = replayModes(replays);
	return replays
		.filter((r) => settled[r.file] !== r.settledMode)
		.map((r) => ({ file: r.file, ...(settled[r.file] ? { mode: settled[r.file] } : {}) }));
}
