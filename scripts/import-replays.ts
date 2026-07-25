/**
 * Pull new UAR replays from the local StarCraft II folder into static/replays/
 * and refresh players.json — pure Node/TS replacement for import_replays.py.
 *
 * Usage: node scripts/import-replays.ts [sc2-replay-folder]
 */

import { readFileSync, writeFileSync, readdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseReplay } from '../src/lib/server/replay/extract.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEST = join(ROOT, 'static', 'replays');
const MAP_TITLE = 'Undead Assault reborn';
const DEFAULT_SRC = join(
	homedir(),
	'Games/battlenet/drive_c/users/steamuser/Documents/StarCraft II',
	'Accounts/121480455/2-S2-1-1809580/Replays/Multiplayer'
);

const src = process.argv[2] ?? DEFAULT_SRC;
const mosIds = new Set<string>(
	(JSON.parse(readFileSync(join(ROOT, 'src', 'lib', 'data', 'mos.json'), 'utf8')) as { id: string }[]).map(
		(m) => m.id
	)
);

let imported = 0;
for (const name of readdirSync(src).filter((f) => f.endsWith('.SC2Replay')).sort()) {
	const path = join(src, name);
	let title: string, playedAt: string;
	try {
		({ title, playedAt } = parseReplay(name, readFileSync(path), mosIds));
	} catch (e) {
		console.log(`  ! unreadable, skipped: ${name} (${e})`);
		continue;
	}
	if (title !== MAP_TITLE) continue;
	const stamp = playedAt.replace(/[-:]/g, '').slice(0, 13).replace('T', '-');
	const target = join(DEST, `${stamp}.SC2Replay`);
	if (existsSync(target)) continue;
	copyFileSync(path, target);
	imported++;
	console.log(`imported ${stamp}.SC2Replay  (${name})`);
}

console.log(`${imported} new replay(s)`);
if (imported) {
	execFileSync(process.execPath, [join(ROOT, 'scripts', 'extract-players.ts')], { stdio: 'inherit' });
	console.log('players.json refreshed — review, commit and tag to deploy');
}
