/** Unit tests for the shape and rules of community builds (npm test). */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
	BUILD_LIMITS,
	SKILL_LEVELS_FALLBACK,
	allText,
	allowedIn,
	blocksFromSections,
	buildHref,
	countBlocks,
	imageRefs,
	levelOfPoint,
	readBlocks,
	readBuildForm,
	skillCounts,
	slugify,
	summarize,
	validateBuild,
	validateComment,
	threadComments,
	countThreads,
	replyDepth,
	COMMENT_DEPTH_MAX,
	commentRecipients,
	excerptOf,
	playerRefsIn,
	validateChat,
	rating,
	formatRating,
	ratingTone,
	type Block,
	type BuildContext,
	type BuildInput,
	type MapMark
} from '../src/lib/builds.ts';

const ctx: BuildContext = {
	skills: [
		{ id: 'SoldierSkills', name: 'Soldier Skills', levels: 4 },
		{ id: 'Security', name: 'Security', levels: null }
	],
	modes: ['Normal', 'Hard'],
	ranks: ['en', 'co'],
	points: 6,
	levelMax: 6,
	sis: [
		{ num: 1, name: 'Reactive Fire', choices: [], tracks: ['en', 'wo', 'co'] },
		{ num: 9, name: 'Intellectual', choices: [], tracks: ['wo', 'co'] },
		{ num: 17, name: 'Battle Buddy', choices: ['rifleman', 'jim'], tracks: ['en', 'wo', 'co'] }
	],
	mapSize: 256,
	regions: ['Thalim', 'Cavern 1 for Satchel'],
	placed: ['AmmoCase2']
};

const ID_A = '0123456789abcdef';
const ID_B = 'fedcba9876543210';

const md = (text: string): Block => ({ type: 'markdown', text });
const good = (over: Partial<BuildInput> = {}): BuildInput => ({
	title: 'Sentries on the north crates',
	modes: ['Hard'],
	ranks: [],
	skills: ['SoldierSkills', 'Security', 'Security'],
	sis: [{ num: 17, choice: 'jim' }],
	blocks: [
		{
			type: 'section',
			title: 'Opening',
			children: [md('Put the first sentry on the crate by the gate, facing the road.')]
		}
	],
	publish: true,
	...over
});

test('a well-formed build passes, cleaned', () => {
	const v = validateBuild(good({ modes: ['Hard', 'Hard'] }), ctx);
	assert.equal(v.ok, true);
	if (!v.ok) return;
	assert.deepEqual(v.value.modes, ['Hard']);
	assert.deepEqual(v.value.skills, ['SoldierSkills', 'Security', 'Security']);
	assert.equal(v.value.publish, true);
});

test('each rule refuses in words', () => {
	const err = (input: BuildInput) => {
		const v = validateBuild(input, ctx);
		assert.equal(v.ok, false);
		return v.ok ? '' : v.error;
	};
	assert.match(err(good({ title: 'ab' })), /title/i);
	assert.match(err(good({ title: 'x'.repeat(BUILD_LIMITS.title.max + 1) })), /title/i);
	assert.match(err(good({ blocks: [] })), /block/i);
	assert.match(err(good({ blocks: [md('short')] })), /few lines/i);
	assert.match(err(good({ modes: ['Casual'] })), /game mode/i);
	assert.match(err(good({ sis: [{ num: 99 }] })), /skill identifiers/i);
	assert.match(err(good({ sis: [{ num: 17, choice: 'nobody' }] })), /choices/i);
	assert.match(err(good({ sis: [{ num: 1, choice: 'jim' }] })), /choices/i);
	assert.deepEqual(
		(validateBuild(good({ sis: [{ num: 17, choice: 'jim' }, { num: 1 }, { num: 17 }] }), ctx) as { value: BuildInput }).value.sis,
		[{ num: 17, choice: 'jim' }, { num: 1 }]
	);
	assert.match(err(good({ skills: ['Nope'] })), /skill/i);
	// a known level count caps the points; Security's null falls back
	assert.match(err(good({ skills: Array(5).fill('SoldierSkills') })), /only 4 levels/);
	assert.equal(validateBuild(good({ skills: Array(SKILL_LEVELS_FALLBACK).fill('Security') }), ctx).ok, true);
	assert.match(err(good({ skills: Array(SKILL_LEVELS_FALLBACK + 1).fill('Security') })), /only 5 levels/);
	// the game's own cap on points, in the words a player knows
	assert.match(
		err(good({ skills: ['SoldierSkills', 'SoldierSkills', 'Security', 'Security', 'Security', 'Security', 'Security'] })),
		/6 skill points, one per level up to level 6/
	);
	const many = Array.from({ length: BUILD_LIMITS.images + 1 }, (_, i) =>
		`![](img:${i.toString(16).padStart(16, '0')})`
	).join('\n');
	assert.match(err(good({ blocks: [md(many + '\nand some words too')] })), /pictures/i);
});

