<script lang="ts">
	import type { PanelKey } from '$lib/mechanics';

	let { keys }: { keys: PanelKey[] } = $props();

	/** "shift+F2" -> ["shift", "F2"] so the modifier can be styled apart from the key */
	function parts(key: string): { mods: string[]; base: string } {
		const all = key.split('+');
		return { mods: all.slice(0, -1), base: all[all.length - 1] };
	}
</script>

<ul class="panel-grid">
	{#each keys as k (k.key + k.label)}
		{@const p = parts(k.key)}
		<li class="panel-key">
			{#if k.icon}
				<img class="pk-icon" src={k.icon} alt="" loading="lazy" />
			{:else}
				<span class="pk-icon placeholder"></span>
			{/if}
			<div class="pk-text">
				<kbd class="pk-kbd">
					{#each p.mods as m (m)}<span class="pk-mod">{m}</span>{/each}{p.base}
				</kbd>
				<span class="pk-label">{k.label}</span>
				{#if k.desc}<span class="pk-desc" title={k.desc}>{k.desc}</span>{/if}
			</div>
		</li>
	{/each}
</ul>

<style>
	.panel-grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(210px, 100%), 1fr));
		gap: 8px;
	}
	.panel-key {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
		padding: 8px 10px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-2);
		box-shadow: var(--shadow-1);
	}
	.pk-icon {
		width: 30px;
		height: 30px;
		object-fit: cover;
		border-radius: 4px;
		flex-shrink: 0;
	}
	.pk-icon.placeholder {
		background: var(--surface-raised);
	}
	.pk-text {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}
	.pk-kbd {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 650;
		letter-spacing: 0.04em;
		color: var(--accent);
		background: var(--accent-soft);
		border-radius: 99px;
		padding: 2px 8px;
		align-self: flex-start;
		white-space: nowrap;
	}
	.pk-mod::after {
		content: '+';
		margin: 0 1px;
		opacity: 0.6;
	}
	.pk-label {
		font-size: 12.5px;
		line-height: 1.35;
		overflow-wrap: anywhere;
	}
	.pk-desc {
		font-size: 11px;
		line-height: 1.45;
		color: var(--text-faint);
		white-space: pre-line;
		/* long add-on tooltips would blow out the grid — hover for the rest */
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		overflow: hidden;
	}
</style>
