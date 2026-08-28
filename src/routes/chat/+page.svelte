<script lang="ts">
	/**
	 * The chat room: the log, who is typing, the box. The page opens with the
	 * newest messages in it and then listens: a message that lands, changes
	 * or goes anywhere shows here without a reload, over the stream at
	 * /api/chat/events. Sending is a fetch; the reply is the message as the
	 * room sees it. One's own messages can be reworded or taken back in
	 * place; the maintainer can take any back.
	 */
	import { onMount, tick, untrack } from 'svelte';
	import { Button } from 'sveltekit-commons';
	import { timeAgo } from 'sveltekit-commons/time';
	import Seo from '$lib/components/Seo.svelte';
	import Rich from '$lib/components/builds/Rich.svelte';
	import MarkdownField from '$lib/components/builds/MarkdownField.svelte';
	import Confirm from '$lib/components/Confirm.svelte';
	import Reactions from '$lib/components/Reactions.svelte';
	import anonPortrait from '$lib/assets/anon-portrait.svg';
	import { portraitFallback } from '$lib/portrait';
	import { BUILD_LIMITS } from '$lib/builds';
	import type { ChatView } from '$lib/server/chatView';
	import { chatSeen } from '$lib/chatUnread.svelte';

	let { data } = $props();

	// read once, on purpose: from here on the stream is the source, not the loader
	const start = untrack(() => data);
	let messages = $state<ChatView[]>(start.messages);
	let more = $state(start.more);
	let typing = $state<string[]>(start.typing);
	let text = $state('');
	let editing = $state<string | null>(null);
	let editText = $state('');
	let notice = $state('');
	let busy = $state(false);
	let log = $state<HTMLDivElement>();
	let confirmBox = $state<Confirm>();
	let now = $state(Date.now());

	const fmtTime = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', hour12: false });
	const fmtDay = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });
	const stamp = (iso: string) => {
		const d = new Date(iso);
		const today = new Date(now);
		const same = d.toDateString() === today.toDateString();
		return same ? fmtTime.format(d) : `${fmtDay.format(d)} ${fmtTime.format(d)}`;
	};

	/* the log follows the newest message unless the reader has scrolled up to read */
	function nearBottom(): boolean {
		if (!log) return true;
		return log.scrollHeight - log.scrollTop - log.clientHeight < 80;
	}
	async function toBottom(force = false) {
		const follow = force || nearBottom();
		await tick();
		if (follow && log) log.scrollTop = log.scrollHeight;
	}

	function upsert(m: ChatView) {
		const i = messages.findIndex((x) => x.id === m.id);
		if (i >= 0) messages[i] = m;
		else {
			messages.push(m);
			void toBottom();
		}
	}

	async function refetch() {
		try {
			const res = await fetch('/api/chat');
			if (!res.ok) return;
			const body = (await res.json()) as { messages: ChatView[] };
			for (const m of body.messages) {
				const i = messages.findIndex((x) => x.id === m.id);
				if (i >= 0) messages[i] = m;
				else messages.push(m);
			}
			messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
			void toBottom();
		} catch {
			/* the stream will try again */
		}
	}

	onMount(() => {
		chatSeen();
		void toBottom(true);
		let opened = 0;
		const events = new EventSource('/api/chat/events');
		events.addEventListener('open', () => {
			// a reconnect may have missed messages: take the newest page again
			if (opened++ > 0) void refetch();
		});
		events.addEventListener('message', (e) => {
			upsert(JSON.parse((e as MessageEvent).data));
			chatSeen();
		});
		events.addEventListener('edit', (e) => upsert(JSON.parse((e as MessageEvent).data)));
		events.addEventListener('delete', (e) => {
			const { id } = JSON.parse((e as MessageEvent).data) as { id: string };
			messages = messages.filter((m) => m.id !== id);
			if (editing === id) editing = null;
		});
		events.addEventListener('typing', (e) => {
			typing = (JSON.parse((e as MessageEvent).data) as { names: string[] }).names;
			void toBottom();
		});
		const tick = setInterval(() => (now = Date.now()), 30_000);
		return () => {
			events.close();
			clearInterval(tick);
		};
	});

	/** The server's own wording when it sent one. */
	async function reason(res: Response, fallback: string): Promise<string> {
		try {
			const body = (await res.json()) as { message?: string };
			return body?.message ?? fallback;
		} catch {
			return fallback;
		}
	}

	async function send() {
		const t = text.trim();
		if (!t || busy) return;
		busy = true;
		notice = '';
		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ text: t })
			});
			if (res.ok) {
				text = '';
				upsert((await res.json()) as ChatView);
				void toBottom(true);
			} else notice = await reason(res, 'That did not go through.');
		} catch {
			notice = 'No answer from the site. Check your connection.';
		} finally {
			busy = false;
		}
	}

	/* "typing": said every few seconds while the reader types, and unsaid when the box empties */
	let lastTyped = 0;
	function typed() {
		const t = Date.now();
		if (!text.trim()) {
			if (lastTyped) void fetch('/api/chat/typing', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"typing":false}' });
			lastTyped = 0;
			return;
		}
		if (t - lastTyped < 2_500) return;
		lastTyped = t;
		void fetch('/api/chat/typing', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"typing":true}' });
	}

	function startEdit(m: ChatView) {
		editing = m.id;
		editText = m.text;
	}
	async function saveEdit() {
		if (!editing) return;
		const id = editing;
		const res = await fetch(`/api/chat/${id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ text: editText })
		});
		if (res.ok) {
			upsert((await res.json()) as ChatView);
			editing = null;
		} else notice = await reason(res, 'That did not go through.');
	}
	async function remove(m: ChatView) {
		const ok = await confirmBox!.ask({ title: 'Delete this message?', message: 'It goes for everyone, for good.' });
		if (!ok) return;
		const res = await fetch(`/api/chat/${m.id}`, { method: 'DELETE' });
		if (res.ok) messages = messages.filter((x) => x.id !== m.id);
		else notice = await reason(res, 'That did not go through.');
	}
	async function react(m: ChatView, emoji: string) {
		const res = await fetch(`/api/chat/${m.id}/react`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ emoji })
		});
		if (res.ok) upsert((await res.json()) as ChatView);
		else notice = await reason(res, 'That did not go through.');
	}

	async function older() {
		const first = messages[0];
		if (!first) return;
		const res = await fetch(`/api/chat?before=${encodeURIComponent(first.createdAt)}`);
		if (!res.ok) return;
		const body = (await res.json()) as { messages: ChatView[]; more: boolean };
		const keep = log ? log.scrollHeight - log.scrollTop : 0;
		messages = [...body.messages, ...messages];
		more = body.more;
		await tick();
		if (log) log.scrollTop = log.scrollHeight - keep;
	}

	const EDIT =
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
	const TRASH =
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';

	const typingText = $derived(
		typing.length === 0
			? ''
			: typing.length === 1
				? `${typing[0]} is typing…`
				: typing.length === 2
					? `${typing[0]} and ${typing[1]} are typing…`
					: `${typing[0]}, ${typing[1]} and ${typing.length - 2} more are typing…`
	);
</script>

<Seo title="Chat" description="Talk with the players of Undead Assault Reborn: find a game, ask a question, say hello." noindex />

<div class="chat">
	{#if !data.enabled}
		<p class="note">The chat is not available on this deployment.</p>
	{:else}
		<div class="log" bind:this={log}>
			{#if more}
				<button class="chip older" type="button" onclick={older}>Older messages</button>
			{/if}
			{#if !messages.length}
				<p class="note">Nothing said yet. Say hello.</p>
			{/if}
			<Rich>
				{#each messages as m (m.id)}
					<article class="card m" class:mine={m.mine} id="m-{m.id}">
						<img class="av" src={m.avatar ?? anonPortrait} alt="" loading="lazy" use:portraitFallback={anonPortrait} />
						<div class="body">
							<header>
								{#if m.toon}<a class="who" href="/players/{m.toon}">{m.name}</a>{:else}<b class="who">{m.name}</b>{/if}
								<span class="when" title={m.createdAt}>{stamp(m.createdAt)}</span>
								{#if m.editedAt}<span class="edited" title="Edited {timeAgo(m.editedAt, now)}">edited</span>{/if}
								{#if (m.mine || data.admin) && editing !== m.id}
									<span class="ctl">
										{#if m.mine}
											<button class="ib" type="button" onclick={() => startEdit(m)} title="Edit" aria-label="Edit this message">{@html EDIT}</button>
										{/if}
										<button class="ib danger" type="button" onclick={() => remove(m)} title="Delete" aria-label="Delete this message">{@html TRASH}</button>
									</span>
								{/if}
							</header>
							{#if editing === m.id}
								<form
									class="edit"
									onsubmit={(e) => {
										e.preventDefault();
										void saveEdit();
									}}
								>
									<MarkdownField bind:value={editText} mos={null} pictures={false} rows={2} maxlength={BUILD_LIMITS.chat.max} required chips onsend={saveEdit}>
										{#snippet footer()}
											<Button type="button" variant="ghost" onclick={() => (editing = null)}>Cancel</Button>
											<Button>Save</Button>
										{/snippet}
									</MarkdownField>
								</form>
							{:else}
								<div class="md">{@html m.html}</div>
							{/if}
							{#if editing !== m.id}
								<div class="faces" class:empty={!m.reactions.length}>
									<Reactions reactions={m.reactions} can={data.signedIn} onreact={(e) => react(m, e)} />
								</div>
							{/if}
						</div>
					</article>
				{/each}
			</Rich>
		</div>

		<p class="typing" aria-live="polite">{typingText || ' '}</p>

		{#if data.signedIn}
			<form
				class="composer"
				onsubmit={(e) => {
					e.preventDefault();
					void send();
				}}
			>
				{#if notice}<p class="quote error">{notice}</p>{/if}
				<MarkdownField
					bind:value={text}
					mos={null}
					pictures={false}
					rows={2}
					maxlength={BUILD_LIMITS.chat.max}
					required
					chips
					placeholder="Say something. Enter sends, Shift+Enter is a new line; @ names a skill, an item or a player."
					onsend={send}
					oninput={typed}
				>
					{#snippet footer()}
						<Button disabled={busy}>Send</Button>
					{/snippet}
				</MarkdownField>
			</form>
		{:else}
			<p class="fine signin"><a href="/account">Sign in with Battle.net</a> to chat.</p>
		{/if}
	{/if}
</div>
<Confirm bind:this={confirmBox} />

<style>
	/* the page is the room: the log takes the height, the box sits under it */
	.chat {
		display: flex;
		flex-direction: column;
		height: calc(100dvh - var(--chrome-h, 52px) - 2 * var(--content-pad-top, 20px));
		min-height: 360px;
		padding: var(--content-pad-top, 20px) var(--content-pad-x, 36px);
	}
	.log {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 4px 8px 4px 2px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.older {
		align-self: center;
		margin: 4px 0 10px;
	}
	/* each message its own card on the site's surface, no outline, room between them;
	   one's own are told apart by the name alone */
	.m {
		position: relative;
		display: grid;
		grid-template-columns: 28px minmax(0, 1fr);
		column-gap: 10px;
		margin: 0 2px;
		padding: 10px 14px 11px 12px;
		border: 0;
	}
	/* the messages sit inside the renderer's wrapper, not the log itself, so the
	   space between them is theirs to carry */
	.m + .m {
		margin-top: 16px;
	}
	.av {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		object-fit: cover;
		border: 1px solid var(--border);
		background: var(--surface-raised);
	}
	.body {
		min-width: 0;
	}
	header {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 8px;
		font-size: 12px;
		color: var(--text-faint);
	}
	.who {
		color: var(--text);
		font-weight: 600;
		text-decoration: none;
	}
	.mine .who {
		color: var(--accent);
	}
	a.who:hover {
		text-decoration: underline;
	}
	.when,
	.edited {
		font-family: var(--font-mono);
		font-size: 10.5px;
	}
	.edited {
		font-style: italic;
	}
	/* the message's own buttons: quiet until the card is under the pointer */
	.ctl {
		margin-left: auto;
		display: inline-flex;
		gap: 4px;
		opacity: 0.55;
		transition: opacity 120ms ease;
	}
	.m:hover .ctl,
	.m:focus-within .ctl {
		opacity: 1;
	}
	.ib {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: var(--radius-2);
		background: var(--surface-raised);
		color: var(--text-dim);
		cursor: pointer;
		transition: all 120ms ease;
	}
	.ib :global(svg) {
		width: 14px;
		height: 14px;
	}
	.ib:hover {
		color: var(--text);
		border-color: var(--border-strong);
	}
	.ib.danger:hover {
		color: var(--hostile);
		border-color: var(--hostile);
	}
	.body :global(.md) {
		font-size: 13.5px;
		margin-top: 1px;
	}
	.body :global(.md p) {
		margin: 0;
	}
	.edit {
		margin-top: 4px;
	}
	/* the faces ride the card's bottom edge, in the gap below it, taking no room
	   inside; with none yet, only the button, and only when the card is under the pointer */
	.faces {
		position: absolute;
		left: 48px;
		bottom: -12px;
		z-index: 1;
	}
	.faces.empty {
		opacity: 0;
		transition: opacity 120ms ease;
	}
	/* a card with faces on its edge keeps its words clear of them above, and
	   holds the next card off below */
	.m:has(.faces:not(.empty)) {
		padding-bottom: 22px;
	}
	.m:has(.faces:not(.empty)) + .m {
		margin-top: 26px;
	}
	.m:hover .faces.empty,
	.m:focus-within .faces.empty {
		opacity: 1;
	}
	.typing {
		margin: 4px 0 6px;
		font-size: 11.5px;
		font-style: italic;
		color: var(--text-faint);
		min-height: 1.5em;
	}
	.composer {
		flex: none;
	}
	.quote.error {
		border-left-color: var(--hostile);
		margin: 0 0 8px;
	}
	.fine {
		font-size: 12px;
		color: var(--text-faint);
	}
</style>
