/**
 * The markdown a community build is written in, and the HTML it becomes.
 *
 * Players write it and everyone reads it, so this is an allow-list, not a
 * sanitiser: the renderer emits only the elements named here, with the
 * attributes named here, and anything else in the text (a raw tag, a script
 * URL, a picture from elsewhere) comes out as the characters typed. Raw HTML
 * is escaped rather than stripped, so an author sees what happened to it.
 *
 * Two things a guide may embed beyond plain markdown:
 *
 * - Pictures, and only the site's own: `![what it shows](img:<id>)`, where
 *   the id is what the upload endpoint handed back. An `<img>` pointing
 *   anywhere else is a request every reader's browser makes to someone
 *   else's server, and this site does not send its readers anywhere they did
 *   not click.
 * - References to the game's own things: `[[skill:Security]]`,
 *   `[[ability:Craft]]`, `[[item:Sentry Gun]]`, `[[mos:CombatEngineer]]`,
 *   `[[si:Scraps Scanner]]`, `[[unit:Zombie]]`, or just `[[Sentry Gun]]` to
 *   look everywhere. Each becomes the chip the site draws for it, icon and
 *   link included, so a guide reads like the hand-written guides do. The
 *   same thing in braces, `{{ability:Craft}}`, is the guide's other look for
 *   it: the icon beside a bold name, no pill, for the first column of a
 *   table or the head of a list item. What a reference resolves
 *   to comes from outside (`RefResolver`, built by $lib/buildRefs from the
 *   game data), which keeps this module free of data and loadable by
 *   node:test.
 *
 * Runs on the server for the page and in the browser for the editor's
 * preview, from the same code, so what an author sees while writing is what
 * is published. No `$lib/server` here.
 */

import { Marked, type Tokens } from 'marked';
import { imageUrl } from './builds.ts';

export const REF_KINDS = ['skill', 'ability', 'item', 'effect', 'mos', 'si', 'unit', 'mission', 'player'] as const;
export type RefKind = (typeof REF_KINDS)[number];

/** What a `[[…]]` points at, as the resolver answers it. */
export interface RefTarget {
	kind: RefKind;
	name: string;
	/** Its page, or null for a thing that has none (a chip without a link). */
	href: string | null;
	icon: string | null;
	/** Its in-game description, shown on hover (see BuildBody). */
	tip?: string | null;
	/** A hover card the server built (a player's), escaped HTML; shown in place of `tip`. */
	tipHtml?: string | null;
}

/** `kind` is null for the bare `[[name]]` form: look everywhere. */
export type RefResolver = (kind: string | null, ref: string) => RefTarget | null;

const esc = (s: string) =>
	s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');

const IMG = /^img:([0-9a-f]{16})$/;
/** Where a link may go: the web, this site, or an anchor. Nothing script-shaped. */
const SAFE_HREF = /^(?:https?:\/\/|\/(?!\/)|#)/i;
/** `[[kind:ref]]`, `[[kind:ref|label]]`, `[[ref]]`, `[[ref|label]]`, and the same in `{{ }}`. */
const REF = /^(\[\[|\{\{)(?:([a-z]+):)?([^\]}|\n]+?)(?:\|([^\]}\n]+))?(\]\]|\}\})/;

/** The page's own heading is the class name in the top bar; a guide's start one below it. */
const headingLevel = (depth: number) => Math.min(depth + 1, 4);

/**
 * A backticked key is drawn as a key cap: `F1`, `Q`, `2` (a control group),
 * `Ctrl`. Narrow on purpose, since a backticked `4` in "costs `4`" is not a
 * key; anything longer is written `[[key:Ctrl+F]]`.
 */
const KEY = /^(?:F\d{1,2}|[A-Z0-9]|Ctrl|Shift|Alt|Tab|Esc|Enter|Space|Del)$/;

/** Stand-in for the few things the map ships without an icon: the class pages' initials tile. */
const initials = (name: string) =>
	(name.match(/[A-Za-z0-9]+/g) ?? [])
		.slice(0, 2)
		.map((w) => w[0].toUpperCase())
		.join('');

interface RefToken {
	type: 'ref';
	raw: string;
	kind: string | null;
	ref: string;
	label: string | null;
	/** `[[…]]` is a chip; `{{…}}` is an entry, icon beside a bold name. */
	style: 'chip' | 'entry';
}

/*
 * The resolver for the render in progress. Parsing is synchronous, so setting
 * it around one `parse` call is safe, and it spares building a Marked
 * instance (tokenizers, extensions and all) per render.
 */
