import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeFloating } from 'uar-shared/place';

/** anchor rect helper — x/y/width/height in, DOMRect-shaped out */
function rect(left: number, top: number, width: number, height: number) {
	return { left, top, width, height, right: left + width, bottom: top + height };
}

const phone = { width: 390, height: 844 };
const desktop = { width: 1440, height: 900 };

test('placeFloating: keeps a right-edge chip pop fully on screen', () => {
	// the top-bar failure on a phone: a 30px chip at the right edge with a
	// 240px pop hanging off it — end-aligned it would start at x = -14
	const chip = rect(316, 11, 60, 30);
	const { x, y, side } = placeFloating({
		anchor: chip,
		card: { width: 240, height: 180 },
		viewport: phone,
		placement: 'bottom',
		align: 'end'
	});
	assert.equal(side, 'bottom');
	assert.equal(y, 49); // straight under the chip
	assert.ok(x >= 8, `left edge ${x} must clear the 8px padding`);
	assert.ok(x + 240 <= phone.width - 8, `right edge ${x + 240} must stay on screen`);
});

test('placeFloating: unclamped when there is room', () => {
	const chip = rect(1200, 11, 60, 30);
	const { x } = placeFloating({
		anchor: chip,
		card: { width: 240, height: 180 },
		viewport: desktop,
		placement: 'bottom',
		align: 'end'
	});
	assert.equal(x, 1020); // 1260 - 240: right edges flush, no clamping
});

test('placeFloating: flips to the side that fits', () => {
	// no room above, plenty below
	const top = placeFloating({
		anchor: rect(200, 4, 40, 20),
		card: { width: 100, height: 120 },
		viewport: desktop,
		placement: 'top'
	});
	assert.equal(top.side, 'bottom');

	// no room below either, but room to the right
	const squeezed = placeFloating({
		anchor: rect(10, 4, 40, 20),
		card: { width: 100, height: 890 },
		viewport: desktop,
		placement: 'top'
	});
	assert.equal(squeezed.side, 'right');
});

test('placeFloating: honours the preferred side when it fits', () => {
	const { side, x, y } = placeFloating({
		anchor: rect(700, 400, 40, 20),
		card: { width: 100, height: 60 },
		viewport: desktop,
		placement: 'top'
	});
	assert.equal(side, 'top');
	assert.equal(x, 670); // centred: 700 + 20 - 50
	assert.equal(y, 332); // 400 - 60 - 8
});

test('placeFloating: the arrow follows the anchor after a clamp', () => {
	const anchor = rect(370, 100, 20, 20); // hard against the right edge
	const card = { width: 200, height: 80 };
	const { x, arrow } = placeFloating({ anchor, card, viewport: phone, placement: 'bottom' });
	assert.equal(x, 182); // clamped left, off the anchor's centre
	// the anchor's centre is at 380, i.e. 198 into a card that starts at 182 —
	// past its far edge, so the arrow rides the last 10px instead of detaching
	assert.equal(arrow, 190);
});

test('placeFloating: a card bigger than the viewport pins to the padding', () => {
	const { x, y } = placeFloating({
		anchor: rect(100, 400, 20, 20),
		card: { width: 600, height: 1000 },
		viewport: phone
	});
	assert.equal(x, 8);
	assert.equal(y, 8);
});
