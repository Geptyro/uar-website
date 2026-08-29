/**
 * Who put which face on what. One doc per person, target and face, in
 * `reactions`; the counts are written onto the target (a chat message, a
 * comment) so a page reads them with the thing itself, and who is behind
 * them — the names a pill shows on hover, the reader's own among them — is
 * one narrow query over the targets that carry a count at all.
 */
import { db, getFacesBySub } from './db.ts';
import { isReaction, type ReactionEmoji, type Reactor } from '../reactions.ts';

export type ReactionKind = 'chat' | 'comment';

export interface ReactionDoc {
	_id: string; // `${target}:${sub}:${emoji}`
	/** `chat:<id>` or `comment:<id>`. */
	target: string;
	sub: string;
	emoji: ReactionEmoji;
	at: string;
}

const COLLECTION: Record<ReactionKind, string> = { chat: 'chat', comment: 'buildComments' };
const target = (kind: ReactionKind, id: string) => `${kind}:${id}`;

export async function ensureReactionIndexes(): Promise<void> {
	const d = await db();
	await Promise.all([
		d.collection('reactions').createIndex({ target: 1 }, { name: 'target' }),
		d.collection('reactions').createIndex({ sub: 1, target: 1 }, { name: 'sub_target' })
	]);
}

/** Put a face on, or take it off if it is there. Returns the target's counts by face. */
export async function toggleReaction(
	kind: ReactionKind,
	id: string,
	sub: string,
	emoji: string,
	now: Date = new Date()
): Promise<Record<string, number>> {
	if (!isReaction(emoji)) throw new Error('not a reaction');
	const d = await db();
	const reactions = d.collection<ReactionDoc>('reactions');
	const t = target(kind, id);
	const _id = `${t}:${sub}:${emoji}`;
	const gone = await reactions.deleteOne({ _id });
	if (!gone.deletedCount) await reactions.insertOne({ _id, target: t, sub, emoji, at: now.toISOString() });
	const rows = await reactions
		.aggregate<{ _id: string; n: number }>([{ $match: { target: t } }, { $group: { _id: '$emoji', n: { $sum: 1 } } }])
		.toArray();
	const counts = Object.fromEntries(rows.map((r) => [r._id, r.n]));
	await d.collection<{ _id: string }>(COLLECTION[kind]).updateOne({ _id: id }, { $set: { reactions: counts } });
	return counts;
}

/** Who is behind each face on a target, and which of them are the reader's own. */
export interface TargetReactors {
	/** The faces the reader put on, so their pills light up. */
	mine: string[];
	/** Face -> who put it there, oldest first. */
	who: Record<string, Reactor[]>;
}

/**
 * Who reacted to each of these targets. One read of the faces themselves —
 * the counts on the target say *how many*, this says *who*, and the reader's
 * own fall out of the same rows rather than costing a second query.
 *
 * Pass only the ids that carry counts: on a page of chat most messages have
 * no faces at all, and asking about them is bytes for nothing (see the M0
 * notes in db.ts).
 */
export async function reactorsOn(
	kind: ReactionKind,
	ids: string[],
	viewer: string | null
): Promise<Map<string, TargetReactors>> {
	const out = new Map<string, TargetReactors>();
	if (!ids.length) return out;
	const d = await db();
	const [rows, faces] = await Promise.all([
		d
			.collection<ReactionDoc>('reactions')
			.find(
				{ target: { $in: ids.map((i) => target(kind, i)) } },
				{ projection: { _id: 0, target: 1, emoji: 1, sub: 1, at: 1 } }
			)
			.toArray(),
		getFacesBySub()
	]);
	rows.sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''));
	for (const r of rows) {
		const id = r.target.slice(kind.length + 1);
		let t = out.get(id);
		if (!t) out.set(id, (t = { mine: [], who: {} }));
		if (viewer !== null && r.sub === viewer) t.mine.push(r.emoji);
		(t.who[r.emoji] ??= []).push(faces[r.sub] ?? { name: 'Someone', toon: null, avatar: null });
	}
	return out;
}

/** The ids among these that have a face on them at all — what reactorsOn wants asked about. */
export function reactedIds<T extends { _id: string; reactions?: Record<string, number> }>(
	docs: T[]
): string[] {
	return docs.filter((d) => Object.keys(d.reactions ?? {}).length > 0).map((d) => d._id);
}

/** The target is gone: its faces go with it. */
export async function dropReactions(kind: ReactionKind, id: string): Promise<void> {
	const d = await db();
	await d.collection<ReactionDoc>('reactions').deleteMany({ target: target(kind, id) });
}
