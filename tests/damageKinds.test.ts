/** Damage kinds against the extracted data: which buffs reach which hits (lib/damageKinds, npm test). */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classLines, kindHint, modLine, raisers, split, type RowLike, type WeaponLike } from '../src/lib/damageKinds.ts';

const data = (f: string) => JSON.parse(readFileSync(new URL(`../src/lib/data/${f}`, import.meta.url), 'utf8'));
const mos: { id: string; weapons: WeaponLike[]; skills: { id: string; name: string }[]; common: { id: string; name: string }[] }[] =
	data('mos.json');
const stats: Record<string, Record<string, RowLike[]>> = data('skillstats.json');
const sis = data('si.json');
const effects: { id: string; dmgKinds?: { kind: string; frac?: number }[]; si?: { num: number } }[] = data('behaviors.json');

const linesOf = (id: string) => {
	const m = mos.find((x) => x.id === id)!;
	const abilities = [
		...m.skills.map((s) => ({ ...s, section: 'skill' as const })),
		...m.common.map((c) => ({ ...c, section: 'cmd' as const }))
	];
	return classLines(`/mos/${id}`, m.weapons, abilities, stats[id] ?? {});
};

test('every class hit carries its kind', () => {
	for (const m of mos) {
		for (const w of m.weapons) {
			if (w.dmg != null) assert.ok(w.kind, `${m.id} ${w.id} has no kind`);
			for (const e of w.extra ?? []) assert.ok(e.kind, `${m.id} ${w.id} ${e.id} has no kind`);
		}
	}
});

test("the Rjx-73's guns are the modules its trees swap in", () => {
	const rjx = mos.find((m) => m.id === 'Rjx73')!;
	const byId = new Map(rjx.weapons.map((w) => [w.id, w]));
	assert.equal(byId.get('PunisherGrenades')?.tree, 'GrenadeLauncher');
	assert.equal(byId.get('TychusChaingun')?.tree, 'MinigunWay2');
	assert.equal(byId.get('NovaXanthosFlameTurret')?.tree, 'FlamerWay2');
	// the grenade is a weapon shot (ranged); Plasma Grenades' field names no kind, so it is spell
	const gl = byId.get('PunisherGrenades')!;
	assert.equal(gl.kind, 'Ranged');
	assert.deepEqual(
		gl.extra?.map((e) => [e.id, e.kind]),
		[
			['PlasmaGrenadeDamage5', 'Ranged'],
			['PlasmaGrenadeDPS2', 'Spell']
		]
	);
});

test('Whiz Kid is an SI that raises spell damage only', () => {
	const wk = effects.find((e) => e.id === 'WhizKid')!;
	assert.deepEqual(wk.dmgKinds, [{ kind: 'Spell', frac: 0.3 }]);
	assert.equal(wk.si?.num, 16);
	assert.equal(modLine(wk.dmgKinds![0]), '+30% spell damage');
	assert.deepEqual(raisers('Spell', sis), ['Whiz Kid +30%']);
	assert.ok(raisers('Ranged', sis).includes('Veteran +30%'));
	assert.deepEqual(raisers('Splash', sis), []);
	assert.match(kindHint('Splash', sis), /No SI raises it/);
});

test('the RJX grenade hits ranged and splashes spell', () => {
	const gl = mos.find((m) => m.id === 'Rjx73')!.weapons.find((w) => w.id === 'PunisherGrenades')!;
	// KindSplash is a field of its own; unset, it is Spell like Kind
	assert.equal(gl.kind, 'Ranged');
	assert.equal(gl.splashKind, 'Spell');
});

test("Whiz Kid reaches the RJX grenade's splash and plasma field, not its direct hit", () => {
	const { raised, not } = split(linesOf('Rjx73'), 'WhizKid', new Set(['Spell']));
	const labels = (cs: { label: string }[]) => cs.map((c) => c.label);
	assert.ok(labels(raised).includes('Punisher Grenades · area'), JSON.stringify(raised));
	assert.ok(labels(raised).includes('Punisher Grenades · if Grenade Launcher 4: area, over time'), JSON.stringify(raised));
	assert.ok(labels(not).includes('Punisher Grenades'), JSON.stringify(not));
	assert.ok(labels(not).includes('Punisher Grenades · if Grenade Launcher 4'), JSON.stringify(not));
	// the minigun's area is spell too; the Railgun names no kind at all
	// a 0.08 s volley is the same hit repeated, not a burn
	assert.ok(labels(not).includes('Punisher Rockets · if Grenade Launcher 4'), JSON.stringify(not));
	assert.ok(labels(raised).includes('Minigun · area'));
	assert.ok(labels(not).includes('Minigun'));
	assert.ok(labels(raised).includes('Railgun'));
});

test("a dummy's hit keeps only the buffs the map copies onto it", () => {
	// Orbital Strike is the Joint Fires Observer tree's card on the class page
	const orbital = linesOf('FireSupportSpecialist').filter((l) => l.href.endsWith('#skill-OrbitalStrike'));
	assert.ok(orbital.length && orbital.every((l) => l.dummy && l.kind === 'Spell'));
	assert.ok(orbital.every((l) => l.carries?.includes('WhizKid')));
	// Whiz Kid is copied over; another spell buff on the hero would not be
	assert.equal(split(orbital, 'WhizKid', new Set(['Spell'])).raised.length, 1);
	assert.equal(split(orbital, 'Dexterity', new Set(['Spell'])).raised.length, 0);
	assert.match(kindHint('Spell', sis, true, ['WhizKid']), /except Whiz Kid, which the map copies onto it/);
});
