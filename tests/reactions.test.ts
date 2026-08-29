import test from 'node:test';
import assert from 'node:assert/strict';
import { REACTIONS, REACTORS_SHOWN, isReaction, reactionViews } from '../src/lib/reactions.ts';

test('the faces a page draws: counted ones only, palette order, the reader lit', () => {
	assert.deepEqual(reactionViews(undefined), []);
	assert.deepEqual(reactionViews({ '🔥': 2, '👍': 1, '😂': 0 }, ['🔥']), [
		{ emoji: '👍', n: 1, mine: false, who: [] },
		{ emoji: '🔥', n: 2, mine: true, who: [] }
	]);
	assert.equal(REACTIONS.length, 8);
	assert.equal(isReaction('👍'), true);
	assert.equal(isReaction('🙃'), false);
	assert.equal(isReaction(1), false);
});

test('who is behind a face rides along, capped, with the count keeping the rest', () => {
	const kanax = { name: 'Kanax', toon: '1-S2-1-1', avatar: 'a.jpg' };
	const many = Array.from({ length: REACTORS_SHOWN + 3 }, (_, i) => ({
		name: `p${i}`,
		toon: null,
		avatar: null
	}));
	const [thumb, fire] = reactionViews({ '👍': 1, '🔥': many.length }, [], {
		'👍': [kanax],
		'🔥': many
	});
	assert.deepEqual(thumb.who, [kanax]);
	// the pill still says how many there are; the card only names the first few
	assert.equal(fire.n, many.length);
	assert.equal(fire.who.length, REACTORS_SHOWN);
	assert.equal(fire.who[0].name, 'p0');
});
