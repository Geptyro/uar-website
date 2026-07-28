/**
 * Site-wide SEO facts, and the templates that turn extracted map data into a
 * page's title and description. Kept free of imports so plain `node --test`
 * can load it (see CLAUDE.md) — callers pass the shapes they already hold.
 */

/**
 * Canonical origin, hard-coded rather than read from the request. Most pages
 * are prerendered, and at prerender time `url.origin` is SvelteKit's internal
 * host — every canonical and og:url would point at that instead of the site.
 */
export const SITE_URL = 'https://uar.cedricdessalles.dev';
export const SITE_NAME = 'UAR Unit Database';
export const GAME = 'Undead Assault Reborn';

/** The share card a page falls back to. Absolute: a relative og:image is
 *  ignored by Discord and Twitter alike. */
export const OG_IMAGE = `${SITE_URL}/og/site.png`;
/** Every card is drawn at this size, so the dimensions never vary. */
export const OG_IMAGE_W = 1200;
export const OG_IMAGE_H = 630;

/* The per-subject cards `scripts/build-og.ts` draws into static/og. Ids are
   bare identifiers (checked: no id needs escaping), but encode anyway so a
   future one cannot quietly produce a broken URL. */
export function entityCardUrl(id: string): string {
	return `${SITE_URL}/og/entities/${encodeURIComponent(id)}.png`;
}

export function mosCardUrl(id: string): string {
	return `${SITE_URL}/og/mos/${encodeURIComponent(id)}.png`;
}

/* Nobody searches "UAR Unit Database" — they search the map's name. So the
   brand is the homepage's title and a suffix everywhere else, and the words
   people actually type lead every other page. */
const TITLE_SUFFIX = `${GAME} unit database`;
export const HOME_TITLE = `${SITE_NAME} — ${GAME} (StarCraft II arcade)`;

/** `undefined` means the homepage — the one page whose title is the brand. */
export function fullTitle(title?: string | null): string {
	return title ? `${title} — ${TITLE_SUFFIX}` : HOME_TITLE;
}

/**
 * Google renders about 160 characters of a description and then either cuts it
 * mid-word or writes its own from the page. Everything here is clamped, so a
 * generated description can be assembled without counting.
 */
export const DESC_MAX = 160;

export function clampText(text: string, max = DESC_MAX): string {
	const s = text.replace(/\s+/g, ' ').trim();
	if (s.length <= max) return s;
	const cut = s.slice(0, max - 1);
	const space = cut.lastIndexOf(' ');
	// back off to a word boundary, unless that would throw away most of the
	// budget (one very long token), in which case take the hard cut
	const kept = space > max * 0.6 ? cut.slice(0, space) : cut;
	return kept.replace(/[\s,;:.·—-]+$/, '') + '…';
}

/** How each extracted category reads inside a sentence. */
const KIND: Record<string, string> = {
	'MOS (player class)': 'player class',
	'undead / hostile': 'undead enemy',
	'deployable / drone': 'deployable',
	'item / equipment': 'item',
	projectile: 'projectile',
	'structure / prop': 'structure',
	'other / NPC': 'NPC',
	'civilian / NPC': 'civilian NPC'
};

/* A tooltip out of the map leads with a header the page already shows as
   facts — "MOS: 11B (Infantry) Role: Automatic Rifleman", then the rank
   tracks that unlock the class — and only then the prose worth quoting. */
const RANK_LINE =
	/^(enlisted|warrant officer|comm?issionn?ed officer)(\s*[-–]\s*(enlisted|warrant officer|comm?issionn?ed officer))*$/i;

function isHeaderLine(line: string): boolean {
	const s = line.trim();
	return s === '' || /^MOS[:\s]/i.test(s) || RANK_LINE.test(s);
}

/** The quotable part of an in-game tooltip: its header lines dropped, the
 *  rest flattened to one line. */
export function tooltipProse(tooltip: string): string {
	const lines = tooltip.split('\n');
	while (lines.length && isHeaderLine(lines[0])) lines.shift();
	return lines.join(' ').replace(/\s+/g, ' ').trim();
}

/** Only the fields a description reads — the real Unit carries far more. */
export interface SeoUnit {
	id: string;
	name: string;
	category: string;
	role: string;
	life: number | null;
	armor: number | null;
	weapons: unknown[];
	tooltip: string;
}

function unitFacts(u: {
	role: string;
	life: number | null;
	armor: number | null;
	weapons: unknown[];
}): string {
	const facts: string[] = [];
	if (u.role) facts.push(u.role);
	if (u.life !== null) facts.push(`${u.life.toLocaleString('en')} life`);
	if (u.armor !== null) facts.push(`${u.armor} armor`);
	if (u.weapons.length) facts.push(`${u.weapons.length} weapon${u.weapons.length === 1 ? '' : 's'}`);
	return facts.join(' · ');
}

/**
 * One entity's description. The map's own prose is the better search snippet
 * wherever it exists; the stat line is what the rest of the roster — turrets,
 * projectiles, props — has instead.
 */
export function unitDescription(u: SeoUnit): string {
	const name = u.name || u.id;
	const lead = `${name} — ${KIND[u.category] ?? 'entity'} in ${GAME}.`;
	const prose = tooltipProse(u.tooltip);
	return clampText(`${lead} ${prose || unitFacts(u)}`);
}

export interface SeoMos {
	id: string;
	name: string;
	mos: string;
	role: string;
	life: number | null;
	armor: number | null;
	weapons: unknown[];
	skills: unknown[];
	tooltip: string;
}

export function mosDescription(m: SeoMos): string {
	const code = m.mos && m.mos !== m.name ? ` (MOS ${m.mos})` : '';
	const lead = `${m.name}${code} — player class in ${GAME}.`;
	const prose = tooltipProse(m.tooltip);
	const facts = [unitFacts(m), m.skills.length ? `${m.skills.length} skills` : '']
		.filter(Boolean)
		.join(' · ');
	return clampText(`${lead} ${prose || facts}`);
}

export function playerDescription(p: {
	name: string;
	clan: string;
	gamesPlayed: number;
	prestige: number;
	wins: number;
}): string {
	const bits = [
		`${p.gamesPlayed.toLocaleString('en')} game${p.gamesPlayed === 1 ? '' : 's'}`,
		`${p.wins.toLocaleString('en')} won`
	];
	if (p.prestige) bits.push(`prestige ${p.prestige}`);
	const clan = p.clan ? ` of <${p.clan}>` : '';
	return clampText(
		`${p.name}${clan} — ${GAME} player profile. ${bits.join(' · ')}. Rank tracks, class picks, unlocks and full game history.`
	);
}

export function clanDescription(c: {
	tag: string;
	members: number;
	games: number;
	wins: number;
}): string {
	return clampText(
		`<${c.tag}> — ${GAME} clan. ${c.members} member${c.members === 1 ? '' : 's'} · ${c.games.toLocaleString('en')} games · ${c.wins.toLocaleString('en')} won. Roster, combined XP and per-member stats.`
	);
}
