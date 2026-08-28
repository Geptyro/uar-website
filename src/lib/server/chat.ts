/**
 * The site's one chat room: messages in a collection, and the moment they
 * land, change or go, on an in-process bus that the SSE stream at
 * /api/chat/events fans out (single Fly machine, same assumption as
 * $lib/server/events). Who is typing lives in memory only: it is a
 * five-second fact, not a record.
 */
import { randomBytes } from 'node:crypto';
import { db, dbConfigured } from './db.ts';
import type { BuildAuthor } from '$lib/builds';
import { dropReactions, toggleReaction } from './reactions.ts';

export interface ChatDoc {
	_id: string;
	author: BuildAuthor;
	/** Markdown, words and chips (see validateChat). */
	text: string;
	createdAt: string;
	editedAt?: string;
	/** Faces by count, written with every reaction (see $lib/server/reactions). */
	reactions?: Record<string, number>;
}

export type ChatEvent =
	| { type: 'message'; doc: ChatDoc }
	| { type: 'edit'; doc: ChatDoc }
	| { type: 'delete'; id: string }
	| { type: 'typing' };

type Listener = (e: ChatEvent) => void;
const listeners = new Set<Listener>();

export function subscribeChat(fn: Listener): () => void {
	listeners.add(fn);
	return () => {
		listeners.delete(fn);
	};
}

function publish(e: ChatEvent): void {
	for (const fn of [...listeners]) {
		try {
			fn(e);
		} catch {
			// a broken subscriber must not break the others
		}
	}
}

const newId = () => randomBytes(8).toString('hex');

/** How many the page opens with, and a "load older" fetches. */
export const CHAT_PAGE = 50;
/** How many messages the room keeps; older ones go, with their faces (see sweepChat). */
export const CHAT_KEEP = 5_000;

/** When the newest message landed, kept in memory once read: what /api/me tells a page on load. */
let latest: string | null | undefined;
export async function latestChatAt(): Promise<string | null> {
	if (latest === undefined) {
		if (!dbConfigured()) return null;
		const d = await db();
		const row = await d.collection<ChatDoc>('chat').find({}, { projection: { createdAt: 1 } }).sort({ createdAt: -1 }).limit(1).next();
		latest = row?.createdAt ?? null;
	}
	return latest;
}

export async function ensureChatIndexes(): Promise<void> {
	if (!dbConfigured()) return;
	const d = await db();
	await d.collection('chat').createIndex({ createdAt: -1 }, { name: 'createdAt' });
}

/** The newest messages, oldest first as the log reads; `before` pages back. */
export async function listChat(before: string | null = null, n = CHAT_PAGE): Promise<ChatDoc[]> {
	const d = await db();
	const rows = await d
		.collection<ChatDoc>('chat')
		.find(before ? { createdAt: { $lt: before } } : {})
		.sort({ createdAt: -1 })
		.limit(n)
		.toArray();
	return rows.reverse();
}

export async function getChat(id: string): Promise<ChatDoc | null> {
	const d = await db();
	return d.collection<ChatDoc>('chat').findOne({ _id: id });
}

export async function postChat(author: BuildAuthor, text: string, now: Date = new Date()): Promise<ChatDoc> {
	const d = await db();
	const doc: ChatDoc = { _id: newId(), author, text, createdAt: now.toISOString() };
	await d.collection<ChatDoc>('chat').insertOne(doc);
	latest = doc.createdAt;
	stoppedTyping(author.sub);
	publish({ type: 'message', doc });
	return doc;
}

export async function editChat(doc: ChatDoc, text: string, now: Date = new Date()): Promise<ChatDoc> {
	const d = await db();
	const editedAt = now.toISOString();
	await d.collection<ChatDoc>('chat').updateOne({ _id: doc._id }, { $set: { text, editedAt } });
	const next = { ...doc, text, editedAt };
	publish({ type: 'edit', doc: next });
	return next;
}

export async function deleteChat(id: string): Promise<void> {
	const d = await db();
	await d.collection<ChatDoc>('chat').deleteOne({ _id: id });
	await dropReactions('chat', id);
	publish({ type: 'delete', id });
}

/** A face on or off a message; the room sees it as an edit of the message. */
export async function reactChat(doc: ChatDoc, sub: string, emoji: string): Promise<ChatDoc> {
	const reactions = await toggleReaction('chat', doc._id, sub, emoji);
	const next = { ...doc, reactions };
	publish({ type: 'edit', doc: next });
	return next;
}

/**
 * The room forgets past its keep: everything older than the newest `keep`
 * messages goes, faces included. A clock, not a hook (see hooks.server.ts):
 * one narrow read to find the cut, one delete each side of it.
 */
export async function sweepChat(keep = CHAT_KEEP): Promise<number> {
	const d = await db();
	const chat = d.collection<ChatDoc>('chat');
	const cut = await chat.find({}, { projection: { createdAt: 1 } }).sort({ createdAt: -1 }).skip(keep).limit(1).next();
	if (!cut) return 0;
	const old = await chat.find({ createdAt: { $lte: cut.createdAt } }, { projection: { _id: 1 } }).toArray();
	if (!old.length) return 0;
	await d.collection('reactions').deleteMany({ target: { $in: old.map((m) => `chat:${m._id}`) } });
	const r = await chat.deleteMany({ _id: { $in: old.map((m) => m._id) } });
	return r.deletedCount;
}

/* ---------- who is typing ---------- */

/** How long a "typing" lasts without another: a pause, then it is gone. */
const TYPING_MS = 4_000;
const typing = new Map<string, { name: string; until: number }>();
let sweep: ReturnType<typeof setInterval> | undefined;

/** Someone typed a moment ago. */
export function startedTyping(sub: string, name: string, now = Date.now()): void {
	const fresh = !typing.has(sub);
	typing.set(sub, { name, until: now + TYPING_MS });
	if (fresh) publish({ type: 'typing' });
	if (!sweep) {
		sweep = setInterval(() => {
			const t = Date.now();
			let changed = false;
			for (const [k, v] of typing) {
				if (v.until <= t) {
					typing.delete(k);
					changed = true;
				}
			}
			if (changed) publish({ type: 'typing' });
			if (!typing.size && sweep) {
				clearInterval(sweep);
				sweep = undefined;
			}
		}, 1_000);
		sweep.unref?.();
	}
}

export function stoppedTyping(sub: string): void {
	if (typing.delete(sub)) publish({ type: 'typing' });
}

/** Who is typing right now, but the one asking. */
export function whoIsTyping(except: string | null, now = Date.now()): string[] {
	return [...typing.entries()].filter(([k, v]) => k !== except && v.until > now).map(([, v]) => v.name);
}
