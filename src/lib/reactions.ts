/**
 * Reactions: the small set of faces a reader can put on a message or a
 * comment, and the shape a page draws them in. Dependency-free so
 * node:test can load it.
 */

/** The palette, in the order the picker shows it. */
export const REACTIONS = ['👍', '👎', '❤️', '😂', '😮', '😢', '🔥', '🎉'] as const;
export type ReactionEmoji = (typeof REACTIONS)[number];

export function isReaction(v: unknown): v is ReactionEmoji {
	return typeof v === 'string' && (REACTIONS as readonly string[]).includes(v);
}

/** Somebody who put a face on, named and pictured as the site names players. */
export interface Reactor {
	name: string;
	toon: string | null;
	avatar: string | null;
}

/** How many names a pill names on hover before it counts the rest. */
export const REACTORS_SHOWN = 12;

/** One reaction as drawn: the face, how many, whether the reader is among them, and who. */
export interface ReactionView {
	emoji: ReactionEmoji;
	n: number;
	mine: boolean;
	/** Oldest first, at most REACTORS_SHOWN of them; `n` is still the whole count. */
	who: Reactor[];
}

/** Counts by face and the reader's own faces, as the pills a page shows, in palette order, none empty. */
export function reactionViews(
	counts: Record<string, number> | undefined,
	mine: Iterable<string> = [],
	who: Record<string, Reactor[]> = {}
): ReactionView[] {
	const own = new Set(mine);
	return REACTIONS.filter((e) => (counts?.[e] ?? 0) > 0).map((e) => ({
		emoji: e,
		n: counts?.[e] ?? 0,
		mine: own.has(e),
		who: (who[e] ?? []).slice(0, REACTORS_SHOWN)
	}));
}
