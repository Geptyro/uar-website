/**
 * The worked example from RFC 8291 §5, run end to end.
 *
 * This is the only cheap way to know the sender is correct: a push service
 * accepts a wrongly-encrypted body with a 201 and simply never delivers it, so
 * a successful deploy proves nothing. Every intermediate the RFC publishes is
 * asserted too, so a failure names the derivation step that broke rather than
 * leaving a ciphertext diff to stare at.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createDecipheriv, createECDH, hkdfSync } from 'node:crypto';
import { deriveKeys, encryptPush, generateVapidKeys, vapidAuthorization } from '../src/lib/server/webpush.ts';

const b64 = (s: string) => Buffer.from(s, 'base64url');

// RFC 8291 §5 — "When I grow up, I want to be a watermelon"
const V = {
	plaintext: 'When I grow up, I want to be a watermelon',
	salt: 'DGv6ra1nlYgDCS1FRnbzlw',
	asPublic:
		'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
	asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
	uaPublic:
		'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
	uaPrivate: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
	authSecret: 'BTBZMqHH6r4Tts7J_aSIgg',
	ecdhSecret: 'kyrL1jIIOHEzg3sM2ZWRHDRB62YACZhhSlknJ672kSs',
	ikm: 'S4lYMb_L0FxCeq0WhDx813KgSYqU26kOyzWUdsXYyrg',
	cek: 'oIhVW04MRdy2XN9CiKLxTg',
	nonce: '4h_95klXJ5E_qnoN'
};

test('RFC 8291 §5: ECDH shared secret', () => {
	const ua = createECDH('prime256v1');
	ua.setPrivateKey(b64(V.uaPrivate));
	assert.equal(ua.getPublicKey().toString('base64url'), V.uaPublic);

	const as = createECDH('prime256v1');
	as.setPrivateKey(b64(V.asPrivate));
	assert.equal(as.getPublicKey().toString('base64url'), V.asPublic);

	assert.equal(as.computeSecret(ua.getPublicKey()).toString('base64url'), V.ecdhSecret);
});

test('RFC 8291 §5: IKM, CEK and nonce', () => {
	const { ikm, cek, nonce } = deriveKeys(
		b64(V.ecdhSecret),
		b64(V.authSecret),
		b64(V.uaPublic),
		b64(V.asPublic),
		b64(V.salt)
	);
	assert.equal(ikm.toString('base64url'), V.ikm, 'IKM (the "WebPush: info" step)');
	assert.equal(cek.toString('base64url'), V.cek, 'CEK');
	assert.equal(nonce.toString('base64url'), V.nonce, 'nonce');
});

test('RFC 8291 §5: full aes128gcm body', () => {
	const body = encryptPush(
		Buffer.from(V.plaintext),
		{ p256dh: V.uaPublic, auth: V.authSecret },
		{ asPrivate: b64(V.asPrivate), salt: b64(V.salt) }
	);
	// header framing: salt(16) || rs(4) || idlen(1) || as_public(65)
	assert.equal(body.subarray(0, 16).toString('base64url'), V.salt);
	assert.equal(body.readUInt32BE(16), 4096, 'record size');
	assert.equal(body.readUInt8(20), 65, 'key id length');
	assert.equal(body.subarray(21, 86).toString('base64url'), V.asPublic);
	// and the ciphertext the RFC publishes
	assert.equal(
		body.subarray(86).toString('base64url'),
		'8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ'
	);
});

test('a real send round-trips: fresh salt and ephemeral key, decrypted as a browser would', () => {
	const ua = createECDH('prime256v1');
	ua.generateKeys();
	const authSecret = Buffer.from('0123456789abcdef');
	const message = JSON.stringify({ title: 'Kanaxz is ready to play', body: '3 players ready' });

	const body = encryptPush(Buffer.from(message), {
		p256dh: ua.getPublicKey().toString('base64url'),
		auth: authSecret.toString('base64url')
	});

	// the receiving half of RFC 8291, written independently of the sender
	const salt = body.subarray(0, 16);
	const asPublic = body.subarray(21, 86);
	const ciphertext = body.subarray(86);
	const ecdhSecret = ua.computeSecret(asPublic);
	const ikm = Buffer.from(
		hkdfSync(
			'sha256',
			ecdhSecret,
			authSecret,
			Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), asPublic]),
			32
		)
	);
	const cek = Buffer.from(
		hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16)
	);
	const nonce = Buffer.from(
		hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12)
	);
	const decipher = createDecipheriv('aes-128-gcm', cek, nonce);
	decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16));
	const plain = Buffer.concat([
		decipher.update(ciphertext.subarray(0, ciphertext.length - 16)),
		decipher.final()
	]);
	assert.equal(plain.at(-1), 2, 'record delimiter');
	assert.equal(plain.subarray(0, plain.length - 1).toString(), message);
});

test('two sends of the same message never reuse a nonce', () => {
	const ua = createECDH('prime256v1');
	ua.generateKeys();
	const sub = { p256dh: ua.getPublicKey().toString('base64url'), auth: 'BTBZMqHH6r4Tts7J_aSIgg' };
	const a = encryptPush(Buffer.from('same'), sub);
	const b = encryptPush(Buffer.from('same'), sub);
	assert.notEqual(a.subarray(0, 16).toString('hex'), b.subarray(0, 16).toString('hex'), 'salt');
	assert.notEqual(a.subarray(21, 86).toString('hex'), b.subarray(21, 86).toString('hex'), 'key');
});

test('an oversized payload is refused rather than silently truncated', () => {
	assert.throws(
		() => encryptPush(Buffer.alloc(4000), { p256dh: V.uaPublic, auth: V.authSecret }),
		/too large/
	);
});

test('the VAPID header is audience-bound and carries the public key', () => {
	const keys = { ...generateVapidKeys(), subject: 'mailto:dev@example.com' };
	const header = vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc123', keys);
	const [, token, publicKey] = header.match(/^vapid t=([^,]+), k=(.+)$/) ?? [];
	assert.equal(publicKey, keys.publicKey);
	const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
	assert.equal(claims.aud, 'https://fcm.googleapis.com');
	assert.equal(claims.sub, 'mailto:dev@example.com');
	// three base64url segments, ES256 signature is the raw 64-byte r||s
	const parts = token.split('.');
	assert.equal(parts.length, 3);
	assert.equal(Buffer.from(parts[2], 'base64url').length, 64);
});
