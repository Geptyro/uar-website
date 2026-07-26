import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	buildChangelog,
	compareVersions,
	latestVersion,
	parseEntry,
	renderMarkdown
} from '../src/lib/changelog.ts';

test('parseEntry reads frontmatter and body', () => {
	const e = parseEntry('---\ntitle: Clans\ntype: feature\narea: players\n---\nClan pages.\n');
	assert.deepEqual(e, { title: 'Clans', type: 'feature', area: 'players', body: 'Clan pages.' });
});

test('parseEntry falls back on missing or unknown fields', () => {
	assert.deepEqual(parseEntry('just a body'), {
		title: '',
		type: 'improvement',
		area: 'site',
		body: 'just a body'
	});
	const e = parseEntry('---\ntitle: X\ntype: bogus\narea: nowhere\n---\nbody');
	assert.equal(e.type, 'improvement');
	assert.equal(e.area, 'site');
});

test('renderMarkdown handles paragraphs, lists and inline marks', () => {
	assert.equal(renderMarkdown('One **two** `three`.\n\nNext.'), '<p>One <strong>two</strong> <code>three</code>.</p>\n<p>Next.</p>');
	assert.equal(renderMarkdown('- a\n- b'), '<ul><li>a</li><li>b</li></ul>');
	assert.equal(renderMarkdown('See [players](/players).'), '<p>See <a href="/players">players</a>.</p>');
});

test('renderMarkdown escapes HTML and rejects unsafe link schemes', () => {
	assert.equal(renderMarkdown('a <b> & "c"'), '<p>a &lt;b&gt; &amp; &quot;c&quot;</p>');
	assert.equal(renderMarkdown('[x](javascript:alert(1))'), '<p>[x](javascript:alert(1))</p>');
});

test('renderMarkdown leaves bold/link syntax literal inside code spans', () => {
	assert.equal(renderMarkdown('`**not bold**`'), '<p><code>**not bold**</code></p>');
});

test('compareVersions is numeric, not lexicographic', () => {
	assert.ok(compareVersions('v0.2.15', 'v0.2.9') > 0);
	assert.ok(compareVersions('v0.10.0', 'v0.9.9') > 0);
	assert.equal(compareVersions('v1.2.3', 'v1.2.3'), 0);
});

test('latestVersion picks the max version from glob keys', () => {
	assert.equal(
		latestVersion([
			'/changelog/v0.2.9/a.md',
			'/changelog/v0.2.15/b.md',
			'/changelog/v0.1.0/c.md'
		]),
		'v0.2.15'
	);
	assert.equal(latestVersion([]), null);
});

test('buildChangelog groups by version, newest first, features before fixes', () => {
	const releases = buildChangelog(
		{
			'/changelog/v0.1.0/launch.md': '---\ntitle: Launch\ntype: feature\narea: site\n---\nHi.',
			'/changelog/v0.2.0/fix.md': '---\ntitle: A fix\ntype: fix\narea: wiki\n---\nFixed.',
			'/changelog/v0.2.0/feat.md': '---\ntitle: A feature\ntype: feature\narea: wiki\n---\nNew.'
		},
		{
			'/changelog/v0.1.0/release.json': { date: '2026-07-24' },
			'/changelog/v0.2.0/release.json': { date: '2026-07-25' }
		}
	);
	assert.deepEqual(
		releases.map((r) => r.version),
		['v0.2.0', 'v0.1.0']
	);
	assert.equal(releases[0].date, '2026-07-25');
	assert.deepEqual(
		releases[0].entries.map((e) => e.title),
		['A feature', 'A fix']
	);
	assert.equal(releases[1].entries[0].html, '<p>Hi.</p>');
});
