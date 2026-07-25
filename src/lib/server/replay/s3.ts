/**
 * Minimal S3 client for the Tigris replay bucket, via aws4fetch (SigV4).
 * Config comes from the env vars `fly storage create` injects:
 * AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ENDPOINT_URL_S3, BUCKET_NAME.
 *
 * Uses process.env (not $env) so the same module works in the SvelteKit
 * server and in plain-node CLI scripts.
 */

import { AwsClient } from 'aws4fetch';

function config() {
	const {
		AWS_ACCESS_KEY_ID: accessKeyId,
		AWS_SECRET_ACCESS_KEY: secretAccessKey,
		AWS_ENDPOINT_URL_S3: endpoint = 'https://fly.storage.tigris.dev',
		BUCKET_NAME: bucket
	} = process.env;
	if (!accessKeyId || !secretAccessKey || !bucket) return null;
	return {
		client: new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' }),
		endpoint,
		bucket
	};
}

export function bucketConfigured(): boolean {
	return config() !== null;
}

function objectUrl(cfg: NonNullable<ReturnType<typeof config>>, key: string): string {
	return `${cfg.endpoint}/${cfg.bucket}/${key}`;
}

export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
	const cfg = config();
	if (!cfg) throw new Error('replay bucket is not configured');
	const res = await cfg.client.fetch(objectUrl(cfg, key), {
		method: 'PUT',
		headers: { 'Content-Type': contentType },
		body: body as unknown as BodyInit
	});
	if (!res.ok) throw new Error(`S3 PUT ${key}: ${res.status} ${await res.text()}`);
}

export async function getObject(key: string): Promise<Response | null> {
	const cfg = config();
	if (!cfg) return null;
	const res = await cfg.client.fetch(objectUrl(cfg, key));
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`S3 GET ${key}: ${res.status}`);
	return res;
}

export async function objectExists(key: string): Promise<boolean> {
	const cfg = config();
	if (!cfg) return false;
	const res = await cfg.client.fetch(objectUrl(cfg, key), { method: 'HEAD' });
	return res.ok;
}
