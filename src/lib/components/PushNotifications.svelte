<script lang="ts">
	/**
	 * Browser notification settings for the signed-in account.
	 *
	 * Deliberately does not ask for permission on load. A prompt nobody invited
	 * is the one thing browsers punish — Chrome quietly demotes an origin that
	 * gets dismissed often, and Safari refuses the call outright unless it
	 * happens inside a click. So the request only ever fires from the button.
	 *
	 * The subscription lives in the browser and the row lives in Mongo, and
	 * either can vanish without telling the other: clearing site data drops the
	 * browser's half, and the account page is where that gets noticed and
	 * repaired, by re-subscribing over the same endpoint.
	 */
	import { onMount } from 'svelte';
	import { PUSH_TOPICS, TOPIC_LABELS, type PushPrefs, type PushTopic } from '$lib/push';

	type Status =
		| 'loading'
		| 'unsupported' // no service worker / no PushManager — old browser, or iOS in a tab
		| 'disabled' // the server has no VAPID keys
		| 'blocked' // permission denied; only the browser's own UI can undo it
		| 'off'
		| 'on';

	let status = $state<Status>('loading');
	let prefs = $state<PushPrefs>({ ready: true, lobby: true });
	let key = $state<string | null>(null);
	let busy = $state(false);
	let failed = $state<string | null>(null);
	let sent = $state<string | null>(null);

	/**
	 * iOS only delivers Web Push to a home-screen app — a plain Safari tab
	 * cannot subscribe at all, and the API is simply absent there. Worth saying
	 * out loud, because "your browser does not support this" is wrong and
	 * unactionable when the fix is two taps in the share sheet.
	 */
	const isIOS = () =>
		typeof navigator !== 'undefined' &&
		(/iPad|iPhone|iPod/.test(navigator.userAgent) ||
			// iPadOS reports itself as a Mac; the touch points give it away
			(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
	const isStandalone = () =>
		typeof window !== 'undefined' &&
		(window.matchMedia('(display-mode: standalone)').matches ||
			(navigator as unknown as { standalone?: boolean }).standalone === true);

	let iosNeedsInstall = $state(false);

	async function currentSubscription(): Promise<PushSubscription | null> {
		const reg = await navigator.serviceWorker.ready;
		return reg.pushManager.getSubscription();
	}

	onMount(async () => {
		iosNeedsInstall = isIOS() && !isStandalone();
		if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
			status = 'unsupported';
			return;
		}
		const existing = await currentSubscription().catch(() => null);
		const query = existing ? `?endpoint=${encodeURIComponent(existing.endpoint)}` : '';
		try {
			const res = await fetch(`/api/push${query}`);
			const body = await res.json();
			key = body.key;
			if (!body.enabled) {
				status = 'disabled';
				return;
			}
			if (body.subscribed) prefs = body.prefs;
			if (Notification.permission === 'denied') {
				status = 'blocked';
				return;
			}
			// the browser's subscription is the source of truth for "on": a row
			// without one is a device that cleared its storage
			status = existing && body.subscribed ? 'on' : 'off';
		} catch {
			status = 'disabled';
		}
	});

	/** base64url → the Uint8Array PushManager wants for applicationServerKey. */
	function decodeKey(value: string): Uint8Array<ArrayBuffer> {
		const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
		// backed by a plain ArrayBuffer on purpose — BufferSource rejects the
		// SharedArrayBuffer-capable type Uint8Array.from() infers
		const bytes = new Uint8Array(new ArrayBuffer(binary.length));
		for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
		return bytes;
	}

	async function enable() {
		if (busy || !key) return;
		busy = true;
		failed = null;
		try {
			// must be inside the click for Safari; Chrome only dislikes it otherwise
			const permission = await Notification.requestPermission();
			if (permission !== 'granted') {
				status = permission === 'denied' ? 'blocked' : 'off';
				return;
			}
			const reg = await navigator.serviceWorker.ready;
			const subscription =
				(await reg.pushManager.getSubscription()) ??
				(await reg.pushManager.subscribe({
					// every browser requires this now; a push that is not visible to
					// the user is not a use case any of them still allow
					userVisibleOnly: true,
					applicationServerKey: decodeKey(key)
				}));
			await save(subscription);
			status = 'on';
		} catch (e) {
			failed = e instanceof Error ? e.message : 'Could not enable notifications.';
		} finally {
			busy = false;
		}
	}

	async function save(subscription: PushSubscription) {
		const res = await fetch('/api/push', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ ...subscription.toJSON(), prefs })
		});
		if (!res.ok) throw new Error(await res.text());
	}

	async function disable() {
		if (busy) return;
		busy = true;
		failed = null;
		try {
			const subscription = await currentSubscription();
			if (subscription) {
				await fetch('/api/push', {
					method: 'DELETE',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ endpoint: subscription.endpoint })
				});
				// unsubscribe last: a browser that forgets the endpoint before the
				// server does leaves a row nothing can ever address again
				await subscription.unsubscribe();
			}
			status = 'off';
		} catch (e) {
			failed = e instanceof Error ? e.message : 'Could not turn notifications off.';
		} finally {
			busy = false;
		}
	}

	/**
	 * Asks the server to push one notification to this account's devices.
	 *
	 * It arrives through the real push service, so it may well appear on the
	 * *other* device rather than this one — which is the point, and worth
	 * saying in the confirmation rather than leaving someone staring at a tab
	 * that looks like nothing happened.
	 */
	async function test() {
		if (busy) return;
		busy = true;
		failed = null;
		sent = null;
		try {
			const res = await fetch('/api/push/test', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ topic: PUSH_TOPICS.find((t) => prefs[t]) ?? 'ready' })
			});
			if (!res.ok) throw new Error((await res.text()) || 'The test could not be sent.');
			const body = (await res.json()) as { sent: number; devices: number };
			sent =
				body.sent === 0
					? 'The push service accepted nothing — check the server log.'
					: `Sent to ${body.sent} of ${body.devices} browser${body.devices === 1 ? '' : 's'} on this account. It may land on another device.`;
		} catch (e) {
			failed = e instanceof Error ? e.message : 'The test could not be sent.';
		} finally {
			busy = false;
		}
	}

	/**
	 * Flips one topic. Before notifications are enabled this is a local choice
	 * that `enable` will carry into the subscription; after, it is written
	 * through immediately — there is no save button, and a toggle that only
	 * looked like it applied would be worse than none.
	 */
	async function toggle(topic: PushTopic) {
		prefs = { ...prefs, [topic]: !prefs[topic] };
		failed = null;
		if (status !== 'on') return;
		const subscription = await currentSubscription();
		if (!subscription) return;
		try {
			await save(subscription);
		} catch {
			// put it back rather than leave the page claiming something the
			// server never accepted
			prefs = { ...prefs, [topic]: !prefs[topic] };
			failed = 'Could not save that setting.';
		}
	}
