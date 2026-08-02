/**
 * An award as a reader meets it: a name, a picture, and where to read more.
 *
 * Separate from $lib/awards.ts because that file has to stay free of the
 * site's data to run inside the replay pipeline and under node:test. This is
 * the other half — all lookup, no derivation — and it is what a page imports.
 */
import { camos, decals, medals } from './unlocks';
import { rankTracks, skillIdentifiers, siXpLabel, mosById } from './mos';
import { camoName, decalName, gearGroups } from './players';
import type { Award } from './awards';

/** Which family an award belongs to, for the colour of its mark on the rail. */
export type AwardTone = 'medal' | 'wear' | 'si' | 'gear' | 'rank' | 'prestige';

export interface AwardView {
	/** What was won. */
	label: string;
	/** The family, named for a reader — "Medal", "Camouflage"… */
	kind: string;
	icon: string | null;
	/** The page this thing is documented on, or null when it has none. */
	href: string | null;
	/** What the game says about it — the hover card's body. Newline-separated,
	 *  because `.tt-text` is pre-line and each fact wants its own row (the same
	 *  arrangement the collection grids use). */
	text: string;
	/** What the hover card's link calls itself. */
	linkText: string;
	tone: AwardTone;
}

/** Drop the blanks and put each surviving fact on its own row. */
const lines = (...bits: (string | false | null | undefined)[]) => bits.filter(Boolean).join('\n');

const medalByNum = new Map(medals.map((m) => [m.num, m]));
const decalByNum = new Map(decals.map((d) => [d.num, d]));
const camoByNum = new Map(camos.map((c) => [c.num, c]));
const siByNum = new Map(skillIdentifiers.map((s) => [s.num, s]));
const gearByKey = new Map(gearGroups.map((g) => [g.key as string, g]));

export function awardView(a: Award): AwardView {
	switch (a.type) {
		case 'medal': {
			const m = medalByNum.get(a.id);
			return {
				label: m?.name ?? `Medal #${a.id}`,
				kind: 'Medal',
				icon: m?.icon ?? null,
				href: '/medals',
				text: lines(
					m?.desc,
					!!m?.xp.length && `Awards ${m.xp.map((x) => x.toLocaleString('en')).join(' / ')} XP.`
				),
				linkText: 'All medals & decals',
				tone: 'medal'
			};
		}
		case 'decal': {
			const d = decalByNum.get(a.id);
			return {
				label: decalName(a.id),
				kind: 'Decal',
				icon: d?.icon ?? null,
				href: '/medals',
				text: lines(d?.req),
				linkText: 'All medals & decals',
				tone: 'wear'
			};
		}
		case 'camo': {
			const c = camoByNum.get(a.id);
			return {
				label: camoName(a.id),
				kind: 'Camouflage',
				icon: c?.swatch ?? null,
				href: '/camos',
				text: lines(
					c?.req,
					c?.adaptive && 'Adaptive: cycles terrain textures instead of a fixed pattern.',
					c?.walker && 'Also selectable on the FP500 Combat Walker.'
				),
				linkText: 'All camouflages',
				tone: 'wear'
			};
		}
		case 'si': {
			const s = siByNum.get(a.id);
			return {
				label: s?.name ?? `SI #${a.id}`,
				kind: 'Skill Identifier',
				icon: s?.icon ?? null,
				href: '/si',
				text: lines(
					s?.desc,
					s && (siXpLabel(s) ? `Unlocks at ${siXpLabel(s)} XP` : s.special && 'Special achievement unlock')
				),
				linkText: 'All Skill Identifiers',
				tone: 'si'
			};
		}
		case 'gear': {
			const g = a.group ? gearByKey.get(a.group) : undefined;
			const item = g?.items[a.id];
			return {
				label: item?.name ?? `Gear #${a.id}`,
				// the ladder names itself: "Walker gear", "Alligator LK19"
				kind: g?.label ?? 'Gear',
				icon: g ? (mosById.get(g.mosId)?.icon ?? null) : null,
				href: g ? `/mos/${g.mosId}` : null,
				text: lines(item?.desc, item?.req && `Earned by: ${item.req}`),
				linkText: g ? `${g.label} on the class page` : '',
				tone: 'gear'
			};
		}
		case 'rank': {
			const track = rankTracks.find((t) => t.track === a.track);
			const rank = track?.ranks[a.id];
			return {
				// the stored name is what the ladder said at ingest; prefer the
				// live one, which is right even after the ladders are re-extracted
				label: rank?.name ?? a.label ?? `Rank #${a.id}`,
				kind: track?.name ?? 'Rank',
				icon: rank?.icon ?? null,
				href: '/ranks',
				text: lines(
					rank && `${rank.prefix} — reached at ${rank.xp.toLocaleString('en')} XP`,
					track && `${track.name} track`
				),
				linkText: 'All rank sets',
				tone: 'rank'
			};
		}
		case 'prestige':
			return {
				label: `Prestige ${a.id}`,
				kind: 'Prestige',
				icon: null,
				href: '/ranks',
				text: lines(
					'Prestige resets all three tracks to 50,000 XP and keeps everything already unlocked.',
					'Requires 250,000 XP on each of the three tracks.'
				),
				linkText: 'All rank sets',
				// its own tone, not 'rank': prestige is the one place the site goes
				// gold, and the home page's roll of honour already draws it that way
				tone: 'prestige'
			};
	}
}
