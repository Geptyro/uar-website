import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankBonusAt, rankRewardsForMos, rankStacks, type RankTrack } from '../src/lib/ranks.ts';

const PER = { speed: 0.0117, rangedDamage: 0.015, life: -4 };

function track(n: number, offset: number, ranks: number): RankTrack {
	return {
		track: n,
		name: `Track ${n}`,
		icon: null,
		bonus: { ...PER, offset },
		ranks: Array.from({ length: ranks }, (_, i) => ({
			idx: i + 1,
			icon: null,
			xp: i * 1000,
			prefix: `R${i + 1}`,
			name: `Rank ${i + 1}`
		}))
	};
}

const enlisted = track(1, -1, 13);
const warrant = track(2, 4, 5);
const officer = track(3, 4, 10);

test('enlisted starts with no stacks, the other two start five ahead', () => {
	assert.equal(rankStacks(enlisted, 1), 0);
	assert.equal(rankStacks(warrant, 1), 5);
	assert.equal(rankStacks(officer, 1), 5);
});

test('stacks at the top of each track', () => {
	assert.equal(rankStacks(enlisted, 13), 12);
	assert.equal(rankStacks(warrant, 5), 9);
	assert.equal(rankStacks(officer, 10), 14);
});

test('a track with no buff never reports stacks', () => {
	const bare: RankTrack = { ...enlisted, bonus: undefined };
	assert.equal(rankStacks(bare, 13), 0);
	assert.equal(rankBonusAt(bare, 13), null);
});

test('totals multiply out without float noise', () => {
	// 0.0117 * 12 lands on 0.14040000000000002 unrounded
	assert.deepEqual(rankBonusAt(enlisted, 13), {
		stacks: 12,
		speed: 0.1404,
		rangedDamage: 0.18,
		life: -48
	});
	assert.deepEqual(rankBonusAt(officer, 10), {
		stacks: 14,
		speed: 0.1638,
		rangedDamage: 0.21,
		life: -56
	});
});

test('rewards are collected per class, in track then rank order', () => {
	const withRewards = [enlisted, warrant, officer].map((t) => ({
		...t,
		ranks: t.ranks.map((r) => ({
			...r,
			rewards:
				r.idx === t.ranks.length
					? [
							{
								mos: 'Rifleman',
								id: `Reward${t.track}`,
								kind: 'ability' as const,
								name: `Reward ${t.track}`,
								icon: null,
								tooltip: ''
							}
						]
					: undefined
		}))
	}));
	const got = rankRewardsForMos(withRewards, 'Rifleman');
	assert.deepEqual(
		got.map((r) => [r.track, r.rankIdx, r.id]),
		[
			[1, 13, 'Reward1'],
			[2, 5, 'Reward2'],
			[3, 10, 'Reward3']
		]
	);
	assert.equal(rankRewardsForMos(withRewards, 'CombatMedic').length, 0);
});
