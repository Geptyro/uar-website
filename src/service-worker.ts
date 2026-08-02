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
 * visit.
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
