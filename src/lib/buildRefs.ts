/**
 * What `[[skill:Security]]` and its kin point at (see $lib/buildMarkdown):
 * the game's own things, found by id or by name, so a guide can name a
 * skill, an item, a class, an SI or a hostile and get the chip the site draws
 * for it, with a link to its page. Names match case-insensitively, because
 * an author types what the game shows them, not what the extractor keyed.
 *
 * A skill is looked for on the guide's own class first: "Soldier Skills" is
 * on every class, and a Combat Engineer build means its own.
 *
 * Matching folds case, spaces and punctuation: the data calls one class
 * "CombatMedic" and a player writes "Combat Medic", and neither should have
 * to know how the other spells it. A class also answers to its MOS code
 * ("68W"), which is how players name them in chat.
 */

import { allMos, items, mosById, mosHref, skillIdentifiers, type CommonAbility, type Skill } from './mos';
import { unitById, units } from './units';
import { GROUP_TYPES, groupById, groupHref, groups } from './groups';
import { EFFECT_KIND_WORD, effectById, effectsIndex } from './effectsIndex';
import { effectHref } from './effects';
import type { RefKind, RefResolver, RefTarget } from './buildMarkdown';

const fold = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

interface SkillOwner {
	mos: string;
	skill: Skill;
}

const skillsByKey = new Map<string, SkillOwner[]>();
for (const m of allMos) {
	for (const skill of m.skills) {
		for (const key of new Set([fold(skill.id), fold(skill.name)])) {
			const list = skillsByKey.get(key) ?? [];
			list.push({ mos: m.id, skill });
			skillsByKey.set(key, list);
		}
	}
}

/* A class's standard abilities (Repair, Craft, the Predator's Rockets…) are
   not skills: they come with the class, or with its levels. Keyed the same
   way, and a class's own first. */
interface AbilityOwner {
	mos: string;
	ability: CommonAbility;
}
const abilitiesByKey = new Map<string, AbilityOwner[]>();
for (const m of allMos) {
	for (const ability of m.common) {
		for (const key of new Set([fold(ability.id), fold(ability.name)])) {
			const list = abilitiesByKey.get(key) ?? [];
			list.push({ mos: m.id, ability });
			abilitiesByKey.set(key, list);
		}
	}
}

type Finder = (ref: string) => RefTarget | null;

/* An effect — a buff, a debuff, a wound — by id or by name: "Fractured Leg",
   "Prone", "Napalm Burn". The chip carries the game's icon and links to the
   effect's page. */
const effectsByKey = new Map<string, (typeof effectsIndex)[number]>();
for (const e of effectsIndex) {
	for (const key of new Set([fold(e.id), fold(e.name)])) {
		if (!effectsByKey.has(key)) effectsByKey.set(key, e);
	}
}
function effect(ref: string): RefTarget | null {
	const e = effectById.get(ref) ?? effectsByKey.get(fold(ref));
	return e ? { kind: 'effect', name: e.name, href: effectHref(e.id), icon: e.icon, tip: EFFECT_KIND_WORD[e.kind] } : null;
}

function skillFinder(prefer: string | null): Finder {
	return (ref) => {
		const owners = skillsByKey.get(fold(ref));
		if (!owners?.length) return null;
		const o = owners.find((x) => x.mos === prefer) ?? owners[0];
		return {
			kind: 'skill',
			name: o.skill.name,
			href: `${mosHref(o.mos)}#skill-${o.skill.id}`,
			icon: o.skill.icon,
			tip: o.skill.tooltip
		};
	};
}

function abilityFinder(prefer: string | null): Finder {
	const vehicle = prefer ? (mosById.get(prefer)?.vehicle ?? null) : null;
	return (ref) => {
		const owners = abilitiesByKey.get(fold(ref));
		if (!owners?.length) return null;
		const o =
			owners.find((x) => x.mos === prefer) ?? owners.find((x) => x.mos === vehicle) ?? owners[0];
		return {
			kind: 'ability',
			name: o.ability.name,
			href: mosHref(o.mos),
			icon: o.ability.icon,
			tip: o.ability.tooltip
		};
	};
}

const item: Finder = (ref) => {
	const k = fold(ref);
	const i = items.find((x) => x.playable && (fold(x.id) === k || fold(x.name) === k));
	if (!i) return null;
	return {
		kind: 'item',
		name: i.name,
		href: i.unit ? `/entities/${i.unit}` : null,
		icon: i.icon,
		tip: i.tooltip
	};
};

