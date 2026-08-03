/**
 * Web Push sender — VAPID (RFC 8292) + aes128gcm payload encryption
 * (RFC 8291 over RFC 8188), on node:crypto alone.
 *
 * Hand-rolled rather than pulling in `web-push`, for the same reason
 * session.ts hand-rolls its HMAC cookie and the bucket uploads use aws4fetch:
 * the whole of it is ~100 lines of well-specified crypto against built-ins,
 * and the alternative is five transitive dependencies inside the request path
 * of a musl image CI never runs (see CLAUDE.md on `docker build`).
 *
 * What keeps that honest is tests/webpush.test.ts, which runs the worked
 * example from RFC 8291 §5 — fixed ephemeral key and salt in, the RFC's own
 * intermediates and ciphertext out. A push service is unforgiving here: a
 * wrong byte anywhere yields a 201 and a notification nobody ever sees, so
 * "it deployed fine" is not evidence. The vector is.
 */

import {
	createCipheriv,
	createECDH,
	createPrivateKey,
	hkdfSync,
	randomBytes,
	sign
} from 'node:crypto';

/** One browser's push subscription, as PushManager.subscribe() serialises it. */
export interface WebPushSubscription {
	endpoint: string;
	/** UA public key, base64url — the uncompressed P-256 point. */
	p256dh: string;
	/** UA auth secret, base64url — 16 bytes. */
	auth: string;
}

/** Outcome of one send. `gone` means the subscription must be deleted. */
export type PushResult = 'sent' | 'gone' | 'rejected';

const b64url = (b: Buffer): string => b.toString('base64url');
const fromB64url = (s: string): Buffer => Buffer.from(s, 'base64url');

/**
 * Left-pads a big-endian scalar to the field size.
 *
 * One P-256 private key in 256 starts with a zero byte, and a serialiser that
 * trims it hands back 31 bytes. JWK requires exactly 32 (RFC 7518 §6.2.1) and
 * rejects anything else — a keypair that works on every machine but one, which
 * is the worst possible shape for a bug in a notification path nobody watches.
 */
const pad32 = (b: Buffer): Buffer =>
	b.length >= 32 ? b : Buffer.concat([Buffer.alloc(32 - b.length), b]);

/** RFC 8188 record size. One record is all we ever send. */
const RECORD_SIZE = 4096;

/** aes128gcm framing puts the sender's key in the header, so it costs 86 bytes. */
const HEADER_OVERHEAD = 16 + 4 + 1 + 65;
/** Plus the GCM tag and the 0x02 record delimiter. */
const MAX_PAYLOAD = RECORD_SIZE - HEADER_OVERHEAD - 16 - 1;

function info(label: string, ...parts: Buffer[]): Buffer {
	return Buffer.concat([Buffer.from(`${label}\0`, 'ascii'), ...parts]);
}

/**
 * RFC 8291 §3.1 key derivation, split out so the test can assert the RFC's
 * published intermediates rather than only the final ciphertext — a mismatch
 * then names the step that is wrong instead of just the answer.
 */
export function deriveKeys(
	ecdhSecret: Buffer,
	authSecret: Buffer,
	uaPublic: Buffer,
	asPublic: Buffer,
	salt: Buffer
): { ikm: Buffer; cek: Buffer; nonce: Buffer } {
	// the "WebPush: info" step mixes both public keys into the IKM, which is
	// what binds the ciphertext to this exact pair of parties
	const ikm = Buffer.from(
		hkdfSync('sha256', ecdhSecret, authSecret, info('WebPush: info', uaPublic, asPublic), 32)
	);
	const cek = Buffer.from(hkdfSync('sha256', ikm, salt, info('Content-Encoding: aes128gcm'), 16));
	const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, info('Content-Encoding: nonce'), 12));
	return { ikm, cek, nonce };
}

/**
 * Encrypts one message into a complete aes128gcm body.
 *
 * `fixed` exists only for the RFC vector — real sends take a fresh ephemeral
 * keypair and salt every time, which is what makes the nonce reuse that would
 * break AES-GCM impossible here.
 */