test('containers nest the guides\' way and no further', () => {
	assert.deepEqual(allowedIn(null), ['section', 'columns', 'markdown', 'table', 'map']);
	assert.deepEqual(allowedIn('section'), ['columns', 'markdown', 'table', 'map']);
	assert.deepEqual(allowedIn('columns'), ['markdown', 'table', 'map']);
	const err = (blocks: Block[]) => {
		const v = validateBuild(good({ blocks }), ctx);
		return v.ok ? '' : v.error;
	};
	const long = md('enough words to pass the minimum easily, and then some');
	assert.match(err([{ type: 'section', title: 'a', children: [{ type: 'section', title: 'b', children: [long] }] }]), /section/i);
	assert.match(err([{ type: 'columns', columns: [[{ type: 'columns', columns: [[long], [long]] }], [long]] }]), /column/i);
	assert.match(err([{ type: 'columns', columns: [[long]] }]), /abreast/);
	assert.equal(err([{ type: 'columns', columns: [[long], [long], [long]] }]), '');
	assert.equal(err([{ type: 'section', title: 'a', children: [{ type: 'columns', columns: [[long], [long]] }] }]), '');
});

test('tables and maps are checked against the data', () => {
	const err = (blocks: Block[]) => {
		const v = validateBuild(good({ blocks }), ctx);
		return v.ok ? '' : v.error;
	};
	const pad = md('enough words to pass the minimum easily, and then some');
	const col = (label: string) => ({ label, align: 'left' as const });
	assert.equal(err([pad, { type: 'table', columns: [col('a'), col('b')], rows: [['1', '2']] }]), '');
	assert.match(err([pad, { type: 'table', columns: [col('a'), col('b')], rows: [['1']] }]), /cell per column/);
	assert.match(err([pad, { type: 'table', columns: [], rows: [] }]), /columns/);
	const map = (marks: MapMark[]): Block => ({ type: 'map', title: '', caption: '', marks });
	assert.equal(err([pad, map([{ kind: 'pin', tone: 'mos', label: 'City Guard', at: { region: 'Thalim' } }])]), '');
	assert.equal(err([pad, map([{ kind: 'dots', tone: 'item', label: 'scraps', placed: 'AmmoCase2' }])]), '');
	assert.match(err([pad, map([{ kind: 'pin', tone: 'mos', label: 'x', at: { region: 'Nowhere' } }])]), /no region called "Nowhere"/);
	assert.match(err([pad, map([{ kind: 'pin', tone: 'mos', label: 'x', at: { x: 300, y: 10 } }])]), /off the map/);
	assert.match(err([pad, map([{ kind: 'pin', tone: 'mos', label: 'x' }])]), /needs a place/);
	assert.match(err([pad, map([{ kind: 'dots', tone: 'item', label: 'x', placed: 'Nope' }])]), /placed object/);
});