const mos: Finder = (ref) => {
	const k = fold(ref);
	const m =
		mosById.get(ref.trim()) ??
		allMos.find((x) => fold(x.name) === k || fold(x.id) === k || fold(x.mos) === k);
	if (!m || m.id === 'TemplateMOS') return null;
	return { kind: 'mos', name: m.name, href: mosHref(m.id), icon: m.icon, tip: m.tooltip };
};

const si: Finder = (ref) => {
	const k = fold(ref);
	const s = skillIdentifiers.find(
		(x) => String(x.num) === k || fold(x.name) === k || fold(x.code) === k
	);
	if (!s) return null;
	return { kind: 'si', name: s.name, href: `/career/si#si-${s.num}`, icon: s.icon, tip: s.desc };
};

/* Every entity on /entities, by name or by id: some (the MULE) have no display
   name at all, and the id is what the entity page shows for them. */
const unit: Finder = (ref) => {
	const k = fold(ref);
	const u =
		unitById.get(ref.trim()) ?? units.find((x) => fold(x.name) === k || fold(x.id) === k);
	if (!u) return null;
	return { kind: 'unit', name: u.name || u.id, href: `/entities/${u.id}`, icon: u.icon, tip: u.tooltip || unitLine(u) };
};

/* A third of the entities carry no description (a hero, a prop, a projectile):
   the card then reads what the sheet knows for sure, so a hover is never blank. */
function unitLine(u: { category: string; life: number | null; armor: number | null; speed: number | null }): string {
	return [
		u.category,
		u.life ? `${u.life.toLocaleString('en')} HP` : null,
		u.armor != null && u.life ? `${u.armor} armor` : null,
		u.speed ? `speed ${u.speed}` : null
	]
		.filter(Boolean)
		.join(' · ');
}

/* A mission (a trigger group), by id or by name. What it pays is its hover text. */
const mission: Finder = (ref) => {
	const k = fold(ref);
	const g = groupById.get(ref.trim()) ?? groups.find((x) => fold(x.id) === k || fold(x.name) === k);
	if (!g) return null;
	const type = GROUP_TYPES.find((t) => t.type === g.type)?.label ?? g.type;
	const tip = g.outcomes.length ? g.outcomes.map((o) => o.name).filter(Boolean).slice(0, 3).join(' · ') : type;
	return { kind: 'mission', name: g.name, href: groupHref(g.id), icon: null, tip };
};

/* A player, by handle: the chip's words come from the label the @ search wrote
   (`[[player:<toon>|Name]]`); nothing here can look a name up. The portrait
   comes from the map the caller has (the server's, by toon), or from what a
   box has seen go by in its @ search (see knownAvatars). */
const TOON = /^\d+-S2-\d+-\d+$/;
/** Portraits a page has learned in passing, by toon: the @ search's hits feed it. */
export const knownAvatars = new Map<string, string>();
export interface PlayerCardRef {
	name: string;
	clan: string;
	avatar: string | null;
	html: string;
}
function playerFinder(
	avatars: Record<string, string | null | undefined> | undefined,
	players: Record<string, PlayerCardRef> | undefined
): Finder {
	return (ref) => {
		const toon = ref.trim();
		if (!TOON.test(toon)) return null;
		const card = players?.[toon];
		const icon = card?.avatar ?? avatars?.[toon] ?? knownAvatars.get(toon) ?? null;
		const name = card ? (card.clan ? `<${card.clan}> ${card.name}` : card.name) : toon;
		return { kind: 'player', name, href: `/players/${toon}`, icon, tip: null, tipHtml: card?.html ?? null };
	};
}

/** The resolver for a guide of this class. */
export function refResolver(
	mosId: string | null,
	opts: { avatars?: Record<string, string | null | undefined>; players?: Record<string, PlayerCardRef> } = {}
): RefResolver {
	const player = playerFinder(opts.avatars, opts.players);
	const finders: Record<RefKind, Finder> = {
		skill: skillFinder(mosId),
		ability: abilityFinder(mosId),
		item,
		effect,
		mos,
		si,
		unit,
		mission,
		player
	};
	const order: RefKind[] = ['skill', 'ability', 'item', 'mos', 'si', 'effect', 'unit', 'mission'];
	return (kind, ref) => {
		if (kind !== null) {
			const f = (finders as Record<string, Finder | undefined>)[kind];
			return f ? f(ref) : null;
		}
		for (const k of order) {
			const t = finders[k](ref);
			if (t) return t;
		}
		return null;
	};
}

