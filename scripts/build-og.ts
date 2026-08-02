/**
 * Draws the share cards every page unfurls with, into `static/og/`, so the
 * normal static pipeline picks them up. Runs as the first pass of
 * `npm run build` (see package.json) — the output is generated, gitignored,
 * and regenerated from `src/lib/data/*.json` on every build, which is what
 * keeps a card honest after a data refresh.
 *
 * Rendering is resvg (a devDependency): the Docker builder is Alpine with no
 * system fonts and no librsvg, so the fonts are vendored next to this script
 * and system-font lookup is turned off — otherwise every card would render
 * with the text silently missing.
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { tooltipProse } from '../src/lib/seo.ts';
import {
	entityCard,
	fitText,
	mosCard,
	wrapText,
	type Card,
	type CardMos,
	type CardUnit
} from '../src/lib/ogcard.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* Read straight off disk rather than through $lib/units.ts: those modules
   import their JSON through the $lib alias, which only a bundler resolves. */
const units: CardUnit[] = JSON.parse(
	await readFile(join(ROOT, 'src/lib/data/units.json'), 'utf8')
);
/** Every class with a page — `mos/[id]/+page.ts` generates one per entry. */
const allMos: CardMos[] = JSON.parse(await readFile(join(ROOT, 'src/lib/data/mos.json'), 'utf8'));
/** …of which the roster is the pickable ones; piloted vehicles have a page but no slot. */
const selectableMos = allMos.filter((m) => m.selectable !== false);
const OUT = join(ROOT, 'static/og');
const FONTS = join(ROOT, 'scripts/fonts');

const W = 1200;
const H = 630;
const PAD = 88;
/**
 * Portrait box. Exactly 2× the 128px source, drawn without interpolation
 * (see `image-rendering` below): a smooth upscale invents gradients across
 * every edge, which is both softer to look at and roughly twice the PNG.
 */
const ART = 256;
const COL_X = PAD + ART + 44;
const COL_W = W - COL_X - PAD;
/** Without a portrait the text takes the whole card. */
const WIDE_X = PAD;
const WIDE_W = W - 2 * PAD;

/* The dark palette, matching the site's dark theme token for token. */
const C = {
	ink: '#e2e0d1',
	ink2: '#a3a891',
	ink3: '#757b65',
	accent: '#8db566',
	mark: '#52713d',
	surface: '#1b1f16',
	border: '#454d38',
	panel: '#23281c'
};