test('readBlocks tolerates junk and pads table rows; readBuildForm reads the fields', () => {
	assert.deepEqual(readBlocks('not json'), []);
	assert.deepEqual(readBlocks('{"a":1}'), []);
	assert.deepEqual(
		readBlocks('[{"type":"markdown","text":"a\\r\\nb  "},{"type":"nope"},{"type":"table","columns":[{"label":"x","align":"weird"},{"label":"y","align":"right","wide":true}],"rows":[["1"],["1","2","3"]]},{"type":"map","marks":[{"kind":"pin","tone":"mos","label":" p ","at":{"x":1,"y":2},"side":"left"},{"kind":"dots","tone":"item","label":"d","placed":"AmmoCase2"},{"kind":"area","at":{"region":" Thalim "}}]}]'),
		[
			{ type: 'markdown', text: 'a\nb' },
			{
				type: 'table',
				columns: [{ label: 'x', align: 'left' }, { label: 'y', align: 'right', wide: true }],
				rows: [['1', ''], ['1', '2']]
			},
			{
				type: 'map',
				title: '',
				caption: '',
				marks: [
					{ kind: 'pin', tone: 'mos', label: 'p', at: { x: 1, y: 2 }, side: 'left' },
					{ kind: 'dots', tone: 'item', label: 'd', placed: 'AmmoCase2' },
					{ kind: 'area', tone: 'accent', label: '', at: { region: 'Thalim' } }
				]
			}
		]
	);
	// a container past the depth limit is dropped rather than kept (what may
	// sit where is validation's question, not the reader's)
	const deep = JSON.stringify([
		{ type: 'section', title: 'a', children: [{ type: 'columns', columns: [[{ type: 'section', title: 'b', children: [{ type: 'columns', columns: [[md('x')]] }] }]] }] }
	]);
	assert.deepEqual(readBlocks(deep), [
		{ type: 'section', title: 'a', children: [{ type: 'columns', columns: [[{ type: 'section', title: 'b', children: [] }]] }] }
	]);

	const form = new FormData();
	form.set('title', '  My build ');
	form.append('modes', 'Hard');
	form.append('modes', 'Normal');
	form.set('skills', 'SoldierSkills, Security,,Security ');
	form.set('sis', '[{"num":17,"choice":"jim"},{"num":"1"},{"num":"x"},5]');
	form.set('blocks', JSON.stringify([{ type: 'markdown', text: 'text\r\nmore  \n' }]));
	form.set('intent', 'publish');
	const input = readBuildForm(form);
	assert.equal(input.title, 'My build');
	assert.deepEqual(input.modes, ['Hard', 'Normal']);
	assert.deepEqual(input.skills, ['SoldierSkills', 'Security', 'Security']);
	assert.deepEqual(input.sis, [{ num: 17, choice: 'jim' }, { num: 1 }]);
	assert.deepEqual(input.blocks, [{ type: 'markdown', text: 'text\nmore' }]);
	assert.equal(input.publish, true);
	assert.equal(readBuildForm(new FormData()).publish, false);
});

test('the old sections become blocks', () => {
	assert.deepEqual(
		blocksFromSections([
			{ title: 'Opening', columns: ['left', 'right'] },
			{ title: '', columns: ['alone'] },
			{ title: 'Later', columns: ['one'] }
		]),
		[
			{ type: 'section', title: 'Opening', children: [{ type: 'columns', columns: [[md('left')], [md('right')]] }] },
			md('alone'),
			{ type: 'section', title: 'Later', children: [md('one')] }
		]
	);
});

test('the text of a build is its markdown and its cells, pictures found once', () => {
	const blocks: Block[] = [
		{ type: 'section', title: 's', children: [{ type: 'columns', columns: [[md(`![one](img:${ID_A}) and ![two](img:${ID_B} "t")`)], [md(`![again](img:${ID_A})`)]] }] },
		{ type: 'table', columns: [{ label: 'a', align: 'left' }], rows: [['![no](https://elsewhere/x.png) ![bad](img:zzz) cell']] }
	];
	assert.deepEqual(imageRefs(blocks), [ID_A, ID_B]);
	assert.equal(countBlocks(blocks), 5);
	assert.match(allText(blocks), /cell$/);
});

test('summarize keeps the words and drops the syntax', () => {
	const blocks: Block[] = [
		{ type: 'map', title: 'm', caption: '', marks: [] },
		md(`![shot](img:${ID_A})\n## Where\n- Put **two** [[item:Sentry|sentries]] by the [gate](/map).\n\nSecond paragraph.`)
	];
	assert.equal(summarize(blocks), 'Where Put two sentries by the gate.');
	const s = summarize([md(Array(60).fill('word').join(' '))], 50);
	assert.ok(s.length <= 50);
	assert.ok(s.endsWith('…'));
	assert.equal(summarize([md('')]), '');
	assert.equal(summarize([]), '');
});

