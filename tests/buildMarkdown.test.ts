/** Unit tests for the build markdown allow-list (npm test). */

import test from 'node:test';
import assert from 'node:assert/strict';
import { looseTables, renderBuildMarkdown, type RefResolver } from '../src/lib/buildMarkdown.ts';

const ID = '0123456789abcdef';

test('raw HTML comes out as the characters typed, inline and as a block', () => {
	assert.equal(renderBuildMarkdown('a <b>bold</b> b'), '<p>a &lt;b&gt;bold&lt;/b&gt; b</p>\n');
	assert.equal(
		renderBuildMarkdown('<script>alert(1)</script>'),
		'<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>\n'
	);
	assert.equal(renderBuildMarkdown('`<i>`'), '<p><code>&lt;i&gt;</code></p>\n');
	assert.equal(renderBuildMarkdown('```\n<i>\n```'), '<pre><code>&lt;i&gt;</code></pre>\n');
	assert.equal(renderBuildMarkdown('a \\* b & c'), '<p>a * b &amp; c</p>\n');
});

test('links go to the web, this site or an anchor, and nowhere script-shaped', () => {
	assert.equal(
		renderBuildMarkdown('[x](https://example.com/a?b=1)'),
		'<p><a href="https://example.com/a?b=1" target="_blank" rel="nofollow noopener noreferrer">x</a></p>\n'
	);
	assert.equal(renderBuildMarkdown('[map](/map)'), '<p><a href="/map">map</a></p>\n');
	assert.equal(renderBuildMarkdown('[x](javascript:alert(1))'), '<p>x</p>\n');
	assert.equal(renderBuildMarkdown('[x](//evil)'), '<p>x</p>\n');
	assert.equal(renderBuildMarkdown('[x](/a "t\\"")'), '<p><a href="/a" title="t&quot;">x</a></p>\n');
});

test('pictures are the site\'s own, and one on its own line is a figure', () => {
	assert.equal(
		renderBuildMarkdown(`![north gate](img:${ID})`),
		`<figure class="md-fig"><img src="/guides/img/${ID}.webp" alt="north gate" loading="lazy"><figcaption>north gate</figcaption></figure>\n`
	);
	assert.equal(
		renderBuildMarkdown(`![](img:${ID})`),
		`<figure class="md-fig"><img src="/guides/img/${ID}.webp" alt="" loading="lazy"></figure>\n`
	);
	// inline with words it stays a paragraph
	assert.match(renderBuildMarkdown(`see ![a](img:${ID}) here`), /^<p>see <figure/);
	// anywhere else is just its caption
	assert.equal(renderBuildMarkdown('![x](https://elsewhere/a.png)'), '<p>x</p>\n');
	assert.equal(renderBuildMarkdown('![x](img:nope)'), '<p>x</p>\n');
});

test('a backticked key is a key cap, other code is code, and [[key:…]] spells one out', () => {
	assert.equal(renderBuildMarkdown('press `F1` or `Q`, group `2`'), '<p>press <kbd>F1</kbd> or <kbd>Q</kbd>, group <kbd>2</kbd></p>\n');
	assert.equal(renderBuildMarkdown('costs `45 energy`'), '<p>costs <code>45 energy</code></p>\n');
	assert.equal(renderBuildMarkdown('[[key:Ctrl+F]] and [[key:x|the X key]]'), '<p><kbd>Ctrl+F</kbd> and <kbd>the X key</kbd></p>\n');
});

test('headings start one below the page\'s own, and a new line is a new line', () => {
	assert.equal(renderBuildMarkdown('# A'), '<h2>A</h2>\n');
	assert.equal(renderBuildMarkdown('### A'), '<h4>A</h4>\n');
	assert.equal(renderBuildMarkdown('###### A'), '<h4>A</h4>\n');
	assert.equal(renderBuildMarkdown('one\ntwo'), '<p>one<br>two</p>\n');
	assert.equal(renderBuildMarkdown('- a\n- b'), '<ul>\n<li>a</li>\n<li>b</li>\n</ul>\n');
});

test('tables come through, since a shop list is one', () => {
	const html = renderBuildMarkdown('| item | scraps |\n|---|---:|\n| Sentry | 25 |');
	assert.equal(
		html,
		'<div class="tablewrap"><table class="data"><thead><tr><th>item</th><th class="num">scraps</th></tr></thead><tbody><tr><td>Sentry</td><td class="num">25</td></tr></tbody></table></div>\n'
	);
});

test('a table nobody gave a |---| line still is one, first row as header', () => {
	assert.equal(looseTables('| test lol | ok good |\n| a | b |'), '| test lol | ok good |\n|---|---|\n| a | b |');
	// one that already has its line is left alone, and so is a fence
	assert.equal(looseTables('| a |\n|---|\n| b |'), '| a |\n|---|\n| b |');
	assert.equal(looseTables('```\n| a |\n| b |\n```'), '```\n| a |\n| b |\n```');
	const html = renderBuildMarkdown('| test lol | ok good |\n| a | b |');
	assert.match(html, /^<div class="tablewrap"><table class="data">/);
	assert.match(html, /<th>test lol<\/th>/);
	assert.match(html, /<td>a<\/td>/);
});

