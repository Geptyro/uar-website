/**
 * replay.attributes.events — the lobby settings, as the lobby left them.
 *
 * A flat table: 4-byte header, 1 pad byte, an entry count, then 13 bytes per
 * entry (namespace, attribute id, player slot, and a four-character value
 * stored backwards). Namespace 999 is Blizzard's own (race, colour, teams…);
 * a custom map's own attributes carry the map's arcade id as the namespace,
 * which is what UAR's pre-game mode vote lives in. Player 16 is the lobby
 * itself rather than a slot.
 *
 * Version-independent — unlike every other stream in the archive, this one
 * has no protocol-specific typeinfo, so it needs no protocol at all.
 */

const utf8 = new TextDecoder('utf-8');

export interface LobbyAttribute {
	namespace: number;
	id: number;
	/** 1..15 for a slot, 16 for the lobby-wide value. */
	player: number;
	value: string;
}

/** Lobby attributes keyed `namespace/id/player`; empty when unreadable. */
export function decodeAttributes(buf: Uint8Array): LobbyAttribute[] {
	// header (4) + pad (1) + count (4); anything shorter carries no entries
	if (buf.length < 9) return [];
	const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
	const count = view.getUint32(5, true);
	const out: LobbyAttribute[] = [];
	for (let i = 0; i < count; i++) {
		const at = 9 + i * 13;
		if (at + 13 > buf.length) break; // truncated tail — keep what parsed
		out.push({
			namespace: view.getUint32(at, true),
			id: view.getUint32(at + 4, true),
			player: buf[at + 8],
			value: utf8.decode(buf.slice(at + 9, at + 13).reverse()).replace(/\0/g, '')
		});
	}
	return out;
}

/**
 * UAR's own attribute namespace — the map's arcade id, as it appears in
 * MapScript.galaxy as `[bnet:local/0.0/236880]`.
 */
const UAR_NAMESPACE = 236880;
/** Attribute 2: "0002" turns the lobby's pre-game mode vote on. */
const ATTR_LOBBY_VOTE_ENABLED = 2;
/** Attribute 3: each slot's mode preference, when the lobby vote is on. */
const ATTR_MODE_PREFERENCE = 3;

/**
 * Attribute values to mode numbers, transcribed from gt_InitializationMap_Func.
 * The order is the lobby dropdown's, not the map's: "0008" is the entry that
 * defers to the in-game vote and so maps to nothing.
 */
const PREFERENCE_MODES: Record<string, number> = {
	'0001': 1,
	'0002': 2,
	'0003': 3,
	'0004': 4,
	'0005': 5,
	'0009': 6,
	'0006': 7,
	'0007': 8,
	'0011': 9,
	'0010': 10,
	'0012': 11,
	'0013': 12
};

/**
 * The mode the lobby settled before the game even started, or null when it
 * did not — the map's default is to leave the choice to the in-game vote, so
 * null is the ordinary answer and not a failure.
 *
 * Transcribed from gt_InitializationMap_Func: a mode carries when at least
 * half the lobby asked for it (and a lone player carries their own choice
 * outright). Competitive is the one exception — the map re-checks the lobby
 * size for it afterwards and falls back to the in-game vote when it is short.
 */
export function lobbyVotedMode(attrs: LobbyAttribute[], activePlayers: number[]): number | null {
	const enabled = attrs.some(
		(a) =>
			a.namespace === UAR_NAMESPACE && a.id === ATTR_LOBBY_VOTE_ENABLED && a.value === '0002'
	);
	if (!enabled) return null;

	const byPlayer = new Map<number, number>();
	for (const a of attrs) {
		if (a.namespace !== UAR_NAMESPACE || a.id !== ATTR_MODE_PREFERENCE) continue;
		if (!activePlayers.includes(a.player)) continue;
		const mode = PREFERENCE_MODES[a.value];
		if (mode) byPlayer.set(a.player, mode);
	}
	if (!byPlayer.size) return null;
	if (activePlayers.length === 1) return byPlayer.get(activePlayers[0]) ?? null;

	const counted = new Map<number, number>();
	for (const m of byPlayer.values()) counted.set(m, (counted.get(m) ?? 0) + 1);
	const threshold = Math.floor(activePlayers.length / 2);
	// the map takes the first mode over the line and stops looking at the
	// second, so ties go to the lower mode number
	for (let m = 1; m <= 12; m++) {
		if ((counted.get(m) ?? 0) < threshold) continue;
		return m === 6 && activePlayers.length < 4 ? null : m;
	}
	return null;
}
