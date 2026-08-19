/**
 * When a game actually ended, and when it actually started.
 *
 * A recording is not the same length as the game it recorded. SC2 keeps
 * counting game loops for as long as the client sits in the map, and the map
 * does not end the game for you: every ending routes into `gf_EndDisplay`,
 * which puts up a "you won / you lost" screen with a single exit button, and
 * only clicking it calls `GameOver` for that player. A player who alt-tabs
 * away instead keeps recording — one archived game reads 9h06m on a recording
 * whose fight ended at 1h17m48s, with the map still spawning waves into an
 * empty room for the remaining seven and three quarter hours.
 *
 * Unit activity therefore says nothing about the end. What does:
 *
 * - the map's own end-of-game markers, already read for the outcome
 *   (`extract.ts`): the win cinematic's prop, or every hero replaced by a
 *   dead-hero indicator. Present in most modes, absent in a few — the Zulu,
 *   Specimen and Jashan-dies endings spawn no distinctive prop at all.
 * - the exit button being clicked, which is a dialog event in game.events.
 *   `gf_EndDisplay` is the only place that button is built, and every one of
 *   its eight callers is a game-over path, so a click on it is proof the map
 *   had already declared the game over. `gv_exit_clicked` blocks repeats, so
 *   the burst is one click per player on one control id. The one ending that
 *   skips the dialog is Competitive, whose `gf_NextRound` force-ends every
 *   client with `GameOver` — a mode that cannot idle in the first place.
 * - players being put out of the game, which the tracker stream gives away
 *   for free: a player's `SPlayerStatsEvent` ticks every ten game-seconds
 *   until the map calls `GameOver` for them, and clicking the exit button is
 *   what does that. Note the wording: a player who *quits* mid-game keeps
 *   ticking until the game ends — SC2 goes on emitting stats for a slot whose
 *   user has gone (measured over 27 of 27 mid-game leavers in the archive) —
 *   so this signal dates endings, never departures. Where a player left is a
 *   different event in a different stream: `SGameUserLeaveEvent` in
 *   game.events, which is what `leftLoop` on a sighting records and
 *   `playedLoops` below credits.
 *
 * The last of those is the cheap one — it comes out of a stream `parseReplay`
 * already decodes in full — so the reader leans on it for the ending and uses
 * the game.events scan only when there is a marker-less split to explain.
 *
 * Dependency-free (pattern: xp.ts) so node:test can load it directly.
 */

/** Game loops per game-second, and per wall-clock second: SC2 records these
 * unscaled (`m_useScaledTime` is false), measured at 16.0–16.3 loops per real
 * second against the companion's own in-game windows. */
export const LOOPS_PER_SECOND = 16;

/**
 * How long a recording may run past the end evidence before the rest counts
 * as idle. Generous on purpose: the ending cinematic plus the score screen
 * legitimately runs on after the marker — 0–222s across the sample archive —
 * and a game that stops inside this window is left at its recorded length, so
 * every ordinary game keeps the duration it has always had.
 */
const IDLE_GRACE_LOOPS = LOOPS_PER_SECOND * 240;

/**
 * How long before the recording's end a player's stats must stop for them to
 * count as having left rather than as having been there at the finish. Stats
 * tick every ten game-seconds, and the whole lobby's last tick spreads over a
 * few seconds, so this only has to clear that jitter.
 */
const DEPARTED_LOOPS = LOOPS_PER_SECOND * 60;

/** How far apart the exit clicks of one ending may fall. Players read the
 * end screen at their own pace; two minutes covers the observed spread. */
const BURST_LOOPS = LOOPS_PER_SECOND * 120;

/** How soon after clicking exit a player's stats must stop. The click calls
 * `GameOver` for them, so this is a round trip, not a wait. */
const LEAVE_LOOPS = LOOPS_PER_SECOND * 30;

/** A dialog-button click from game.events. */
export interface DialogClick {
	/** `_userid.m_userId` — the lobby slot that clicked. */
	user: number;
	/** `m_controlId`. Ids are per-game: the map builds its dialogs as it goes. */
	control: number;
	loop: number;
}

/** The last loop a human slot was still receiving player stats. */
export interface PlayerEnd {
	user: number;
	lastLoop: number;
}

/**
 * The players whose stats stopped well before the recording did — the ones
 * who left while this recording kept going.
 */
export function departedEarly(players: PlayerEnd[], recordingLoops: number): PlayerEnd[] {
	return players.filter((p) => p.lastLoop < recordingLoops - DEPARTED_LOOPS);
}

/**
 * Whether it is worth decoding all of game.events to look for the exit
 * dialog. Only when there is something the cheap signals cannot explain: most
 * of the lobby gone, this recording still running, and no marker to date the
 * ending by. With a marker in hand the dialog would only refine an answer we
 * already have, which is not worth a second of CPU per upload.
 */
export function needsExitScan(
	players: PlayerEnd[],
	recordingLoops: number,
	markerLoop: number | null
): boolean {
	if (markerLoop !== null) return false;
	const departed = departedEarly(players, recordingLoops);
	return departed.length >= 2 && departed.length > players.length - departed.length;
}

