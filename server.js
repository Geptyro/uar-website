// Production server: SvelteKit's built `handler` with a cache policy for the
// static art this site ships, so the SITE owns that policy and the gateway
// stays agnostic of paths like /icons/ (it only rate-limits page navigations).
//
// It has to be done out here because adapter-node serves static files through
// its own sirv middleware, which runs *inside* `handler` and sets Cache-Control
// only on the content-hashed /_app/immutable/* assets. Everything in static/
// therefore went out with an ETag and a Last-Modified and no Cache-Control at
// all, which is the worst of both: browsers heuristic-cache it off the
// Last-Modified, and a build stamps that to now, so freshness works out to
// roughly nothing and every navigation re-validated every image. One profile's
// replay tab is 26 icons, which measured ~240ms of round trips before the page
// could finish, on files that had not changed in months.
//
// This replaces `node build` (build/index.js), so it has to carry over the part
// of that file which matters here: the graceful shutdown. Fly sends SIGTERM on
// every deploy and machine stop, and an upload can be several seconds of parse
// and database writes holding the ingest lock — severing those mid-flight is
// how a replay gets a document with no blob. What is deliberately NOT carried
// over is socket activation, LISTEN_FDS and the keep-alive/headers timeout
// envs: nothing sets them here (see fly.toml). If a future adapter-node grows
// something else in index.js, this file is where it has to be noticed — that
// drift is the standing cost of wrapping it.
import http from 'node:http';
import { handler } from './build/handler.js';
import { ART_CACHE_CONTROL, isArtPath } from './artPaths.js';

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const SHUTDOWN_TIMEOUT = parseInt(process.env.SHUTDOWN_TIMEOUT ?? '30', 10);

const server = http.createServer((req, res) => {
	// what counts as art, and the policy it gets, live in artPaths.js so they can
	// be tested without opening a socket
	if (isArtPath(req.url)) {
		res.setHeader('Cache-Control', ART_CACHE_CONTROL);
	}
	// Deliberately nothing for anything else. Pages here carry a strong ETag and
	// no Last-Modified, so a browser has nothing to compute heuristic freshness
	// from and revalidates anyway; a blanket header would change how every SSR
	// and session-bearing route is cached, for no measured gain.
	handler(req, res);
});

let shuttingDown;

/** Stop taking work, let what is in flight finish, then let the process go. */
function gracefulShutdown(reason) {
	if (shuttingDown) return;
	// keep-alive connections sit idle holding the server open, and close() waits
	// for them rather than closing them, so they go first
	server.closeIdleConnections();
	shuttingDown = setTimeout(() => server.closeAllConnections(), SHUTDOWN_TIMEOUT * 1000);
	server.close(() => {
		clearTimeout(shuttingDown);
		process.emit('sveltekit:shutdown', reason);
	});
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

server.listen(PORT, HOST, () => {
	console.log(`uar-website listening on http://${HOST}:${PORT}`);
});
