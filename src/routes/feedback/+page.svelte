<script lang="ts">
	import { enhance } from '$app/forms';
	import { MESSAGE_MAX, NAME_MAX, CONTACT_MAX } from '$lib/feedback';
	import Seo from '$lib/components/Seo.svelte';

	let { form } = $props();
	let sending = $state(false);
</script>

<Seo
	title="Feedback"
	description="Spotted a wrong stat, a missing unit, or have an idea for the UAR Unit Database? Send it straight to the maintainer."
/>

<p class="note">
	Spotted a wrong stat, a missing unit, or have an idea for the site? Leave a note below — it goes
	straight to the maintainer. For in-game balance or map bugs, reach out to Znimu#743 instead.
</p>

<h2 class="section">Leave feedback</h2>

{#if form?.success}
	<div class="card thanks">
		<p class="thanks-title">Thanks — your feedback is saved.</p>
		<p class="thanks-sub">
			It will be read soon. <a href="/feedback" data-sveltekit-reload>Send another</a>
		</p>
	</div>
{:else}
	<form
		class="card fb"
		method="POST"
		use:enhance={() => {
			sending = true;
			return async ({ update }) => {
				sending = false;
				await update();
			};
		}}
	>
		<label class="field">
			<span class="label">Message</span>
			<textarea
				name="message"
				rows="7"
				required
				maxlength={MESSAGE_MAX}
				placeholder="What's wrong, missing, or worth adding?"
				value={form?.values?.message ?? ''}
			></textarea>
		</label>

		<div class="row">
			<label class="field">
				<span class="label">Name <em>(optional)</em></span>
				<input
					type="text"
					name="name"
					maxlength={NAME_MAX}
					placeholder="In-game name, clan…"
					value={form?.values?.name ?? ''}
				/>
			</label>
			<label class="field">
				<span class="label">Contact <em>(optional)</em></span>
				<input
					type="text"
					name="contact"
					maxlength={CONTACT_MAX}
					placeholder="Discord, e-mail — if you want a reply"
					value={form?.values?.contact ?? ''}
				/>
			</label>
		</div>

		<!-- honeypot: humans never see this field; bots fill it and get rejected -->
		<div class="hp" aria-hidden="true">
			<label>
				Website
				<input type="text" name="website" tabindex="-1" autocomplete="off" />
			</label>
		</div>

		<div class="actions">
			<button type="submit" disabled={sending}>{sending ? 'Sending…' : 'Send feedback'}</button>
			{#if form?.error}
				<p class="result err">{form.error}</p>
			{/if}
		</div>
	</form>
{/if}

<style>
	.fb {
		display: flex;
		flex-direction: column;
		gap: 14px;
		max-width: 640px;
		padding: 16px 18px;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 5px;
		flex: 1;
		min-width: 200px;
	}
	.label {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text-faint);
	}
	.label em {
		font-style: normal;
		text-transform: none;
		letter-spacing: 0.02em;
		font-weight: 400;
	}
	textarea,
	input[type='text'] {
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-2);
		padding: 8px 12px;
		font: inherit;
		transition: border-color 120ms ease, box-shadow 120ms ease;
	}
	textarea {
		resize: vertical;
		min-height: 120px;
		line-height: 1.55;
	}
	textarea:focus,
	input[type='text']:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-soft);
	}
	textarea::placeholder,
	input[type='text']::placeholder {
		color: var(--text-faint);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
	}
	.hp {
		position: absolute;
		left: -9999px;
		width: 1px;
		height: 1px;
		overflow: hidden;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 14px;
		flex-wrap: wrap;
	}
	.actions button {
		padding: 8px 20px;
		border: none;
		border-radius: var(--radius-2);
		background: var(--accent);
		color: var(--accent-contrast);
		font-weight: 650;
		font-size: 13px;
		cursor: pointer;
	}
	.actions button:hover {
		background: var(--accent-dim);
	}
	.actions button:disabled {
		opacity: 0.6;
		cursor: wait;
	}
	.result {
		margin: 0;
		font-size: 12.5px;
		font-weight: 600;
	}
	.result.err {
		color: var(--hostile);
	}
	.thanks {
		max-width: 640px;
		padding: 18px 20px;
	}
	.thanks-title {
		margin: 0;
		font-weight: 650;
		color: var(--accent);
	}
	.thanks-sub {
		margin: 6px 0 0;
		font-size: 12.5px;
		color: var(--text-dim);
	}
	.thanks-sub a {
		color: var(--accent);
		text-decoration: none;
		font-weight: 550;
	}
	.thanks-sub a:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
</style>
