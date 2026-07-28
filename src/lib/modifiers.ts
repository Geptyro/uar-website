/**
 * The map's opening modifier vote — the options a lobby stacks on top of the
 * mode it picked.
 *
 * Thirteen checkboxes, each its own yes/no ballot: a modifier is on when at
 * least *half* the lobby ticked it (not a majority — `>=`, and on Galaxy's
 * integer division), so several can carry at once. Ids are gv_modifiervote
 * indices, which is what the parser reports and what the documents store.
 *
 * Unlike the game mode there is no counter in the save file that names them,
 * so a modifier can only ever be read out of a recording that lasted past the
 * vote. Two things in the save file do corroborate it, though, and
 * `backfill-modifiers.ts --verify` grades against both: 1 life disables every
 * revive path in the map, so a player's revive counter cannot move across a
 * 1-life game; and winning with Outbreak or Tier 1 unlocks a Skill Identifier
 * that can only come from that modifier being on.
 */
import rawProgression from './data/progression.json';

export interface Modifier {
	/** gv_modifiervote index, 1..13. */
	id: number;
	name: string;
	/** The game's own checkbox blurb, minus the name it leads with. */
	desc: string;
}

const progression = rawProgression as { modes: string[]; modifiers: Modifier[] };

export const modifiers: Modifier[] = progression.modifiers;

const byId = new Map(modifiers.map((m) => [m.id, m]));

export function modifier(id: number): Modifier | undefined {
	return byId.get(id);
}

/**
 * Stored ids in the order they should read, which is the map's own: the
 * modifiers that change the fight first, the training-mode options last —
 * those turn XP and bank saving off, so a game carrying them is a practice
 * run rather than a harder game.
 */
const DISPLAY_ORDER = [1, 3, 2, 10, 11, 4, 6, 12, 13, 5, 7, 8, 9];

export function orderModifiers(ids: number[]): number[] {
	return [...ids].sort((a, b) => DISPLAY_ORDER.indexOf(a) - DISPLAY_ORDER.indexOf(b));
}

/** Training mode turns XP and bank saving off — the game does not count. */
export const TRAINING = 5;
