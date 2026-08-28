import test from 'node:test';
import assert from 'node:assert/strict';
import { REACTIONS, isReaction, reactionViews } from '../src/lib/reactions.ts';

test('the faces a page draws: counted ones only, palette order, the reader lit', () => {
	assert.deepEqual(reactionViews(undefined), []);
	assert.deepEqual(reactionViews({ '🔥': 2, '👍': 1, '😂': 0 }, ['🔥']), [
		{ emoji: '👍', n: 1, mine: false },
		{ emoji: '🔥', n: 2, mine: true }
	]);
	assert.equal(REACTIONS.length, 8);
	assert.equal(isReaction('👍'), true);
	assert.equal(isReaction('🙃'), false);
	assert.equal(isReaction(1), false);
});
