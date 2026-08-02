/**
 * What goes on a page's share card, decided from extracted map data. The
 * drawing lives in `scripts/build-og.ts`; this is only the model, kept free of
 * imports so plain `node --test` can load it (see CLAUDE.md).
 */

/**
 * A few names carry SC2 text markup straight out of the map's text table
 * (`<s val="ModCenterSize16">Outlaw deployment phantom.</s>`). Nothing wants
 * the tags — not the card, not the <title>, not the heading.
 */
export function displayName(raw: string): string {
	return raw
		.replace(/<[^>]*>/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

export interface Card {
	/** Small mono line above the name. */
	eyebrow: string;
	name: string;
	/** One line of prose under the name; empty when the map gives none. */
	prose: string;
	/** Short mono facts, laid out left to right until the row is full. */
	chips: string[];
	/** Root-relative path of the portrait, or null when there is none. */
	icon: string | null;
}

export interface FitOptions {
	/** Size to use when the text is short enough not to care. */
	max: number;
	/** Smallest size worth shrinking to; past this the text is cut instead. */
	min: number;
	/** Mean glyph advance as a fraction of the font size. */
	em: number;
}

/**
 * Pick a font size that keeps `text` inside `width`, cutting it only once
 * shrinking would make it unreadable. Estimated from a mean advance rather
 * than measured: the renderer cannot measure before it draws, and the card
 * leaves enough margin that an estimate is what the job needs.
 */
export function fitText(text: string, width: number, o: FitOptions): { text: string; size: number } {
	const ideal = Math.floor(width / Math.max(1, text.length * o.em));
	if (ideal >= o.max) return { text, size: o.max };
	if (ideal >= o.min) return { text, size: ideal };
	const fits = Math.max(1, Math.floor(width / (o.min * o.em)));
	if (text.length <= fits) return { text, size: o.min };
	return { text: text.slice(0, fits - 1).trimEnd() + '…', size: o.min };
}

/** First sentence, for the couple of lines of prose a card has room for. */
export function firstSentence(prose: string): string {
	const m = prose.match(/^.*?[.!?](?=\s|$)/);
	return (m ? m[0] : prose).trim();
}

/**
 * Break `text` into at most `maxLines` lines that fit `width`, marking the cut
 * when there was more to say. SVG text does not wrap on its own, so the lines
 * are drawn one per <text>.
 */
export function wrapText(
	text: string,
	width: number,
	size: number,
	em: number,
	maxLines: number
): string[] {
	const perLine = Math.max(4, Math.floor(width / (size * em)));
	const lines: string[] = [];
	let line = '';
	let dropped = false;
	for (const word of text.split(/\s+/).filter(Boolean)) {
		const next = line ? `${line} ${word}` : word;
		if (next.length <= perLine) {
			line = next;
			continue;
		}
		if (lines.length === maxLines - 1 && line) {
			dropped = true;
			break;
		}
		if (line) lines.push(line);
		line = word.length <= perLine ? word : word.slice(0, perLine - 1) + '…';
	}
	if (line) lines.push(line);
	if (dropped && lines.length) {
		const last = lines[lines.length - 1];
		lines[lines.length - 1] =
			(last.length + 1 <= perLine ? last : last.slice(0, perLine - 1)).trimEnd() + '…';
	}
	return lines;
}

/** The category, as a card eyebrow rather than as the data spells it. */
const EYEBROW: Record<string, string> = {
	'MOS (player class)': 'PLAYER CLASS',
	'undead / hostile': 'UNDEAD',
	'deployable / drone': 'DEPLOYABLE',
	'item / equipment': 'ITEM',
	projectile: 'PROJECTILE',
	'structure / prop': 'STRUCTURE',
	'other / NPC': 'NPC',
	'civilian / NPC': 'CIVILIAN'
};

function num(n: number): string {
	return n.toLocaleString('en');
}

export interface CardUnit {
	id: string;
	name: string;
	category: string;
	role: string;
	life: number | null;
	armor: number | null;
	speed: number | null;
	weapons: unknown[];
	icon: string | null;
	tooltip: string;
}

export function entityCard(u: CardUnit, prose: string): Card {
	const chips: string[] = [];
	if (u.life !== null) chips.push(`${num(u.life)} life`);
	if (u.armor !== null) chips.push(`${u.armor} armor`);
	if (u.speed !== null) chips.push(`${u.speed} speed`);
	if (u.weapons.length)
		chips.push(`${u.weapons.length} weapon${u.weapons.length === 1 ? '' : 's'}`);
	return {
		eyebrow: EYEBROW[u.category] ?? u.category.toUpperCase(),
		name: displayName(u.name || u.id),
		prose: firstSentence(prose),
		chips,
		icon: u.icon
	};
}

export interface CardMos {
	id: string;
	name: string;
	mos: string;
	role: string;
	life: number | null;
	armor: number | null;
	weapons: unknown[];
	skills: unknown[];
	icon: string | null;
	tooltip: string;
	selectable?: boolean;
}

export function mosCard(m: CardMos, prose: string): Card {
	const chips: string[] = [];
	if (m.role) chips.push(m.role);
	if (m.life !== null) chips.push(`${num(m.life)} life`);
	if (m.armor !== null) chips.push(`${m.armor} armor`);
	if (m.skills.length) chips.push(`${m.skills.length} skills`);
	return {
		eyebrow: m.mos
			? `MOS ${m.mos}`.toUpperCase()
			: m.selectable === false
				? 'PILOTED VEHICLE'
				: 'PLAYER CLASS',
		name: displayName(m.name || m.id),
		prose: firstSentence(prose),
		chips,
		icon: m.icon
	};
}
