/**
 * Reading the opening modifier vote out of a replay.
 *
 * The vote is a dialog of thirteen checkboxes plus two buttons — confirm, and
 * "no modifiers". Ticking a box is a synced game event carrying the new state,
 * and gt_ModifiersSelect_Func reads each player's boxes at the moment they
 * confirm, so a ballot is "whatever this player had ticked when they clicked".
 * Players do tick and untick before committing, which is why state is tracked
 * rather than the first tick taken.
 *
 * The one thing that is not fixed is where the dialog landed in the control-id
 * counter: it is built after the mode vote and the run has been seen at 834
 * through 840 across the archive. So it is derived per replay instead of
 * hardcoded — see `deriveBase`. That makes this reader immune to the map
 * shifting its dialogs, which the mode reader's fixed base is not.
 */

/** Checkbox creation order -> gv_modifiervote index (gt_IniModifiersDialog_Func). */
const BOX_ORDER = [13, 1, 3, 4, 2, 10, 11, 6, 12, 5, 7, 8, 9];
/** Each checkbox creates three controls: the box, its vote count, its label. */
const BOX_STRIDE = 3;
/** Offsets of the two buttons from the first checkbox, in creation order. */
const CONFIRM_OFF = 40;
const NO_MODS_OFF = 43;
const SPAN = BOX_STRIDE * (BOX_ORDER.length - 1);
/** m_eventType: 0 = a button was clicked, 1 = a checkbox changed. */
const CLICKED = 0;
const CHECKED = 1;

/** Modifiers the map only offers as sub-options of training mode. */
const TRAINING_ONLY = [6, 7, 8, 9];
const TRAINING = 5;
const ONE_LIFE = 4;
const ONE_LIFE_MIN_PLAYERS = 3;

export interface ModifierEvent {
	user: number;
	control: number;
	type: number;
	checked?: boolean;
}

/**
 * Where this game's modifier dialog starts in the control-id counter, or null
 * when it cannot be placed.
 *
 * The checkboxes sit at base + 3k for k in 0..12 and the confirm button 40
 * past the base, so every clicked control is a candidate. Alignment alone is
 * not enough to choose between them: a lobby that unanimously ticks one box —
 * which is most of them, Outbreak being near-universal — leaves a single
 * checkbox that fits the confirm button *and* the "no modifiers" button three
 * along, and picking the wrong one shifts every id by a slot.
 *
 * What separates them is who clicked what. A player who ticks a box goes on to
 * confirm it; they have no reason to tick and then press "no modifiers". So
 * the real confirm button is the one the tickers themselves pressed — scored
 * by how many of them did, not demanded of all, because a player can tick a
 * box and then let the timer run out without ever committing.
 */
export function deriveBase(events: ModifierEvent[]): number | null {
	const tickers = new Map<number, Set<number>>(); // control -> users who ticked it
	const clickers = new Map<number, Set<number>>(); // control -> users who clicked it
	for (const e of events) {
		const into = e.type === CHECKED ? tickers : e.type === CLICKED ? clickers : null;
		if (!into) continue;
		if (!into.has(e.control)) into.set(e.control, new Set());
		into.get(e.control)!.add(e.user);
	}

	let best: { base: number; support: number; aligned: number; voters: number } | null = null;
	for (const [c, clicked] of clickers) {
		const base = c - CONFIRM_OFF;
		let aligned = 0;
		const confirmed = new Set<number>();
		for (const [b, who] of tickers) {
			const d = b - base;
			if (d < 0 || d > SPAN || d % BOX_STRIDE !== 0) continue;
			aligned++;
			for (const u of who) if (clicked.has(u)) confirmed.add(u);
		}
		// a button no ticker ever pressed is the neighbouring one, not this
		if (!aligned || !confirmed.size) continue;
		const cand = { base, support: confirmed.size, aligned, voters: clicked.size };
		if (
			!best ||
			cand.support > best.support ||
			(cand.support === best.support &&
				(cand.aligned > best.aligned ||
					(cand.aligned === best.aligned && cand.voters > best.voters)))
		) {
			best = cand;
		}
	}
	return best?.base ?? null;
}

/**
 * The modifiers the map would have switched on, from the ballots cast.
 *
 * A transcription of gt_ModifiersSelect_Func (what each ballot is allowed to
 * say) and gt_IniModifiers (how they are counted and which exclude which).
 */
export function tallyModifiers(
	events: ModifierEvent[],
	playerCount: number,
	mode: number | null
): number[] {
	const base = deriveBase(events);
	if (base === null) return [];

	const boxToId = new Map(BOX_ORDER.map((id, i) => [base + i * BOX_STRIDE, id]));
	const confirm = base + CONFIRM_OFF;
	const noMods = base + NO_MODS_OFF;

	const ticked = new Map<number, Set<number>>();
	const ballots: Set<number>[] = [];
	const voted = new Set<number>();
	for (const e of events) {
		if (e.type === CHECKED) {
			const id = boxToId.get(e.control);
			if (id === undefined) continue;
			if (!ticked.has(e.user)) ticked.set(e.user, new Set());
			if (e.checked) ticked.get(e.user)!.add(id);
			else ticked.get(e.user)!.delete(id);
		} else if (e.control === confirm || e.control === noMods) {
			// both buttons go dead for that player once either is used
			if (voted.has(e.user)) continue;
			voted.add(e.user);
			ballots.push(e.control === noMods ? new Set() : new Set(ticked.get(e.user) ?? []));
		}
	}
	if (!ballots.length) return [];

	const tally = new Map<number, number>();
	for (const ballot of ballots) {
		const training = ballot.has(TRAINING);
		for (const id of ballot) {
			// Tier 1 cannot be checked alongside Outbreak: the map reads the
			// box but refuses to count it
			if (id === 3 && ballot.has(1)) continue;
			if (id === ONE_LIFE && playerCount < ONE_LIFE_MIN_PLAYERS) continue;
			// the map hides and force-unchecks these unless training mode is on,
			// and it does so without an event of its own
			if (TRAINING_ONLY.includes(id) && !training) continue;
			tally.set(id, (tally.get(id) ?? 0) + 1);
		}
	}
	// half the lobby, not a majority — and Galaxy divides integers
	const threshold = Math.floor(playerCount / 2);
	const passes = (id: number) => {
		const n = tally.get(id) ?? 0;
		return n >= threshold && n > 0;
	};

	const on: number[] = [];
	// Outbreak wins over Tier 1; Rifle over Sushis over Classical
	if (passes(1)) on.push(1);
	else if (passes(3)) on.push(3);
	if (passes(2)) on.push(2);
	else if (passes(10) && mode !== null && mode < 6) on.push(10);
	else if (passes(11) && mode !== 6) on.push(11);
	for (const id of [4, 6, 12, 13, 5, 7, 8, 9]) if (passes(id)) on.push(id);
	return on.sort((a, b) => a - b);
}