let resolver: RefResolver | null = null;

const md = new Marked({
	gfm: true,
	// a new line is a new line: players write the way they type in chat
	breaks: true,
	extensions: [
		{
			name: 'ref',
			level: 'inline',
			start: (src: string) => {
				const a = src.indexOf('[[');
				const b = src.indexOf('{{');
				return a < 0 ? b : b < 0 ? a : Math.min(a, b);
			},
			tokenizer(src: string): RefToken | undefined {
				const m = REF.exec(src);
				if (!m) return undefined;
				// the brackets must match: `[[x}}` is not a reference
				if ((m[1] === '[[') !== (m[5] === ']]')) return undefined;
				return {
					type: 'ref',
					raw: m[0],
					kind: m[2] ?? null,
					ref: m[3].trim(),
					label: m[4]?.trim() ?? null,
					style: m[1] === '[[' ? 'chip' : 'entry'
				};
			},
			renderer(token) {
				const t = token as RefToken;
				// a key cap needs no data: `[[key:Ctrl+F]]`
				if (t.kind === 'key') return `<kbd>${esc(t.label ?? t.ref)}</kbd>`;
				const target = resolver?.(t.kind, t.ref) ?? null;
				// left as typed, and marked as such, so the author sees it in the preview
				if (!target) return `<span class="ref ref-missing">${esc(t.raw)}</span>`;
				const label = esc(t.label ?? target.name);
				const base = t.style === 'entry' ? 'ref-entry' : 'ref';
				// a thing with no picture shows its initials: the words on the chip, when the
				// author gave some (a player's chip carries the name, its ref the handle)
				const icon = target.icon
					? `<img class="${base}-icon" src="${esc(target.icon)}" alt="" loading="lazy">`
					: `<span class="${base}-icon ph">${esc(initials(t.label ?? target.name))}</span>`;
				const cls = `${base} ${base}-${target.kind}`;
				const tipName = t.kind === 'player' ? (t.label ?? target.name) : target.name;
				// a card whenever there is something to show: words, a built card, or at least the picture
				const tip =
					target.tip || target.tipHtml || target.icon
						? ` data-tip="${esc(target.tip ?? '')}" data-tip-name="${esc(tipName)}"${target.icon ? ` data-tip-icon="${esc(target.icon)}"` : ''}${target.tipHtml ? ` data-tip-html="${esc(target.tipHtml)}"` : ''}`
						: '';
				const inner = t.style === 'entry' ? `${icon}<b>${label}</b>` : `${icon}${label}`;
				return target.href
					? `<a class="${cls}" href="${esc(target.href)}"${tip}>${inner}</a>`
					: `<span class="${cls}"${tip}>${inner}</span>`;
			}
		}
	],
	renderer: {
		html({ text, block }: Tokens.HTML | Tokens.Tag) {
			return block ? `<p>${esc(text)}</p>\n` : esc(text);
		},
		text(token: Tokens.Text | Tokens.Escape) {
			if ('tokens' in token && token.tokens) return this.parser.parseInline(token.tokens);
			return 'escaped' in token && token.escaped ? token.text : esc(token.text);
		},
		code({ text }: Tokens.Code) {
			return `<pre><code>${esc(text)}</code></pre>\n`;
		},
		codespan({ text }: Tokens.Codespan) {
			return KEY.test(text) ? `<kbd>${esc(text)}</kbd>` : `<code>${esc(text)}</code>`;
		},
		heading({ tokens, depth }: Tokens.Heading) {
			const h = headingLevel(depth);
			return `<h${h}>${this.parser.parseInline(tokens)}</h${h}>\n`;
		},
		link({ href, title, tokens }: Tokens.Link) {
			const inner = this.parser.parseInline(tokens);
			if (!SAFE_HREF.test(href)) return inner;
			const external = /^https?:/i.test(href);
			const attrs =
				`href="${esc(href)}"` +
				(title ? ` title="${esc(title)}"` : '') +
				(external ? ' target="_blank" rel="nofollow noopener noreferrer"' : '');
			return `<a ${attrs}>${inner}</a>`;
		},
		image({ href, text }: Tokens.Image) {
			const m = IMG.exec(href.trim());
			if (!m) return esc(text);
			const alt = esc(text);
			return (
				`<figure class="md-fig"><img src="${imageUrl(m[1])}" alt="${alt}" loading="lazy">` +
				(text ? `<figcaption>${alt}</figcaption>` : '') +
				`</figure>`
			);
		},
		/* The site's own table: `table.data` in a `.tablewrap` (styled in the root
		   layout), so a shop list in a guide looks like the one in the hand-written
		   guide. A right-aligned column is a `num` column, as it is there. */
		table({ header, rows }: Tokens.Table) {
			const cell = (c: Tokens.TableCell, tag: 'th' | 'td') => {
				const cls = c.align === 'right' ? ' class="num"' : '';
				return `<${tag}${cls}>${this.parser.parseInline(c.tokens)}</${tag}>`;
			};
			const head = `<tr>${header.map((c) => cell(c, 'th')).join('')}</tr>`;
			const body = rows.map((r) => `<tr>${r.map((c) => cell(c, 'td')).join('')}</tr>`).join('');
			return `<div class="tablewrap"><table class="data"><thead>${head}</thead><tbody>${body}</tbody></table></div>\n`;
		},
		paragraph({ tokens }: Tokens.Paragraph) {
			// a picture on a line of its own is a figure, not a paragraph with a
			// figure in it (which is not HTML a browser agrees with)
			const meaningful = tokens.filter((t) => !(t.type === 'text' && !t.text.trim()));
			const only = meaningful.length === 1 ? meaningful[0] : null;
			if (only?.type === 'image' && IMG.test((only as Tokens.Image).href.trim())) {
				return `${this.parser.parseInline(meaningful)}\n`;
			}
			return `<p>${this.parser.parseInline(tokens)}</p>\n`;
		}
	}
});

