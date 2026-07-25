/**
 * Rebuild the golden fixture (tests/fixtures/players.golden.json) from
 * static/replays/ — pure Node/TS,
 * no Python needed. Same output, byte for byte, as scripts/extract_players.py.
 *
 * Usage: node scripts/extract-players.ts [--out <path>]
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseReplay, buildPlayersData } from '../src/lib/server/replay/extract.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPLAY_DIR = join(ROOT, 'static', 'replays');
const outFlag = process.argv.indexOf('--out');
const OUT = outFlag > -1 ? process.argv[outFlag + 1] : join(ROOT, 'tests', 'fixtures', 'players.golden.json');

const mosIds = new Set<string>(
	(JSON.parse(readFileSync(join(ROOT, 'src', 'lib', 'data', 'mos.json'), 'utf8')) as { id: string }[]).map(
		(m) => m.id
	)
);

const files = readdirSync(REPLAY_DIR)
	.filter((f) => f.endsWith('.SC2Replay'))
	.sort();
if (!files.length) {
	console.error(`no replays found in ${REPLAY_DIR}`);
	process.exit(1);
}

const parsed = files.map((file) => {
	const path = join(REPLAY_DIR, file);
	const replay = parseReplay(file, readFileSync(path), mosIds);
	console.log(`${file}: ${replay.playedAt}, ${replay.sightings.length} profiles`);
	if (!replay.protocolExact) {
		console.warn(`  ! no exact protocol for base build ${replay.baseBuild}, used fallback`);
	}
	return { replay, size: statSync(path).size };
});

const data = buildPlayersData(parsed);
writeFileSync(OUT, JSON.stringify(data, null, '\t') + '\n');
console.log(`wrote ${OUT}: ${data.players.length} players from ${files.length} replays`);
