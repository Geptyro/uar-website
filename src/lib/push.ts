/**
 * Browser notifications — when a roster change is worth interrupting someone
 * over, and what it should say. Dependency-free so plain node:test can load it
 * (see CLAUDE.md), and shared with the client, which renders the same labels
 * in the account page's toggles.
 *
 * These are the companion app's rules (its core/lobby.ts and
 * announceReadyChanges) moved server-side, with one difference that matters:
 * the companion decides for the one person running it, this decides once for
 * everyone. So the diff is global and the *audience* is filtered per
 * recipient — you are never told about your own flag, or about a lobby you are
 * standing in.
 */

export const PUSH_TOPICS = ['ready', 'lobby'] as const;
export type PushTopic = (typeof PUSH_TOPICS)[number];

export type PushPrefs = Record<PushTopic, boolean>;

export const DEFAULT_PREFS: PushPrefs = { ready: true, lobby: true };

export const TOPIC_LABELS: Record<PushTopic, { label: string; hint: string }> = {
	ready: {
		label: 'Someone is ready to play',
		hint: 'When a player raises their “ready to play” flag, or drops it early'
	},
	lobby: {
		label: 'A lobby is forming',
		hint: 'When a lobby opens with someone already in it — the moment to join'
	}
};

/** Normalises whatever came off the wire into a full preference set. */
export function readPrefs(value: unknown): PushPrefs {
	const v = (value ?? {}) as Record<string, unknown>;
	return {
		ready: typeof v.ready === 'boolean' ? v.ready : DEFAULT_PREFS.ready,
		lobby: typeof v.lobby === 'boolean' ? v.lobby : DEFAULT_PREFS.lobby
	};
}

/**
 * One player a notification is about.
 *
 * Identified by account, not by battletag: a battletag stored on a
 * subscription is a snapshot from whenever that browser subscribed, and a
 * player who changes theirs would otherwise start getting notified about
 * themselves — and read as a departure plus an arrival in the same tick.
 */
export interface Subject {
	/** Battle.net account id (the OAuth `sub` claim). */
	id: string;
	battletag: string;
	/** SC2 profile name — what people know each other by; null falls back. */
	name: string | null;
}

/** What the service worker receives and shows. */
export interface PushPayload {
	title: string;
	body: string;
	/** Collapse key: a newer notification of the same kind replaces the old. */
	tag: PushTopic;
	/** Where clicking it lands. */
	url: string;
}

/* ---------------------------------------------------------------- ready --- */

export interface ReadyState {
	/**
	 * account id → who they are and when their flag runs out, as of the last
	 * evaluation; null before the first. Carries the display fields and not
	 * just the expiry because a player who drops their flag is *gone* from the
	 * next roster — this snapshot is the only thing left to name them by.
	 */
	known: Record<string, { until: string; battletag: string; name: string | null }> | null;
}

export const NO_READY_STATE: ReadyState = { known: null };

export interface ReadyDiff {
	added: Subject[];
	removed: Subject[];
	/** How many are flagged now — the notification's second line. */
	total: number;
}

/**
 * Diffs the flagged roster against the last evaluation.
 *
 * The first evaluation after a boot only establishes a baseline: a deploy
 * restarts this process, and announcing everyone who happened to be flagged at
 * that moment would turn every release into a round of notifications.
 */
export function diffReady(
	state: ReadyState,
	players: (Subject & { until: string })[],
	now: number
): { diff: ReadyDiff | null; state: ReadyState } {
	const next: ReadyState['known'] = {};
	for (const p of players) {
		next[p.id] = { until: p.until, battletag: p.battletag, name: p.name };
	}
	const prev = state.known;
	const carried = { known: next };
	if (prev === null) return { diff: null, state: carried };

	const added: Subject[] = players
		.filter((p) => !(p.id in prev))
		.map((p) => ({ id: p.id, battletag: p.battletag, name: p.name }));
	// a flag that vanished with time still comfortably on it was dropped on
	// purpose; anything else merely expired, and an expiry is not news
	const removed: Subject[] = Object.entries(prev)
		.filter(([id, p]) => !(id in next) && Date.parse(p.until) > now + 60_000)
		.map(([id, p]) => ({ id, battletag: p.battletag, name: p.name }));

	if (added.length === 0 && removed.length === 0) return { diff: null, state: carried };
	return { diff: { added, removed, total: players.length }, state: carried };
}

