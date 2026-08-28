/**
 * What a player is told about, and what they have seen.
 *
 * - notifications: one doc per thing a player would want to know: someone
 *   commented on their guide, or answered their comment. Read when the
 *   player opens the notifications page; the top bar's bell counts the rest.
 * - threadSeen: when a player last opened a thread, per thread, so the
 *   comments that arrived since carry a mark. A first visit marks nothing:
 *   everything before it is old news, not new.
 *
 * Narrow reads, like the rest of the store (see db.ts): a count by account,
 * a page of the newest, one row per thread.
 */
import { randomBytes } from 'node:crypto';
import { db, getAccountByToon } from './db.ts';
import type { BuildAuthor } from '$lib/builds';

export type NotificationKind = 'comment' | 'reply' | 'mention';
export type SubjectKind = 'guide' | 'mos' | 'entity' | 'chat';

export interface CommentSubject {
	kind: SubjectKind;
	title: string;
	/** The thread's page, where the comment is. */
	href: string;
}

export interface NotificationDoc {
	_id: string;
	/** Who is told. */
	sub: string;
	kind: NotificationKind;
	at: string;
	readAt?: string;
	/** The comment it is about, and the thread it is in. */
	comment: string;
	host: string;
	subject: CommentSubject;
	by: BuildAuthor;
	/** The comment's first words, as plain text. */
	excerpt: string;
}

export interface ThreadSeenDoc {
	_id: string; // `${sub}:${host}`
	sub: string;
	host: string;
	at: string;
}

const newId = () => randomBytes(8).toString('hex');

export async function ensureNotificationIndexes(): Promise<void> {
	const d = await db();
	await Promise.all([
		d.collection('notifications').createIndex({ sub: 1, at: -1 }, { name: 'sub_at' }),
		d.collection('notifications').createIndex({ sub: 1, readAt: 1 }, { name: 'sub_read' })
	]);
}

/**
 * Who a text pings, as accounts: the players named by handle whose account is
 * linked to that handle, less the writer and anyone already told. Others are
 * named all the same; they are just not told.
 */
export async function pingedAccounts(toons: string[], except: Iterable<string>): Promise<string[]> {
	const skip = new Set(except);
	const out: string[] = [];
	for (const toon of toons) {
		const account = await getAccountByToon(toon);
		if (account && !skip.has(account._id) && !out.includes(account._id)) out.push(account._id);
	}
	return out;
}

/** Tell each recipient; nothing to tell is nothing done. */
export async function notify(items: Omit<NotificationDoc, '_id' | 'at'>[], now: Date = new Date()): Promise<void> {
	if (!items.length) return;
	const d = await db();
	const at = now.toISOString();
	await d.collection<NotificationDoc>('notifications').insertMany(items.map((n) => ({ ...n, _id: newId(), at })));
}

/** How many a player has not read: the bell's number. */
export async function unreadCount(sub: string): Promise<number> {
	const d = await db();
	return d.collection<NotificationDoc>('notifications').countDocuments({ sub, readAt: { $exists: false } });
}

/** A player's newest, read or not. */
export async function listNotifications(sub: string, n = 50): Promise<NotificationDoc[]> {
	const d = await db();
	return d.collection<NotificationDoc>('notifications').find({ sub }).sort({ at: -1 }).limit(n).toArray();
}

/** Everything unread becomes read: the player has the page in front of them. */
export async function markAllRead(sub: string, now: Date = new Date()): Promise<void> {
	const d = await db();
	await d
		.collection<NotificationDoc>('notifications')
		.updateMany({ sub, readAt: { $exists: false } }, { $set: { readAt: now.toISOString() } });
}

/** How long a read notification stays before the sweep takes it. */
export const NOTIFICATION_KEEP_MS = 90 * 24 * 60 * 60_000;

/** Read notifications older than the keep go; unread ones stay until read. */
export async function sweepNotifications(keepMs = NOTIFICATION_KEEP_MS, now: Date = new Date()): Promise<number> {
	const d = await db();
	const before = new Date(now.getTime() - keepMs).toISOString();
	const r = await d.collection<NotificationDoc>('notifications').deleteMany({ readAt: { $lt: before } });
	return r.deletedCount;
}

/** When this player last opened this thread, or null for never. */
export async function threadSeenAt(sub: string, host: string): Promise<string | null> {
	const d = await db();
	const row = await d.collection<ThreadSeenDoc>('threadSeen').findOne({ _id: `${sub}:${host}` }, { projection: { at: 1 } });
	return row?.at ?? null;
}

/** The player has the thread in front of them now. */
export async function touchThreadSeen(sub: string, host: string, now: Date = new Date()): Promise<void> {
	const d = await db();
	await d
		.collection<ThreadSeenDoc>('threadSeen')
		.updateOne({ _id: `${sub}:${host}` }, { $set: { sub, host, at: now.toISOString() } }, { upsert: true });
}
