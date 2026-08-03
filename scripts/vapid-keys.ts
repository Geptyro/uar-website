/**
 * Generates a VAPID keypair for Web Push, printed as dotenv lines.
 *
 *   node scripts/vapid-keys.ts
 *
 * Run once per environment. The public key is baked into every browser
 * subscription the moment a player enables notifications, so rotating the pair
 * invalidates every existing subscription — the rows keep working only until
 * the push service checks the signature, then answer 403 and are pruned on the
 * next fan-out. In other words: generate once, keep it, and give dev its own.
 *
 * Prod reads these from the `APP_SECRETS` repo secret, which the deploy
 * workflow stages into Fly (see CLAUDE.md).
 */
import { generateVapidKeys } from '../src/lib/server/webpush.ts';

const { publicKey, privateKey } = generateVapidKeys();

console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log('VAPID_SUBJECT=mailto:you@example.com');
