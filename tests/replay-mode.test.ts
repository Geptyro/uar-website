/**
 * The one constant in mode detection that is not derivable: which dialog
 * control ids the map's twelve mode buttons got (see MODE_VOTE_BUTTONS).
 *
 * The committed fixtures are two real UAR recordings whose player clicked
 * Recruit in the opening vote and left. That click is the anchor: it pins the
 * base of the run of button ids to something recorded in a real game rather
 * than to a number someone typed. A future version of the map that adds a
 * dialog control before the mode dialog will shift the run, and this test
 * cannot see that — what catches it is `replayModes` settling won games from
 * the save-file win counters, which needs no constant at all.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MPQArchive } from '../src/lib/server/replay/mpq.ts';
import {
	getProtocol,
	decodeReplayHeader,
	decodeReplayGameEvents
} from '../src/lib/server/replay/protocol.ts';
import { MODE_VOTE_BUTTONS, parseReplay } from '../src/lib/server/replay/extract.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, 'fixtures');
const mosIds = new Set<string>(
	(
		JSON.parse(
			readFileSync(join(HERE, '..', 'src', 'lib', 'data', 'mos.json'), 'utf8')
		) as { id: string }[]
	).map((m) => m.id)
);

/** Dialog controls the recording's players clicked, in order. */
function clickedControls(name: string): { user: number; control: number; loop: number }[] {
	const data = new Uint8Array(readFileSync(join(FIXTURES, `${name}.SC2Replay`)));
	const archive = new MPQArchive(data);
	const header = decodeReplayHeader(archive.userDataContent);
	const protocol = getProtocol(header.m_version.m_baseBuild as number);
	const out: { user: number; control: number; loop: number }[] = [];
	for (const ev of decodeReplayGameEvents(protocol, archive.readFile('replay.game.events')!)) {
		if (!(ev._event as string).endsWith('STriggerDialogControlEvent')) continue;
		if (ev.m_eventType !== 0) continue; // 0 = clicked
		out.push({
			user: ev._userid.m_userId as number,
			control: ev.m_controlId as number,
			loop: ev._gameloop as number
		});
	}
	return out;
}

test('the twelve mode buttons run at a stride of four, in creation order', () => {
	assert.equal(MODE_VOTE_BUTTONS.size, 12);
	const ids = [...MODE_VOTE_BUTTONS.keys()];
	for (let i = 1; i < ids.length; i++) assert.equal(ids[i] - ids[i - 1], 4);
	// gt_ModeSelect_Func: the five difficulties, Apocalypse, then the centre
	// column (Survival, PMC, PMC+) and the right one (Competitive, Invasion,
	// Infested)
	assert.deepEqual([...MODE_VOTE_BUTTONS.values()], [1, 2, 3, 4, 5, 12, 7, 8, 11, 6, 9, 10]);
});

test('fixture clicks land on the mode buttons the map built', () => {
	for (const name of ['20260723-1802', '20260723-1808']) {
		const clicks = clickedControls(name);
		// both recordings are one player opening the vote and picking the top
		// of the left column, which is Recruit
		const vote = clicks.find((c) => MODE_VOTE_BUTTONS.has(c.control));
		assert.ok(vote, `${name}: no click landed on a mode button`);
		assert.equal(MODE_VOTE_BUTTONS.get(vote.control), 1, `${name}: expected a Recruit vote`);
		// and it happened in the opening seconds, where the vote runs
		assert.ok(vote.loop < 16 * 60, `${name}: vote at loop ${vote.loop} is past the window`);
	}
});

test('a recording that stopped inside the vote settles no mode', () => {
	// one player's ballot is not the lobby's: both fixtures end while the vote
	// is still open, so the parser has to say it does not know
	for (const name of ['20260723-1802', '20260723-1808']) {
		const parsed = parseReplay(
			`${name}.SC2Replay`,
			readFileSync(join(FIXTURES, `${name}.SC2Replay`)),
			mosIds
		);
		assert.equal(parsed.mode, null, name);
	}
});
