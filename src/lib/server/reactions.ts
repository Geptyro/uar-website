/**
 * Who put which face on what. One doc per person, target and face, in
 * `reactions`; the counts are written onto the target (a chat message, a
 * comment) so a page reads them with the thing itself, and only the
 * reader's own faces are a second, narrow query.
 */
import { db } from './db.ts';
import { isReaction, type ReactionEmoji } from '../reactions.ts';

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

/** The reader's own faces on each of these targets. */
export async function myReactions(kind: ReactionKind, ids: string[], sub: string): Promise<Map<string, string[]>> {
	const out = new Map<string, string[]>();
	if (!ids.length) return out;
	const d = await db();
	const rows = await d
		.collection<ReactionDoc>('reactions')
		.find({ sub, target: { $in: ids.map((i) => target(kind, i)) } }, { projection: { target: 1, emoji: 1 } })
		.toArray();
	for (const r of rows) {
		const id = r.target.slice(kind.length + 1);
		out.set(id, [...(out.get(id) ?? []), r.emoji]);
	}
	return out;
}

/** The target is gone: its faces go with it. */
export async function dropReactions(kind: ReactionKind, id: string): Promise<void> {
	const d = await db();
	await d.collection<ReactionDoc>('reactions').deleteMany({ target: target(kind, id) });
}