const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_DELIM = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

/**
 * Tables without the `|---|---|` line under their first row. GFM needs it and
 * nobody remembers it, so a run of `| a | b |` rows gets one put in, which
 * makes the first row the header (the help says so). Inside a code fence
 * nothing is touched.
 */
export function looseTables(source: string): string {
	const lines = source.split('\n');
	const out: string[] = [];
	let fence = false;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (/^\s*```/.test(line)) fence = !fence;
		out.push(line);
		if (fence) continue;
		const prev = lines[i - 1] ?? '';
		const next = lines[i + 1] ?? '';
		if (TABLE_ROW.test(line) && !TABLE_ROW.test(prev) && !TABLE_DELIM.test(next)) {
			const cells = line.trim().slice(1, -1).split('|').length;
			out.push(`|${Array(cells).fill('---').join('|')}|`);
		}
	}
	return out.join('\n');
}

/**
 * One column's markdown as HTML. Synchronous: nothing here is async. Without
 * a resolver every `[[…]]` renders as missing, which is what the tests want
 * and what a page must never do.
 */
export function renderBuildMarkdown(source: string, refs: RefResolver | null = null): string {
	resolver = refs;
	try {
		return md.parse(looseTables(source), { async: false }) as string;
	} finally {
		resolver = null;
	}
}

/** A table cell, or any one line: inline markdown only, no paragraphs or blocks. */
export function renderBuildInline(source: string, refs: RefResolver | null = null): string {
	resolver = refs;
	try {
		return md.parseInline(source, { async: false }) as string;
	} finally {
		resolver = null;
	}
}

/** What the editor tells an author they can type. */
export const MARKDOWN_HELP: { syntax: string; means: string }[] = [
	{ syntax: '## Heading', means: 'a heading inside the column' },
	{ syntax: '**bold** and *italic*', means: 'emphasis' },
	{ syntax: '- item', means: 'a list; 1. for a numbered one' },
	{ syntax: '| a | b |', means: 'a table, one row per line; the first row is the header' },
	{ syntax: '> note', means: 'a quote' },
	{ syntax: '`Q`', means: 'a key cap (F1, Q, 2, Ctrl…); other backticked text is code' },
	{ syntax: '[[key:Ctrl+F]]', means: 'a key cap for anything longer' },
	{ syntax: '[text](https://…)', means: 'a link' },
	{ syntax: '@sen', means: 'type @ and a few letters to search skills, items, classes, SIs and hostiles; pick one and it becomes a chip' },
	{ syntax: '[[skill:Security|the trap]]', means: 'a chip written by hand, naming the kind and the words to show' },
	{ syntax: '[[mission:…]] · [[player:…|Name]]', means: 'a mission, or a player by handle: the @ search writes these' },
	{ syntax: '{{ability:Craft}}', means: 'the same as an entry: the icon beside a bold name, for the first column of a table or the head of a list item' },
	{ syntax: '![what it shows](img:…)', means: 'a picture you uploaded; the button writes this for you' }
];