export function encryptPush(
	payload: Buffer,
	subscription: Pick<WebPushSubscription, 'p256dh' | 'auth'>,
	fixed?: { asPrivate: Buffer; salt: Buffer }
): Buffer {
	if (payload.length > MAX_PAYLOAD) {
		throw new Error(`push payload too large: ${payload.length} > ${MAX_PAYLOAD}`);
	}
	const uaPublic = fromB64url(subscription.p256dh);
	const authSecret = fromB64url(subscription.auth);

	const ecdh = createECDH('prime256v1');
	if (fixed) ecdh.setPrivateKey(fixed.asPrivate);
	else ecdh.generateKeys();
	const asPublic = ecdh.getPublicKey();
	const ecdhSecret = ecdh.computeSecret(uaPublic);
	const salt = fixed?.salt ?? randomBytes(16);

	const { cek, nonce } = deriveKeys(ecdhSecret, authSecret, uaPublic, asPublic, salt);

	// RFC 8188 §2: the last (here: only) record ends with a 0x02 delimiter
	// inside the plaintext, so truncation cannot go unnoticed
	const cipher = createCipheriv('aes-128-gcm', cek, nonce);
	const ciphertext = Buffer.concat([
		cipher.update(Buffer.concat([payload, Buffer.from([2])])),
		cipher.final(),
		cipher.getAuthTag()
	]);

	const header = Buffer.alloc(5);
	header.writeUInt32BE(RECORD_SIZE, 0);
	header.writeUInt8(asPublic.length, 4);
	return Buffer.concat([salt, header, asPublic, ciphertext]);
}

/** A VAPID keypair, base64url — what goes in the environment. */
export interface VapidKeys {
	publicKey: string;
	privateKey: string;
	/** Contact for the push service, `mailto:` or `https:` (RFC 8292 §2.1). */
	subject: string;
}

export function generateVapidKeys(): { publicKey: string; privateKey: string } {
	const ecdh = createECDH('prime256v1');
	ecdh.generateKeys();
	return {
		publicKey: b64url(ecdh.getPublicKey()),
		privateKey: b64url(pad32(ecdh.getPrivateKey()))
	};
}

/**
 * The `Authorization: vapid` header for one endpoint.
 *
 * The JWT is audience-bound to the push service's origin, so a token captured
 * from a request to Mozilla's service is not usable against Google's.
 */
export function vapidAuthorization(endpoint: string, keys: VapidKeys, now = Date.now()): string {
	const pub = fromB64url(keys.publicKey);
	const key = createPrivateKey({
		format: 'jwk',
		key: {
			kty: 'EC',
			crv: 'P-256',
			// the uncompressed point is 0x04 || x(32) || y(32)
			x: b64url(pub.subarray(1, 33)),
			y: b64url(pub.subarray(33, 65)),
			// a key stored before pad32 existed, or generated by another tool,
			// may still be short — normalise on the way in rather than trusting it
			d: b64url(pad32(fromB64url(keys.privateKey)))
		}
	});
	const header = b64url(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
	const body = b64url(
		Buffer.from(
			JSON.stringify({
				aud: new URL(endpoint).origin,
				// 12h: comfortably inside the 24h ceiling push services enforce
				exp: Math.floor(now / 1000) + 12 * 3600,
				sub: keys.subject
			})
		)
	);
	const signingInput = `${header}.${body}`;
	// ES256 is the raw r||s pair, not the DER sequence node signs by default
	const signature = sign('sha256', Buffer.from(signingInput), {
		key,
		dsaEncoding: 'ieee-p1363'
	});
	return `vapid t=${signingInput}.${b64url(signature)}, k=${keys.publicKey}`;
}

/**
 * Delivers one notification.
 *
 * Never throws: a push service that is down, slow or has forgotten the
 * subscription must not take down the roster change that triggered the fan-out.
 * A `gone` result is the caller's cue to delete the subscription — that is the
 * only way a subscription is ever cleaned up, since a browser that revokes
 * permission or clears storage tells the site nothing.
 */
export async function sendPush(
	subscription: WebPushSubscription,
	payload: unknown,
	keys: VapidKeys,
	ttlSeconds = 900
): Promise<PushResult> {
	let body: Buffer;
	try {
		body = encryptPush(Buffer.from(JSON.stringify(payload)), subscription, undefined);
	} catch (e) {
		console.error('push encrypt failed:', e);
		return 'rejected';
	}
	try {
		const res = await fetch(subscription.endpoint, {
			method: 'POST',
			headers: {
				Authorization: vapidAuthorization(subscription.endpoint, keys),
				'Content-Encoding': 'aes128gcm',
				'Content-Type': 'application/octet-stream',
				TTL: String(ttlSeconds),
				// these are worth waking a screen for; a lobby fills in minutes
				Urgency: 'high'
			},
			body: new Uint8Array(body),
			signal: AbortSignal.timeout(10_000)
		});
		// 404/410 are the push service saying this subscription is dead
		if (res.status === 404 || res.status === 410) return 'gone';
		if (!res.ok) {
			console.error(`push rejected (${res.status}): ${(await res.text().catch(() => '')).slice(0, 200)}`);
			return 'rejected';
		}
		return 'sent';
	} catch (e) {
		console.error('push send failed:', e);
		return 'rejected';
	}
}
