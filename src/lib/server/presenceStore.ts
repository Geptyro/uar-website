/**
 * SC2 presence, held in this process rather than in Mongo.
 *
 * Presence is the one thing the site stores that is never worth reading twice:
 * a heartbeat is stale after two minutes and meaningless after ten, nothing
 * reads it historically, and every companion rewrites its own row every 60
 * seconds. Persisting it bought nothing and cost a write per player per minute
 * against a free-tier cluster — plus a `deleteMany` sweep riding along on every
 * one of those writes.
 *
 * The single-always-on-machine assumption is the same one already made by the
 * SSE pub/sub in events.ts, the rate limiters and the read cache; this adds no
 * new one. What it does add is a deploy blanking the status chips until each
 * companion's next beat, up to a minute — and, for that same minute, a player
 * who is in a game being able to raise a ready flag the next beat immediately
 * withdraws. Both self-heal, and neither is worth a database for.
 *
 * Dependency-free on purpose (see CLAUDE.md), so the expiry rules are under
 * plain node:test rather than only exercised through a route.
 */

/** One player's last known heartbeat. */
export interface PresenceRecord {
	/** Battle.net account id (the OAuth `sub` claim) — one heartbeat each. */
	sub: string;
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
	/** ISO timestamp of the last heartbeat. */
	at: string;
}

/**
 * How long a record is kept at all. Far past the two minutes that make it
 * *fresh* — this is only so a companion that quit without a DELETE cannot
 * hold a slot forever, and the map is bounded by the number of players who
 * have ever run the app since the last deploy either way.
 */
const FORGET_AFTER_MS = 60 * 60_000;

const beats = new Map<string, PresenceRecord>();

/** Drops records too old to matter. Cheap, and only ever runs on a write. */
function forgetOld(now: number): void {
	for (const [sub, record] of beats) {
		if (now - Date.parse(record.at) > FORGET_AFTER_MS) beats.delete(sub);
	}
}

export function upsertPresence(record: PresenceRecord, now = Date.now()): void {
	beats.set(record.sub, record);
	forgetOld(now);
}

/** One player's heartbeat, however old — the caller decides what is fresh. */
export function getPresence(sub: string): PresenceRecord | null {
	return beats.get(sub) ?? null;
}

export function deletePresence(sub: string): void {
	beats.delete(sub);
}

/**
 * Fresh lobby/ingame heartbeats, oldest first.
 *
 * `menus` is deliberately excluded: it is reported so the site knows someone
 * is *not* in a game, which is a fact worth storing and never worth showing.
 */
export function getActivePresence(staleMs: number, now = Date.now()): PresenceRecord[] {
	const fresh: PresenceRecord[] = [];
	for (const record of beats.values()) {
		if (record.status !== 'lobby' && record.status !== 'ingame') continue;
		if (now - Date.parse(record.at) >= staleMs) continue;
		fresh.push(record);
	}
	return fresh.sort((a, b) => a.at.localeCompare(b.at));
}

/** Test hooks. */
export function presenceCount(): number {
	return beats.size;
}
export function clearPresence(): void {
	beats.clear();
}
