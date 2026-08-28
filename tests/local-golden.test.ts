/**
 * Extended golden test — only runs when the full local replay set is present
 * (static/replays/ is gitignored; CI skips this). Rebuilds players data from
 * every local replay and compares it against the committed golden
 * tests/fixtures/players.golden.json, which was verified byte-identical against the
 * reference Python pipeline. Covers the multi-sector MPQ path and full
 * multi-player banks that the small committed fixtures can't.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseReplay, buildPlayersData, type ParsedReplay } from '../src/lib/server/replay/extract.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'static', 'replays');
const GOLDEN = join(ROOT, 'tests', 'fixtures', 'players.golden.json');

const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.SC2Replay')).sort() : [];
const golden = JSON.parse(readFileSync(GOLDEN, 'utf8'));
const haveGoldenSet = files.length && golden.replays.every((r: { file: string }) => files.includes(r.file));

test('local golden: full replay set reproduces committed players.json', { skip: !haveGoldenSet }, () => {
	const mosIds = new Set<string>(
		(JSON.parse(readFileSync(join(ROOT, 'src', 'lib', 'data', 'mos.json'), 'utf8')) as { id: string }[]).map(
			(m) => m.id
		)
	);
	const parsed = golden.replays.map((r: { file: string }) => {
		const path = join(DIR, r.file);
		return { replay: parseReplay(r.file, readFileSync(path), mosIds), size: statSync(path).size };
	});
	assert.deepEqual(JSON.parse(JSON.stringify(buildPlayersData(parsed))), golden);
});

/* The committed fixtures are a solo game and a 26-second recording, in which
   nobody hosts a lobby of others, dies, or leaves mid-game; the local set has
   two full twelve-player lobbies. */
test('local replays: full lobbies carry a host, deaths and dead time', { skip: !haveGoldenSet }, () => {
	const mosIds = new Set<string>(
		(JSON.parse(readFileSync(join(ROOT, 'src', 'lib', 'data', 'mos.json'), 'utf8')) as { id: string }[]).map(
			(m) => m.id
		)
	);
	const full: ParsedReplay[] = golden.replays
		.filter((r: { players: number }) => r.players >= 8)
		.map((r: { file: string }) => parseReplay(r.file, readFileSync(join(DIR, r.file)), mosIds));
	assert.ok(full.length >= 1);
	// not asserted: `result`. The engine writes one only for GameOver calls the
	// recording client was still there for, and neither local lobby has any
	for (const parsed of full) {
		assert.ok(parsed.mapChecksum > 0, 'map checksum');
		assert.equal(parsed.sightings.filter((s) => s.host).length, 1, 'exactly one host');
		assert.ok(parsed.sightings.some((s) => s.deaths), 'someone died');
		for (const s of parsed.sightings) {
			if (s.leftLoop !== undefined) assert.equal(typeof s.leftReason, 'number');
			if (s.deadLoops) assert.ok(s.deadLoops <= parsed.gameLoops, 'dead time within the game');
		}
	}
});
