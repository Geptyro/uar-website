/**
 * The things a reader can name from a box: what the `@` search in a guide,
 * a comment or the chat offers, and what the site's search palette asks the
 * database for. One layer, so a player found in the palette is the same
 * player a chat message can ping, written the same way.
 *
 * The game's things (skills, abilities, items, classes, SIs, hostiles,
 * missions) are bundled and searched in the browser (see searchRefs). Players
 * are not bundled: they come from /api/search/players, the same call the
 * palette makes, and are written as `[[player:<toon>|Name]]` so the chip
 * carries the name and the renderer needs no lookup.
 */
import type { RefHit } from './buildRefs';
import { ANON_PORTRAIT } from './portrait.ts';

export interface PlayerHit {
	toon: string;
	name: string;
	clan: string;
	avatarUrl: string | null;
}

/** How long a query must be before the database is asked. */
export const PLAYER_QUERY_MIN = 2;

/** Players by name fragment, from the site's own search endpoint. Empty on any trouble. */
export async function fetchPlayers(query: string, fetchFn: typeof fetch = fetch): Promise<PlayerHit[]> {
	const q = query.trim();
	if (q.length < PLAYER_QUERY_MIN) return [];
	try {
		const res = await fetchFn(`/api/search/players?q=${encodeURIComponent(q)}`);
		if (!res.ok) return [];
		const body = (await res.json()) as { players?: PlayerHit[] };
		return body.players ?? [];
	} catch {
		return [];
	}
}

/** What a box writes for a player: the toon, and the name to show. */
export function playerRef(toon: string, name: string): string {
	return `[[player:${toon}|${name.replace(/[|\]]/g, '') || toon}]]`;
}

export function playerHit(p: PlayerHit): RefHit {
	return {
		kind: 'player',
		id: p.toon,
		name: p.clan ? `<${p.clan}> ${p.name}` : p.name || p.toon,
		// the stock portrait for a player with none: the row, and the chip a pick makes, show a person
		icon: p.avatarUrl ?? ANON_PORTRAIT,
		ref: playerRef(p.toon, p.name || p.toon),
		note: 'player'
	};
}

const fold = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * The game's things at once, and the players a moment later: one list. The
 * things come first, unless a player's name begins with what was typed: then
 * the reader is spelling a name, and the fuzzy matches on things wait.
 */
export function mergeHits(things: RefHit[], players: PlayerHit[], limit = 10, query = ''): RefHit[] {
	const q = fold(query);
	const named = q ? players.filter((p) => fold(p.name).startsWith(q)) : [];
	const rest = players.filter((p) => !named.includes(p));
	const out: RefHit[] = named.map(playerHit);
	for (const t of things.slice(0, Math.max(4, limit - players.length))) {
		if (out.length >= limit) break;
		out.push(t);
	}
	for (const p of rest) {
		if (out.length >= limit) break;
		out.push(playerHit(p));
	}
	return out;
}