/* ---------------------------------------------------------------- lobby --- */

export interface LobbyState {
	/** Account ids in the open lobby last evaluation; null before the first. */
	known: string[] | null;
	/** The lobby last announced, for flap suppression. */
	last: { who: string[]; at: number } | null;
}

export const NO_LOBBY_STATE: LobbyState = { known: null, last: null };

/**
 * Decides whether an open lobby is news.
 *
 * The site collapses every open lobby into one group on purpose — while a
 * lobby is open SC2 exposes nothing that tells two apart, or that identifies
 * the map (companion docs/sc2-detection.md) — so "a lobby formed" is that
 * group appearing at all, and the wording has to stay neutral about which map
 * it is.
 */
export function diffLobby(
	state: LobbyState,
	members: Subject[],
	now: number,
	gapMs: number
): { members: Subject[] | null; state: LobbyState } {
	const ids = members.map((m) => m.id).sort();
	const quiet = { members: null, state: { ...state, known: ids } };

	// a lobby already open when this process started is not news
	if (state.known === null) return quiet;
	// fires on the lobby appearing, not on every join: an already-populated
	// lobby that gains a member was announced when it formed
	if (ids.length === 0 || state.known.length > 0) return quiet;
	// presence goes stale after ~2 min without a heartbeat, so a lobby can
	// blink out and back; the same faces returning is that, not a new lobby
	if (
		state.last !== null &&
		now - state.last.at < gapMs &&
		ids.some((id) => state.last!.who.includes(id))
	) {
		return quiet;
	}
	return { members, state: { known: ids, last: { who: ids, at: now } } };
}

/* -------------------------------------------------------------- wording --- */

const shown = (s: Subject) => s.name ?? s.battletag;

/** "A and B", "A, B and 3 more" — the headline's subject. */
export function listNames(names: string[]): string {
	if (names.length <= 2) return names.join(' and ');
	return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}

const isAre = (n: number) => (n === 1 ? 'is' : 'are');

/**
 * The ready notification as one recipient should see it, or null when there
 * is nothing left to tell them — which is the case when the only thing that
 * changed was their own flag.
 */
export function readyPayload(diff: ReadyDiff, me: string | null): PushPayload | null {
	const mine = (s: Subject) => s.id === me;
	const added = diff.added.filter((s) => !mine(s));
	const removed = diff.removed.filter((s) => !mine(s));
	if (added.length === 0 && removed.length === 0) return null;
	const body = `${diff.total} player${diff.total === 1 ? '' : 's'} ready to play`;
	// an arrival is the actionable half; only report departures on their own
	const subjects = added.length > 0 ? added : removed;
	const verb = added.length > 0 ? 'ready to play' : 'no longer ready';
	return {
		title: `${listNames(subjects.map(shown))} ${isAre(subjects.length)} ${verb}`,
		body,
		tag: 'ready',
		url: '/'
	};
}

/** The lobby notification, or null when the recipient is already in it. */
export function lobbyPayload(members: Subject[], me: string | null): PushPayload | null {
	if (members.length === 0) return null;
	// we were there when it formed — nothing to tell us
	if (me !== null && members.some((m) => m.id === me)) return null;
	return {
		title: `${listNames(members.map(shown))} ${isAre(members.length)} in a lobby`,
		body: 'Open UAR to see who joins',
		tag: 'lobby',
		url: '/'
	};
}
