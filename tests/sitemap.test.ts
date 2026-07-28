/** Unit tests for the sitemap serialiser (npm test). */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sitemapDate, sitemapXml, xmlEscape } from '../src/lib/sitemap.ts';

const ORIGIN = 'https://uar.cedricdessalles.dev';

test('sitemapXml wraps every path in a <url> under the origin', () => {
	const xml = sitemapXml(ORIGIN, [{ path: '/' }, { path: '/entities/AA12' }]);
	assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n'));
	assert.ok(xml.includes('<loc>https://uar.cedricdessalles.dev/</loc>'));
	assert.ok(xml.includes('<loc>https://uar.cedricdessalles.dev/entities/AA12</loc>'));
	assert.equal(xml.match(/<url>/g)?.length, 2);
	assert.ok(xml.trimEnd().endsWith('</urlset>'));
});

test('sitemapXml emits lastmod and priority only when given', () => {
	const xml = sitemapXml(ORIGIN, [
		{ path: '/a', priority: 1 },
		{ path: '/b', lastmod: '2026-07-28' },
		{ path: '/c' }
	]);
	assert.equal(xml.match(/<priority>/g)?.length, 1);
	assert.ok(xml.includes('<priority>1.0</priority>'));
	assert.equal(xml.match(/<lastmod>/g)?.length, 1);
	assert.ok(xml.includes('<lastmod>2026-07-28</lastmod>'));
});

test('sitemapXml escapes what a clan tag can put in a URL', () => {
	// tags come out of a game lobby, so & and < are both reachable
	const xml = sitemapXml(ORIGIN, [{ path: '/clans/' + encodeURIComponent('A&B') }]);
	assert.ok(xml.includes('/clans/A%26B'), xml);
	assert.ok(!/<loc>[^<]*&(?!amp;)/.test(xml), 'no bare ampersand inside a <loc>');
});

test('xmlEscape covers the five XML entities', () => {
	assert.equal(xmlEscape(`&<>"'`), '&amp;&lt;&gt;&quot;&apos;');
});

test('sitemapDate reduces a timestamp to a day, and rejects nonsense', () => {
	assert.equal(sitemapDate('2026-07-28T14:33:02.000Z'), '2026-07-28');
	assert.equal(sitemapDate('not a date'), undefined);
	assert.equal(sitemapDate(''), undefined);
	assert.equal(sitemapDate(null), undefined);
});

test('an empty sitemap is still valid XML', () => {
	const xml = sitemapXml(ORIGIN, []);
	assert.ok(xml.includes('<urlset'));
	assert.ok(xml.includes('</urlset>'));
	assert.ok(!xml.includes('<url>'));
});