/** One thing the editor's search can offer, with the text that names it. */
export interface RefHit {
	kind: RefKind;
	id: string;
	name: string;
	icon: string | null;
	/** What to write: `[[kind:id]]`. */
	ref: string;
	/** A word beside the name where two things share one: the class a skill is on. */
	note?: string;
}

/**
 * What `@` in the editor searches: the class's own skills and items first,
 * then classes, SIs, every other skill and item, and last the hostiles. A
 * query matches the start of a name before the middle of one, and an empty
 * query shows the class's skills, since those are what a guide names most.
 */
export function searchRefs(query: string, mosId: string | null, limit = 8): RefHit[] {
	const pool: RefHit[] = [];
	const seen = new Set<string>();
	const add = (h: RefHit) => {
		if (!seen.has(h.ref)) {
			seen.add(h.ref);
			pool.push(h);
		}
	};
	const own = mosId ? mosById.get(mosId) : undefined;
	const ownVehicle = own?.vehicle ? mosById.get(own.vehicle) : undefined;
	for (const s of own?.skills ?? []) add({ kind: 'skill', id: s.id, name: s.name, icon: s.icon, ref: `[[skill:${s.id}]]` });
	for (const m of [own, ownVehicle]) {
		for (const a of m?.common ?? []) {
			add({ kind: 'ability', id: a.id, name: a.name, icon: a.icon, ref: `[[ability:${a.id}]]`, note: m === ownVehicle ? m?.name : undefined });
		}
	}
	for (const i of items) {
		if (i.playable && i.type !== 'supply' && (i.allowed === null || (mosId !== null && i.allowed.includes(mosId)))) {
			add({ kind: 'item', id: i.id, name: i.name, icon: i.icon, ref: `[[item:${i.id}]]` });
		}
	}
	for (const m of allMos) {
		if (m.id !== 'TemplateMOS') add({ kind: 'mos', id: m.id, name: m.name, icon: m.icon, ref: `[[mos:${m.id}]]`, note: m.mos });
	}
	for (const s of skillIdentifiers) add({ kind: 'si', id: String(s.num), name: s.name, icon: s.icon, ref: `[[si:${s.num}]]`, note: 'SI' });
	for (const m of allMos) {
		for (const s of m.skills) {
			add({ kind: 'skill', id: s.id, name: s.name, icon: s.icon, ref: `[[skill:${s.id}]]`, note: m.name });
		}
	}
	for (const m of allMos) {
		for (const a of m.common) {
			add({ kind: 'ability', id: a.id, name: a.name, icon: a.icon, ref: `[[ability:${a.id}]]`, note: m.name });
		}
	}
	for (const i of items) if (i.playable) add({ kind: 'item', id: i.id, name: i.name, icon: i.icon, ref: `[[item:${i.id}]]` });
	for (const e of effectsIndex) {
		add({ kind: 'effect', id: e.id, name: e.name, icon: e.icon, ref: `[[effect:${e.id}]]`, note: EFFECT_KIND_WORD[e.kind] });
	}
	for (const g of groups) {
		add({ kind: 'mission', id: g.id, name: g.name, icon: null, ref: `[[mission:${g.id}]]`, note: GROUP_TYPES.find((t) => t.type === g.type)?.label ?? g.type });
	}
	// hostiles come in variants under one name (a turret, its lowered twin);
	// the first of a name is the one a guide means
	const unitNames = new Set<string>();
	for (const u of units) {
		const name = u.name || u.id;
		if (unitNames.has(fold(name))) continue;
		unitNames.add(fold(name));
		add({ kind: 'unit', id: u.id, name, icon: u.icon, ref: `[[unit:${u.id}]]` });
	}

	const q = fold(query);
	if (!q) return pool.slice(0, limit);
	const rank = (h: RefHit) => {
		const n = fold(h.name);
		if (n.startsWith(q)) return 0;
		if (n.includes(q)) return 1;
		if (fold(h.id).includes(q)) return 2;
		return -1;
	};
	return pool
		.map((h, i) => ({ h, r: rank(h), i }))
		.filter((x) => x.r >= 0)
		.sort((a, b) => a.r - b.r || a.i - b.i)
		.slice(0, limit)
		.map((x) => x.h);
}
