<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	let uploading = $state(false);
	let result = $state<{ ok: boolean; text: string } | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);

	async function upload(event: SubmitEvent) {
		event.preventDefault();
		const file = fileInput?.files?.[0];
		if (!file) return;
		if (file.size > 16 * 1024 * 1024) {
			result = { ok: false, text: 'File too large (max 16 MB).' };
			return;
		}
		uploading = true;
		result = null;
		try {
			// skip the upload entirely when the server already has this exact file
			const buf = await file.arrayBuffer();
			const digest = await crypto.subtle.digest('SHA-256', buf);
			const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
			const known = await fetch(`/api/replays?sha256=${sha256}`).then((r) => r.json());
			if (known?.exists) {
				result = { ok: false, text: 'This replay is already ingested — nothing to upload.' };
				return;
			}

			const body = new FormData();
			body.append('replay', new File([buf], file.name));
			const res = await fetch('/api/replays', { method: 'POST', body });
			const payload = await res.json().catch(() => null);
			if (res.ok && payload?.ok) {
				result = {
					ok: true,
					text: `Accepted: game from ${payload.playedAt.replace('T', ' ').replace('Z', ' UTC')} with ${payload.profiles} player profiles. ${payload.message}`
				};
				if (fileInput) fileInput.value = '';
				await invalidateAll(); // refresh the ingested-replays list
			} else {
				result = { ok: false, text: payload?.message ?? `Upload failed (${res.status}).` };
			}
		} catch {
			result = { ok: false, text: 'Upload failed — network error.' };
		} finally {
			uploading = false;
		}
	}
</script>

<svelte:head>
	<title>Replays — UAR Unit Database</title>
</svelte:head>

<p class="note">
	Replays are the data source for the <a href="/players">player profiles</a>: each game's save-file
	snapshots, class picks and results are extracted from the replay itself. Everyone can contribute
	— upload any Undead Assault Reborn replay below, or pick a replay from the list to see who
	played and download the file.
</p>

<h2 class="section">Upload a replay</h2>
<form class="upload card" onsubmit={upload}>
	<input
		type="file"
		accept=".SC2Replay"
		bind:this={fileInput}
		aria-label="Choose an .SC2Replay file"
	/>
	<button type="submit" disabled={uploading}>
		{uploading ? 'Uploading…' : 'Upload'}
	</button>
	<p class="hint">
		Your replays are in
		<span class="mono">Documents\StarCraft II\Accounts\…\Replays\Multiplayer</span>. The game is
		validated server-side; accepted replays and player profiles go live immediately.
	</p>
	{#if result}
		<p class="result" class:err={!result.ok}>{result.text}</p>
	{/if}
</form>

<h2 class="section">Or let UAR Companion upload for you</h2>
<div class="card tray">
	<p>
		<a href="/companion">UAR Companion</a> is a
		small companion app for Windows, Linux and macOS: it sits in your system tray, uploads new
		Undead Assault Reborn replays automatically after each game, and shows who is flagged
		<em>ready to play</em> — with a desktop notification if you want one.
	</p>
	<p class="hint">
		Every replay is checked on your machine first: only UAR games are ever sent, known replays are
		skipped, and uploads respect the server's rate limits.
	</p>
</div>

<p class="note" style="margin-top: 14px">
	Replays record every player's save data at game start, so games with 0 profiles (solo tests,
	instant leavers) add nothing and are rejected at upload.
</p>

<style>
	.upload {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		padding: 14px 16px;
		max-width: 640px;
	}
	.upload input[type='file'] {
		flex: 1;
		min-width: 220px;
		font-size: 12.5px;
	}
	.upload button {
		padding: 7px 18px;
		border: none;
		border-radius: var(--r-sm);
		background: var(--accent);
		color: var(--on-accent);
		font-weight: 650;
		font-size: 13px;
		cursor: pointer;
	}
	.upload button:hover {
		background: var(--accent-hover);
	}
	.upload button:disabled {
		opacity: 0.6;
		cursor: wait;
	}
	.hint {
		flex-basis: 100%;
		margin: 0;
		font-size: 11.5px;
		color: var(--ink-3);
		line-height: 1.45;
	}
	.result {
		flex-basis: 100%;
		margin: 0;
		font-size: 12.5px;
		color: var(--accent);
		font-weight: 600;
	}
	.result.err {
		color: var(--hostile);
	}
	.tray {
		padding: 14px 16px;
		max-width: 640px;
	}
	.tray p {
		margin: 0 0 8px;
		font-size: 13px;
		line-height: 1.5;
	}
	.tray p:last-child {
		margin-bottom: 0;
	}
</style>