function esc(s: string): string {
	return s.replace(/[&<>"']/g, (c) =>
		c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&apos;'
	);
}

/** Backdrop, brand row and footer — identical on every card. */
function frame(): string {
	return `
	<defs>
		<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0%" stop-color="#14170f"/><stop offset="100%" stop-color="#0c0f07"/>
		</linearGradient>
		<linearGradient id="glow" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0%" stop-color="${C.accent}" stop-opacity="0.16"/>
			<stop offset="100%" stop-color="${C.accent}" stop-opacity="0"/>
		</linearGradient>
		<pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
			<path d="M40 0H0V40" fill="none" stroke="${C.accent}" stroke-opacity="0.055" stroke-width="1"/>
		</pattern>
		<clipPath id="art"><rect x="${PAD}" y="196" width="${ART}" height="${ART}" rx="20"/></clipPath>
	</defs>
	<rect width="${W}" height="${H}" fill="url(#bg)"/>
	<rect width="${W}" height="${H}" fill="url(#grid)"/>
	<rect width="${W}" height="320" fill="url(#glow)"/>
	<rect x="0" y="0" width="10" height="${H}" fill="${C.accent}"/>

	<rect x="${PAD}" y="56" width="60" height="60" rx="13" fill="${C.panel}"/>
	<rect x="${PAD + 3}" y="59" width="54" height="54" rx="10" fill="${C.mark}"/>
	<text x="${PAD + 30}" y="96" text-anchor="middle" fill="#f1efe8"
		font-family="JetBrains Mono Medium" font-size="19" letter-spacing="0.8">UAR</text>
	<text x="${PAD + 78}" y="94" fill="${C.accent}"
		font-family="JetBrains Mono Medium" font-size="18" letter-spacing="3.6">UNIT DATABASE</text>

	<text x="${PAD}" y="574" fill="${C.ink3}"
		font-family="Inter" font-size="21">uar.cedricdessalles.dev</text>`;
}

/** Chips run left to right and stop at the edge rather than overflowing it. */
function chipRow(chips: string[], x: number, width: number, y: number): string {
	const SIZE = 20;
	const out: string[] = [];
	let cursor = x;
	for (const chip of chips) {
		const w = Math.round(chip.length * SIZE * 0.62) + 36;
		if (cursor + w > x + width) break;
		out.push(
			`<rect x="${cursor}" y="${y}" width="${w}" height="48" rx="24" fill="${C.surface}" stroke="${C.border}"/>` +
				`<text x="${cursor + w / 2}" y="${y + 31}" text-anchor="middle" fill="#d3d1bf" ` +
				`font-family="JetBrains Mono Medium" font-size="${SIZE}">${esc(chip)}</text>`
		);
		cursor += w + 14;
	}
	return out.join('\n\t');
}

async function iconTag(icon: string | null): Promise<string> {
	if (!icon) return '';
	try {
		const bytes = await readFile(join(ROOT, 'static', icon.replace(/^\//, '')));
		const href = `data:image/png;base64,${bytes.toString('base64')}`;
		return (
			`<rect x="${PAD}" y="196" width="${ART}" height="${ART}" rx="20" fill="${C.panel}"/>` +
			`<image href="${href}" x="${PAD}" y="196" width="${ART}" height="${ART}" ` +
			`image-rendering="optimizeSpeed" preserveAspectRatio="xMidYMid slice" clip-path="url(#art)"/>` +
			`<rect x="${PAD}" y="196" width="${ART}" height="${ART}" rx="20" fill="none" stroke="${C.border}"/>`
		);
	} catch {
		// a name in the data with no file behind it: draw the card without art
		return '';
	}
}

async function cardSvg(card: Card): Promise<string> {
	const art = await iconTag(card.icon);
	const x = art ? COL_X : WIDE_X;
	const width = art ? COL_W : WIDE_W;

	const name = fitText(card.name, width, { max: 72, min: 30, em: 0.6 });
	const eyebrow = fitText(card.eyebrow, width, { max: 19, min: 13, em: 0.68 });

	/* The block grows downward from the eyebrow, so a long name that had to
	   shrink does not leave a gap and a two-line blurb does not collide with
	   the chips: each row is placed after the one above it. */
	const eyebrowY = 232;
	const nameY = eyebrowY + 24 + name.size * 0.76;
	const PROSE = 25;
	const lines = card.prose ? wrapText(card.prose, width, PROSE, 0.52, 2) : [];
	const proseY = nameY + 44;
	const chipsY = Math.max(proseY + lines.length * (PROSE + 8) + 12, 424);

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
	${frame()}
	${art}
	<text x="${x}" y="${eyebrowY}" fill="${C.accent}" font-family="JetBrains Mono Medium"
		font-size="${eyebrow.size}" letter-spacing="2.6">${esc(eyebrow.text)}</text>
	<text x="${x}" y="${nameY}" fill="${C.ink}" font-family="Inter"
		font-weight="700" font-size="${name.size}" letter-spacing="-1">${esc(name.text)}</text>
	${lines
		.map(
			(line, i) =>
				`<text x="${x}" y="${proseY + i * (PROSE + 8)}" fill="${C.ink2}" font-family="Inter" font-size="${PROSE}">${esc(line)}</text>`
		)
		.join('\n\t')}
	${chipRow(card.chips, x, width, chipsY)}
</svg>`;
}

const FONT_FILES = [
	join(FONTS, 'Inter-Regular.ttf'),
	join(FONTS, 'Inter-Bold.ttf'),
	join(FONTS, 'JetBrainsMono-Medium.ttf')
];

function render(svg: string): Buffer {
	const resvg = new Resvg(svg, {
		font: { loadSystemFonts: false, fontFiles: FONT_FILES, defaultFontFamily: 'Inter' },
		fitTo: { mode: 'width', value: W }
	});
	return resvg.render().asPng();
}

/** The card a page falls back to: the site itself, not one of its subjects. */
function siteCard(): Card {
	return {
		eyebrow: 'STARCRAFT II ARCADE',
		name: 'Undead Assault Reborn',
		prose: 'Unit database, player stats and replays for the arcade map.',
		chips: [
			`${units.length} entities`,
			`${selectableMos.length} classes`,
			'player stats',
			'replays'
		],
		icon: null
	};
}

async function main(): Promise<void> {
	// a stale card for a unit the extractor has since dropped is worse than no
	// card, and this is the only place that knows the full set
	await rm(OUT, { recursive: true, force: true });
	await mkdir(join(OUT, 'entities'), { recursive: true });
	await mkdir(join(OUT, 'mos'), { recursive: true });

	await writeFile(join(OUT, 'site.png'), render(await cardSvg(siteCard())));

	let n = 1;
	for (const u of units) {
		const svg = await cardSvg(entityCard(u, tooltipProse(u.tooltip)));
		await writeFile(join(OUT, 'entities', `${u.id}.png`), render(svg));
		n++;
	}
	for (const m of allMos) {
		const svg = await cardSvg(mosCard(m, tooltipProse(m.tooltip)));
		await writeFile(join(OUT, 'mos', `${m.id}.png`), render(svg));
		n++;
	}
	console.log(`og: ${n} cards`);
}

await main();