test('slugify makes a URL segment and never an empty one', () => {
	assert.equal(slugify('Sentries on the North Crates!'), 'sentries-on-the-north-crates');
	assert.equal(slugify('  Éclaireur   rapide '), 'eclaireur-rapide');
	assert.equal(slugify('!!!'), 'build');
	assert.equal(slugify('x'.repeat(100)).length, 60);
	assert.equal(buildHref('CombatEngineer', 'my-build'), '/mos/CombatEngineer/guides/my-build');
	assert.equal(buildHref('CombatEngineer', 'my-build', true), '/mos/CombatEngineer/guides/my-build/edit');
});

test('the point at index i arrives with level i + 1', () => {
	assert.equal(levelOfPoint(0), 1);
	assert.equal(levelOfPoint(19), 20);
	assert.equal(levelOfPoint(3, 2), 2);
});

test('a comment is words, chips and a few pictures', () => {
	assert.deepEqual(validateComment('  Nice one, [[Security]] at 3 works.\r\n'), {
		ok: true,
		text: 'Nice one, [[Security]] at 3 works.',
		images: []
	});
	assert.equal(validateComment(' ').ok, false);
	assert.equal(validateComment('x'.repeat(BUILD_LIMITS.comment.max + 1)).ok, false);
	const r = validateComment(`look ![](img:${ID_A}) and again ![](img:${ID_A})`);
	assert.deepEqual(r.ok ? r.images : null, [ID_A]);
	const many = Array.from({ length: BUILD_LIMITS.comment.images + 1 }, (_, i) => `![](img:${String(i).padStart(16, '0')})`).join(' ');
	assert.match(validateComment(many).ok ? '' : (validateComment(many) as { error: string }).error, /at most/);
});

test('a guide names only the rank tracks its class is open to, and SIs those tracks sell', () => {
	const err = (i: BuildInput) => {
		const r = validateBuild(i, ctx);
		return r.ok ? '' : r.error;
	};
	const v = validateBuild(good({ ranks: ['co', 'co', 'en'] }), ctx);
	assert.ok(v.ok);
	assert.deepEqual(v.ok ? v.value.ranks : null, ['co', 'en']);
	assert.match(err(good({ ranks: ['wo'] })), /rank track/i);
	// Intellectual is not sold to the Enlisted; it is to a Commissioned Officer, and to anyone when no rank is set
	assert.match(err(good({ ranks: ['en'], sis: [{ num: 9 }] })), /Intellectual is not sold on the Enlisted track/);
	assert.ok(validateBuild(good({ ranks: ['co'], sis: [{ num: 9 }] }), ctx).ok);
	assert.ok(validateBuild(good({ ranks: [], sis: [{ num: 9 }] }), ctx).ok);
	assert.ok(validateBuild(good({ ranks: ['en', 'co'], sis: [{ num: 9 }] }), ctx).ok);
	// a class open to one track: the track is the guide's, said or not; another is still refused
	const one: BuildContext = { ...ctx, ranks: ['co'] };
	const v1 = validateBuild(good({ ranks: [] }), one);
	assert.deepEqual(v1.ok ? v1.value.ranks : null, ['co']);
	assert.equal(validateBuild(good({ ranks: ['en'] }), one).ok, false);
	// and Intellectual is then checked against that track
	assert.ok(validateBuild(good({ ranks: [], sis: [{ num: 9 }] }), one).ok);
});

test('a comment is news to the one answered and to the guide author, each once, never the writer', () => {
	assert.deepEqual(commentRecipients({ commenter: 'a', owner: 'b' }), [{ sub: 'b', kind: 'comment' }]);
	assert.deepEqual(commentRecipients({ commenter: 'a', owner: 'b', parentAuthor: 'c' }), [
		{ sub: 'c', kind: 'reply' },
		{ sub: 'b', kind: 'comment' }
	]);
	// the guide author answered: one reply, not a reply and a comment
	assert.deepEqual(commentRecipients({ commenter: 'a', owner: 'b', parentAuthor: 'b' }), [{ sub: 'b', kind: 'reply' }]);
	// the author on their own guide, answering themselves: nothing
	assert.deepEqual(commentRecipients({ commenter: 'b', owner: 'b', parentAuthor: 'b' }), []);
	// a class thread has no owner; a stump has no author
	assert.deepEqual(commentRecipients({ commenter: 'a', parentAuthor: '' }), []);
	assert.deepEqual(commentRecipients({ commenter: 'a', parentAuthor: 'c' }), [{ sub: 'c', kind: 'reply' }]);
});

