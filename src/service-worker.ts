/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

/**
 * Deliberately the smallest service worker that does something useful.
 *
 * It exists mainly so the site is installable: Chrome only keeps a File
 * System Access grant across sessions for an installed app, and that grant is
 * what stops /companion's browser replay sync asking for the folder every
 * visit. It also receives push notifications (see the `push` listener below),
 * which is the one job that has to run with every tab closed.
 *
 * What it does NOT do is cache pages or API responses, and that is the whole
 * design. Player pages, replays and the leaderboards are server-rendered from
 * Mongo behind a Battle.net session — a service worker that cached those
 * would serve one player another's view, or yesterday's XP, and the bug would
 * survive a reload because the reload is what it intercepts. Only
 * `/_app/immutable/` is cached, and only because those filenames contain a
 * hash of their contents, so a stale one is impossible by construction.
 */

import { build, version } from '$service-worker';

const self = globalThis.self as unknown as ServiceWorkerGlobalScope;

const CACHE = `uar-immutable-${version}`;

/** Content-hashed build output. Everything else goes to the network. */
const IMMUTABLE = '/_app/immutable/';

self.addEventListener('install', (event) => {
	// No precache sweep: static/ holds the model viewer's meshes and the camo
	// textures, tens of megabytes nobody asked to download up front. Assets
	// land in the cache as they are actually used instead.
	void build;
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key.startsWith('uar-immutable-') && key !== CACHE) await caches.delete(key);
			}
			await self.clients.claim();
		})()
	);
});

/**
 * Push notifications — a lobby forming, or someone flagging themselves ready.
 *
 * This is the half of the feature the page cannot do: the site is closed, the
 * tab is gone, and this worker is woken by the push service to show it. The
 * payload is decrypted by the browser before it gets here (RFC 8291), so what
 * arrives is the plain object server/notify.ts sent.
 *
 * `tag` collapses: a second "someone is ready" replaces the first rather than
 * stacking, because the notification always states the current total and an
 * older copy of that is just wrong.
 */
self.addEventListener('push', (event) => {
	event.waitUntil(
		(async () => {
			// a push with no payload is a wakeup from a service doing its own
			// housekeeping; showing "New notification" for that is worse than
			// showing nothing, but a permission grant obliges us to show *something*
			let data: { title?: string; body?: string; tag?: string; url?: string } = {};
			try {
				data = event.data ? event.data.json() : {};
			} catch {
				// malformed payload — fall through to the generic wording
			}
			await self.registration.showNotification(data.title ?? 'Undead Assault Reborn', {
				body: data.body ?? 'Something changed on UAR.',
				tag: data.tag ?? 'uar',
				icon: '/icon-192.png',
				badge: '/icon-192.png',
				data: { url: data.url ?? '/' }
			});
		})()
	);
});

/**
 * Clicking one lands on the site — reusing an open tab when there is one,
 * because a player who already has UAR open does not want a second copy of it.
 */
self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/';
	event.waitUntil(
		(async () => {
			const target = new URL(url, self.location.origin);
			const clients = await self.clients.matchAll({
				type: 'window',
				includeUncontrolled: true
			});
			for (const client of clients) {
				if (new URL(client.url).origin !== target.origin) continue;
				await client.focus();
				if ('navigate' in client && client.url !== target.href) await client.navigate(target.href);
				return;
			}
			await self.clients.openWindow(target.href);
		})()
	);
});

self.addEventListener('fetch', (event) => {
	const request = event.request;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== location.origin) return;
	if (!url.pathname.startsWith(IMMUTABLE)) return; // pages and /api: untouched

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);
			const hit = await cache.match(request);
			if (hit) return hit;

			const response = await fetch(request);
			// only store a clean same-origin 200; an opaque or errored response
			// pinned under a hashed name would be permanent
			if (response.ok && response.type === 'basic') {
				cache.put(request, response.clone());
			}
			return response;
		})()
	);
});
