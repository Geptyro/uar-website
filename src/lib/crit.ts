/**
 * Critical shots, from the map script's crit trigger (extract_mos_items.py →
 * crit-rules.json). The game data has no crit at all: a trigger on damage rolls a
 * chance and deals the hit again. Its rules are already replayed by the extractor
 * into each skill level's numbers; what the site still reads from the trigger is
 * when it fires, for the footnote under a card that crits.
 */
import raw from './data/crit-rules.json' with { type: 'json' };

type CritGate =
	| { kind: 'damageType'; value: string }
	| { kind: 'minDamage'; value: number; strict: boolean }
	| { kind: 'targetAttr'; attr: string; is: boolean }
	| { kind: 'hostile' }
	| { kind: 'raw'; text: string };

interface CritRules {
	/** The roll is 1 to `roll`; a crit lands at or under the chance. */
	roll: number;
	/** The chance before any rule sets another. */
	chance: number;
	gates: CritGate[];
}

const rules = raw as unknown as CritRules;

/** "ranged hits over 10 damage against biological enemies" */
export function critWhen(): string {
	const g = rules.gates;
	const type = g.find((x) => x.kind === 'damageType');
	const min = g.find((x) => x.kind === 'minDamage');
	const attrs = g.filter((x) => x.kind === 'targetAttr');
	const raws = g.filter((x) => x.kind === 'raw');
	return [
		type ? `${type.value.toLowerCase()} hits` : 'hits',
		min ? (min.strict ? `over ${min.value} damage` : `of ${min.value} damage or more`) : '',
		'against',
		...attrs.map((a) => `${a.is ? '' : 'non-'}${a.attr.toLowerCase()}`),
		g.some((x) => x.kind === 'hostile') ? 'enemies' : 'units',
		raws.length ? `when ${raws.map((r) => r.text).join(' and ')}` : ''
	]
		.filter(Boolean)
		.join(' ');
}

export const critBaseChance = (rules.chance * 100) / rules.roll;

/** A mod phrase the extractor writes for a crit: "critical shot 12% · 4×". */
export const isCritPhrase = (m: string) => m.startsWith('critical shot ');

/** A crit of its own, as opposed to a change to someone else's ("critical shot chance ×2"). */
export const isCritSource = (m: string) => /^critical shot \d/.test(m);