test('a chat message is short, words and chips, no pictures', () => {
	assert.deepEqual(validateChat('  hi [[Security]] \r\n'), { ok: true, text: 'hi [[Security]]' });
	assert.equal(validateChat('   ').ok, false);
	assert.equal(validateChat('x'.repeat(BUILD_LIMITS.chat.max + 1)).ok, false);
	assert.match((validateChat(`look ![](img:${ID_A})`) as { error: string }).error, /pictures/);
});

test('the players a text pings, by handle, each once', () => {
	assert.deepEqual(playerRefsIn('hey [[player:2-S2-1-1809580|Kanax]] and {{player:2-S2-1-9|B}} and [[player:2-S2-1-1809580]] and [[player:nobody]]'), ['2-S2-1-1809580', '2-S2-1-9']);
	assert.deepEqual(playerRefsIn('nothing'), []);
});

test('an excerpt is the first words as plain text', () => {
	assert.equal(excerptOf('Put [[skill:Security]] at 3, then `F1`.\n\nAnd ![gate](img:0123456789abcdef) here.'), 'Put Security at 3, then F1. And [picture] here.');
	assert.equal(excerptOf('[[unit:Interceptor|the drones]] **hold**'), 'the drones hold');
	assert.equal(excerptOf('x'.repeat(200)).length, 140);
	assert.ok(excerptOf('x'.repeat(200)).endsWith('…'));
});

test('a build is marked out of ten by the share of its votes that went up', () => {
	assert.equal(rating(0, 0), null);
	assert.equal(rating(), null);
	assert.equal(rating(45, 10), 8.2);
	assert.equal(rating(44, 9), 8.3);
	assert.equal(rating(1, 0), 10);
	assert.equal(rating(0, 3), 0);
	assert.equal(formatRating(10), '10');
	assert.equal(formatRating(8.2), '8.2');
	assert.equal(formatRating(8), '8');
	assert.deepEqual([9, 7, 6.9, 4, 3.9].map(ratingTone), ['good', 'good', 'mid', 'mid', 'low']);
});

test('comments thread under what they answer, best first, and a stump only stands over answers', () => {
	const c = (id: string, parent: string | null, score: number, t: number, extra = {}) => ({
		id,
		parent,
		score,
		createdAt: `2026-08-28T00:0${t}:00Z`,
		...extra
	});
	const list = [
		c('a', null, 1, 1),
		c('b', null, 5, 2),
		c('c', 'a', 0, 3),
		c('d', 'a', 2, 4),
		c('e', 'd', 0, 5, { hidden: true }),
		c('f', 'e', 0, 6),
		c('g', null, 0, 7, { deleted: true }),
		c('h', null, 0, 8, { deleted: true }),
		c('i', 'h', 0, 9),
		c('j', 'zz', 0, 1)
	];
	const t = threadComments(list, (x) => !('hidden' in x));
	// best first at the top: b (5), a (1), then the orphan j and the stump h, oldest first among ties
	assert.deepEqual(t.map((x) => x.node.id), ['b', 'a', 'j', 'h']);
	const a = t[1];
	assert.deepEqual(a.replies.map((x) => x.node.id), ['d', 'c']);
	// e is hidden from this reader, and takes f with it
	assert.equal(a.replies[0].replies.length, 0);
	// g is a stump with nothing under it; h stands because i answers it
	assert.deepEqual(t[3].replies.map((x) => x.node.id), ['i']);
	assert.equal(t[3].replies[0].depth, 1);
	assert.equal(countThreads(t), 7);
	assert.equal(replyDepth(list, null), 0);
	assert.equal(replyDepth(list, 'a'), 1);
	assert.equal(replyDepth(list, 'f'), 4);
	assert.equal(COMMENT_DEPTH_MAX, 8);
});

test('skillCounts groups points by skill in first-seen order', () => {
	assert.deepEqual(skillCounts(['b', 'a', 'b', 'b']), [
		{ id: 'b', points: 3 },
		{ id: 'a', points: 1 }
	]);
});
