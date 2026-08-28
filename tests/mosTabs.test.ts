import test from 'node:test';
import assert from 'node:assert/strict';
import {
	MOS_TABS,
	VEHICLE_SLOT,
	hasTab,
	mosTabHref,
	sameTabHref,
	tabSegment,
	tabsFor,
	vehicleSlug
} from '../src/lib/mosTabs.ts';

const none = { vehicle: false };
const all = { vehicle: true };

test('every class gets the overview and the gear tab, and nothing it has not earned', () => {
	assert.deepEqual(
		tabsFor(none).map((t) => t.segment),
		['', 'gear', 'players', 'guides', 'comments']
	);
	assert.deepEqual(
		tabsFor(all).map((t) => t.segment),
		['', 'gear', VEHICLE_SLOT, 'players', 'guides', 'comments']
	);
	// with a vehicle, the slot becomes the vehicle's own segment
	assert.deepEqual(
		tabsFor(all, { name: 'Predator' }).map((t) => t.segment),
		['', 'gear', 'predator', 'players', 'guides', 'comments']
	);
});

test('the vehicle tab is named and pictured after the vehicle', () => {
	const tabs = tabsFor(
		{ vehicle: true },
		{ name: 'Predator', icon: '/icons/predator.png' }
	);
	const tab = tabs.find((t) => t.segment === 'predator')!;
	assert.equal(tab.label, 'Predator');
	assert.match(tab.icon, /<svg[^>]*><clipPath.*<image href="\/icons\/predator.png"/);
	// the generic label and glyph stand in when no vehicle is given
	const generic = tabsFor(all).find((t) => t.segment === VEHICLE_SLOT)!;
	assert.equal(generic.label, 'Vehicle');
	assert.doesNotMatch(generic.icon, /<image/);
	// a vehicle without a portrait keeps the glyph
	assert.doesNotMatch(
		tabsFor(all, { name: 'Predator', icon: null }).find((t) => t.segment === 'predator')!.icon,
		/<image/
	);
});

test('hasTab agrees with tabsFor, and turns unknown segments away', () => {
	for (const t of MOS_TABS) assert.equal(hasTab(all, t.segment), true);
	assert.equal(hasTab(none, VEHICLE_SLOT), false);
	assert.equal(hasTab(none, ''), true);
	assert.equal(hasTab(all, 'nope'), false);
});

test('tabSegment reads the route id, not the URL', () => {
	assert.equal(tabSegment('/mos/[id]'), '');
	assert.equal(tabSegment('/mos/[id]/gear'), 'gear');
	// the vehicle tab's segment is its parameter, resolved from the params
	assert.equal(tabSegment('/mos/[id]/[vehicle]', { vehicle: 'predator' }), 'predator');
	assert.equal(tabSegment('/mos/[id]/[vehicle]'), VEHICLE_SLOT);
	assert.equal(tabSegment('/mos'), null);
	assert.equal(tabSegment('/players/[toon]/collection'), null);
	assert.equal(tabSegment(null), null);
});

test('mosTabHref builds the class URL and its tabs', () => {
	assert.equal(mosTabHref('CombatEngineer'), '/mos/CombatEngineer');
	assert.equal(mosTabHref('CombatEngineer', 'guides'), '/mos/CombatEngineer/guides');
	assert.equal(mosTabHref('AssaultEngineer', 'predator'), '/mos/AssaultEngineer/predator');
});

test('vehicleSlug is the name, lower-cased and hyphenated', () => {
	assert.equal(vehicleSlug('Predator'), 'predator');
	assert.equal(vehicleSlug('AMX S-880'), 'amx-s-880');
	assert.equal(vehicleSlug(' Odd  Name! '), 'odd-name');
});

test('sameTabHref keeps the open tab across classes, and falls back to the overview', () => {
	// a tab every class has follows the reader to the next class
	assert.equal(sameTabHref('Medic', none, '/mos/[id]/gear'), '/mos/Medic/gear');
	assert.equal(sameTabHref('Medic', none, '/mos/[id]/players'), '/mos/Medic/players');
	assert.equal(sameTabHref('Medic', none, '/mos/[id]/guides'), '/mos/Medic/guides');
	// a guide's own pages sit under the guides tab: the next class opens its list
	assert.equal(sameTabHref('Medic', none, '/mos/[id]/guides/[slug]'), '/mos/Medic/guides');
	// a tab that is not one, or that the next class lacks, lands on its overview
	assert.equal(sameTabHref('Medic', none, '/mos/[id]/nope'), '/mos/Medic');
	// the vehicle tab matches by kind: the other class's own vehicle, or nothing
	assert.equal(sameTabHref('Medic', none, '/mos/[id]/[vehicle]'), '/mos/Medic');
	assert.equal(
		sameTabHref('Pilot', all, '/mos/[id]/[vehicle]', { name: 'AMX S-880' }),
		'/mos/Pilot/amx-s-880'
	);
	// overview, and anywhere outside a class page, is the overview
	assert.equal(sameTabHref('Medic', all, '/mos/[id]'), '/mos/Medic');
	assert.equal(sameTabHref('Medic', all, '/mos'), '/mos/Medic');
	assert.equal(sameTabHref('Medic', all, null), '/mos/Medic');
});