/**
 * The loop the lobby clicked through the end screen, or null if no burst in
 * these clicks looks like one.
 *
 * A qualifying burst is one control id, clicked at most once each by two or
 * more players inside `BURST_LOOPS`, every one of whom stops receiving stats
 * right after clicking. Ordinary in-game dialog traffic fails all three
 * clauses at once — the shop and skill dialogs are clicked repeatedly, across
 * many control ids, by players who go on playing. The latest qualifying burst
 * wins, so a mid-game coincidence cannot outrank the real ending.
 */
export function exitDialogLoop(clicks: DialogClick[], players: PlayerEnd[]): number | null {
	const lastLoopOf = new Map(players.map((p) => [p.user, p.lastLoop]));
	const byControl = new Map<number, DialogClick[]>();
	for (const c of clicks) {
		const list = byControl.get(c.control);
		if (list) list.push(c);
		else byControl.set(c.control, [c]);
	}

	let best: number | null = null;
	for (const list of byControl.values()) {
		const firstClick = new Map<number, number>();
		let repeated = false;
		for (const c of list) {
			if (firstClick.has(c.user)) repeated = true;
			else firstClick.set(c.user, c.loop);
		}
		if (repeated || firstClick.size < 2) continue;
		const loops = [...firstClick.values()].sort((a, b) => a - b);
		if (loops[loops.length - 1] - loops[0] > BURST_LOOPS) continue;
		const allLeft = [...firstClick].every(([user, loop]) => {
			const last = lastLoopOf.get(user);
			return last !== undefined && last <= loop + LEAVE_LOOPS;
		});
		if (!allLeft) continue;
		const end = loops[loops.length - 1];
		if (best === null || end > best) best = end;
	}
	return best;
}

export interface EndEvidence {
	/** `m_elapsedGameLoops` — how long the client kept recording. */
	recordingLoops: number;
	/** The map's own game-over marker: win prop, or the completed hero wipe. */
	markerLoop: number | null;
	/** The exit-dialog burst, when game.events was scanned for one. */
	exitLoop?: number | null;
	/** Last stats loop per human slot. */
	players: PlayerEnd[];
}

/**
 * How many loops the game itself lasted.
 *
 * The end is the latest thing that can be shown to have happened at the
 * ending: the marker, the exit clicks, and the moment the departing players
 * actually went — a player is credited up to the point they left, not up to
 * the point the map first declared the result, since the score screen is part
 * of the game. Recordings that stop inside `IDLE_GRACE_LOOPS` of that are
 * returned unchanged, so this only ever trims a real idle tail.
 */
export function gameEndLoop(ev: EndEvidence): number {
	const evidence: number[] = [];
	if (ev.markerLoop !== null) evidence.push(ev.markerLoop);
	if (ev.exitLoop !== null && ev.exitLoop !== undefined) evidence.push(ev.exitLoop);
	if (!evidence.length) return ev.recordingLoops;

	for (const p of departedEarly(ev.players, ev.recordingLoops)) evidence.push(p.lastLoop);
	const end = Math.min(ev.recordingLoops, Math.max(...evidence));
	return ev.recordingLoops - end <= IDLE_GRACE_LOOPS ? ev.recordingLoops : end;
}

/**
 * How many loops of a game one player was actually in it for.
 *
 * `leftLoop` is the loop of that player's `SGameUserLeaveEvent`, when the
 * recording saw one; players still in when the recording stopped have none
 * and are credited the game's length. Clamped to the game's length because a
 * player who sat in a finished map before leaving did not play the idle tail
 * any more than the recorder did (see `gameEndLoop`).
 *
 * This is what every playtime figure credits — a profile's total, the
 * per-class boards, the teammate lists. Whole-game crediting was measured
 * at 7% phantom time across long twelve-player games, concentrated on the
 * few who left at minute two and were written down for ninety.
 */
export function playedLoops(gameLoops: number, leftLoop?: number | null): number {
	if (leftLoop === undefined || leftLoop === null) return gameLoops;
	return Math.max(0, Math.min(leftLoop, gameLoops));
}

/**
 * A game's UTC start, from the recording's end and its length.
 *
 * `playedAt` is the replay's `m_timeUTC`, which SC2 stamps when it writes the
 * file — that is, when the recording stopped, not when the game began. It
 * matches the file's mtime to the second across the archive, and the
 * companion's own `sc2: menus` transition lands within a minute of it. Its
 * name and the field's history both say "start", so every read path that
 * wants one derives it here.
 *
 * `recordingLoops`, not the game's length: the recording began when the game
 * did, whatever the client did afterwards. Falls back to `playedAt` when
 * there is no length stored to walk back (a pruned pre-duration doc).
 */
export function startedAtOf(playedAt: string, recordingLoops?: number): string {
	if (!recordingLoops) return playedAt;
	const end = Date.parse(playedAt);
	if (Number.isNaN(end)) return playedAt;
	const started = new Date(end - (recordingLoops / LOOPS_PER_SECOND) * 1000);
	// the fixed-width shape the ingest writes, so range queries stay lexical
	return started.toISOString().slice(0, 19) + 'Z';
}