test('references become chips through the resolver, and stay visible without one', () => {
	const refs: RefResolver = (kind, ref) => {
		if ((kind === null || kind === 'item') && ref === 'Sentry Gun') {
			return { kind: 'item', name: 'Sentry Gun', href: '/entities/SentryGun', icon: '/icons/sg.png' };
		}
		if (kind === 'unit' && ref === 'Zombie') {
			return { kind: 'unit', name: 'Zombie', href: '/entities/Zombie', icon: null, tip: 'Slow & "hungry"' };
		}
		if (kind === 'skill' && ref === 'Security') {
			return { kind: 'skill', name: 'Security', href: null, icon: null };
		}
		return null;
	};
	assert.equal(
		renderBuildMarkdown('put a [[Sentry Gun]] here', refs),
		'<p>put a <a class="ref ref-item" href="/entities/SentryGun" data-tip="" data-tip-name="Sentry Gun" data-tip-icon="/icons/sg.png"><img class="ref-icon" src="/icons/sg.png" alt="" loading="lazy">Sentry Gun</a> here</p>\n'
	);
	assert.equal(
		renderBuildMarkdown('[[item:Sentry Gun|the gun]]', refs),
		'<p><a class="ref ref-item" href="/entities/SentryGun" data-tip="" data-tip-name="Sentry Gun" data-tip-icon="/icons/sg.png"><img class="ref-icon" src="/icons/sg.png" alt="" loading="lazy">the gun</a></p>\n'
	);
	// no icon in the data: the class pages' initials tile stands in
	assert.equal(
		renderBuildMarkdown('[[skill:Security]]', refs),
		'<p><span class="ref ref-skill"><span class="ref-icon ph">S</span>Security</span></p>\n'
	);
	assert.equal(
		renderBuildMarkdown('[[skill:Nope]] and [[<b>]]', refs),
		'<p><span class="ref ref-missing">[[skill:Nope]]</span> and <span class="ref ref-missing">[[&lt;b&gt;]]</span></p>\n'
	);
	// the in-game text rides along for the hover card, escaped
	assert.equal(
		renderBuildMarkdown('[[unit:Zombie]]', refs),
		'<p><a class="ref ref-unit" href="/entities/Zombie" data-tip="Slow &amp; &quot;hungry&quot;" data-tip-name="Zombie"><span class="ref-icon ph">Z</span>Zombie</a></p>\n'
	);
	// braces are the entry form: icon beside a bold name, no pill
	assert.equal(
		renderBuildMarkdown('{{item:Sentry Gun|the gun}}', refs),
		'<p><a class="ref-entry ref-entry-item" href="/entities/SentryGun" data-tip="" data-tip-name="Sentry Gun" data-tip-icon="/icons/sg.png"><img class="ref-entry-icon" src="/icons/sg.png" alt="" loading="lazy"><b>the gun</b></a></p>\n'
	);
	assert.equal(
		renderBuildMarkdown('{{skill:Security}}', refs),
		'<p><span class="ref-entry ref-entry-skill"><span class="ref-entry-icon ph">S</span><b>Security</b></span></p>\n'
	);
	// mismatched brackets are just text
	assert.equal(renderBuildMarkdown('[[Sentry Gun}} x', refs), '<p>[[Sentry Gun}} x</p>\n');
	// without a resolver nothing resolves, and an ordinary link still works
	assert.match(renderBuildMarkdown('[[Sentry Gun]]'), /ref-missing/);
	assert.equal(renderBuildMarkdown('[a](/b)'), '<p><a href="/b">a</a></p>\n');
});

test('a player chip wears the name it was written with, a mission its own', () => {
	const refs = (kind: string | null, ref: string) =>
		kind === 'player' && /^\d+-S2-\d+-\d+$/.test(ref)
			? { kind: 'player' as const, name: ref, href: `/players/${ref}`, icon: null, tip: null }
			: kind === 'mission' && ref === 'city-guard'
				? { kind: 'mission' as const, name: 'The City Guard', href: '/triggers/city-guard', icon: null, tip: 'Scraps in, add-ons out' }
				: null;
	assert.equal(
		renderBuildMarkdown('[[player:2-S2-1-1809580|KanaxStratz]]', refs),
		'<p><a class="ref ref-player" href="/players/2-S2-1-1809580"><span class="ref-icon ph">K</span>KanaxStratz</a></p>\n'
	);
	assert.match(renderBuildMarkdown('[[mission:city-guard]]', refs), /class="ref ref-mission" href="\/triggers\/city-guard" data-tip="Scraps in, add-ons out"[^>]*><span class="ref-icon ph">TC<\/span>The City Guard/);
	// a handle that is not one stays as typed
	assert.match(renderBuildMarkdown('[[player:nobody]]', refs), /ref-missing/);
});