</script>

<h2 class="section">Notifications</h2>
<div class="card box">
	{#if status === 'loading'}
		<p class="note">Checking this browser…</p>
	{:else if status === 'unsupported'}
		{#if iosNeedsInstall}
			<p class="note">
				On iPhone and iPad, notifications only work once UAR is added to the Home Screen. Tap
				<b>Share</b> → <b>Add to Home Screen</b>, then open UAR from there and come back to this
				page.
			</p>
		{:else}
			<p class="note">This browser cannot receive notifications.</p>
		{/if}
	{:else if status === 'disabled'}
		<p class="note">Notifications are not configured on this server.</p>
	{:else if status === 'blocked'}
		<p class="note">
			Notifications are blocked for this site. The browser only lets you undo that in its own
			settings — the padlock next to the address bar.
		</p>
	{:else}
		<p class="note">
			Get told when a lobby forms or someone is ready, even with UAR closed. Set per browser: the
			phone you want buzzing is rarely the desktop already showing the page.
		</p>

		<!-- shown whether or not notifications are on yet: picking what you want
		     before granting permission is the natural order, and the choice is
		     carried into the subscription when you enable -->
		<ul class="topics" class:pending={status !== 'on'}>
			{#each PUSH_TOPICS as topic (topic)}
				<li>
					<button
						class="chip"
						aria-pressed={prefs[topic]}
						title={TOPIC_LABELS[topic].hint}
						onclick={() => toggle(topic)}
					>
						<span class="tick" aria-hidden="true">{prefs[topic] ? '✓' : '·'}</span>
						{TOPIC_LABELS[topic].label}
					</button>
					<span class="meta">{TOPIC_LABELS[topic].hint}</span>
				</li>
			{/each}
		</ul>

		<div class="actions">
			{#if status === 'on'}
				<!-- the only real proof: permission can be granted and the
				     subscription stored while the delivery chain is still broken,
				     and every one of those failures is silent -->
				<button class="chip" disabled={busy} onclick={test}>
					{busy ? 'Sending…' : 'Send a test notification'}
				</button>
				<button class="chip danger" disabled={busy} onclick={disable}>
					Turn off on this browser
				</button>
			{:else}
				<button class="chip" disabled={busy} onclick={enable}>
					{busy ? 'Asking…' : 'Enable notifications'}
				</button>
			{/if}
		</div>

		{#if iosNeedsInstall}
			<p class="note fineprint">
				You are in a Safari tab. iOS only delivers these to a Home Screen app — add UAR with
				<b>Share</b> → <b>Add to Home Screen</b> and enable it there.
			</p>
		{/if}
	{/if}

	{#if sent}
		<p class="note fineprint sent">{sent}</p>
	{/if}
	{#if failed}
		<p class="quote error">{failed}</p>
	{/if}
</div>

<style>
	.box {
		max-width: 640px;
	}
	.topics {
		list-style: none;
		margin: 14px 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.topics li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 10px;
	}
	.topics .chip {
		min-width: 230px;
		text-align: left;
	}
	.tick {
		display: inline-block;
		width: 1em;
		color: var(--accent);
	}
	.topics .chip[aria-pressed='false'] .tick {
		color: var(--text-faint);
	}
	/* dimmed until the browser has actually granted permission — these are a
	   choice being made, not a setting in force */
	.topics.pending {
		opacity: 0.72;
	}
	.meta {
		font-size: 12px;
		color: var(--text-faint);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 18px;
	}
	.chip.danger:hover {
		border-color: var(--hostile);
		color: var(--hostile);
	}
	.fineprint {
		margin-top: 10px;
		font-size: 12px;
	}
	.quote.error {
		border-left-color: var(--hostile);
		margin-top: 12px;
	}
	.sent {
		color: var(--accent);
	}
</style>
