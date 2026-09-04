import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeHits, playerHit, playerRef } from '../src/lib/mentions.ts';
import { ANON_PORTRAIT } from '../src/lib/portrait.ts';

const thing = (i: number) => ({ kind: 'item' as const, id: `i${i}`, name: `Item ${i}`, icon: null, ref: `[[item:i${i}]]` });

test('a player is written by handle with the name to show, the brackets and bars kept out', () => {
	assert.equal(playerRef('2-S2-1-1809580', 'KanaxStratz'), '[[player:2-S2-1-1809580|KanaxStratz]]');
	assert.equal(playerRef('2-S2-1-1', 'a|b]c'), '[[player:2-S2-1-1|abc]]');
	assert.equal(playerRef('2-S2-1-1', ''), '[[player:2-S2-1-1|2-S2-1-1]]');
	const h = playerHit({ toon: '2-S2-1-1', name: 'Kanax', clan: 'UAR', avatarUrl: null });
	assert.equal(h.name, '<UAR> Kanax');
	assert.equal(h.ref, '[[player:2-S2-1-1|Kanax]]');
});

test('the game things come first, players after, within the limit', () => {
	const things = Array.from({ length: 8 }, (_, i) => thing(i));
	const players = [{ toon: '2-S2-1-1', name: 'A', clan: '', avatarUrl: null }, { toon: '2-S2-1-2', name: 'B', clan: '', avatarUrl: null }];
	const out = mergeHits(things, players);
	assert.equal(out.length, 10);
	assert.deepEqual(out.slice(8).map((h) => h.kind), ['player', 'player']);
	assert.equal(mergeHits(things, []).length, 8);
	assert.deepEqual(mergeHits([thing(0)], players).map((h) => h.kind), ['item', 'player', 'player']);
	// spelling a name: that player leads
	const kanax = [{ toon: '2-S2-1-3', name: 'KanaxStratz', clan: '', avatarUrl: null }, ...players];
	assert.deepEqual(mergeHits(things, kanax, 10, 'kan').slice(0, 2).map((h) => h.name), ['KanaxStratz', 'Item 0']);
	assert.equal(mergeHits(things, kanax, 10, 'kan').filter((h) => h.kind === 'player').length, 3);
});

test('a player with no portrait on record gets the stock one, so the row and the chip show a person', () => {
	const bare = playerHit({ toon: '2-S2-1-2', name: 'Nobody', clan: '', avatarUrl: null });
	assert.equal(bare.icon, ANON_PORTRAIT);
	const pictured = playerHit({ toon: '2-S2-1-3', name: 'Someone', clan: '', avatarUrl: 'https://static.starcraft2.com/x/1-1.jpg' });
	assert.equal(pictured.icon, 'https://static.starcraft2.com/x/1-1.jpg');
});
