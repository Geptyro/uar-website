<script lang="ts">
	/** A class's skill trees, one card each — the first thing on its overview. */
	import type { Skill } from '$lib/mos';

	let { skills }: { skills: Skill[] } = $props();
</script>

<div class="cards">
	{#each skills as s (s.id)}
		<article class="card">
			<h3>
				{#if s.icon}
					<img class="skill-icon" src={s.icon} alt="" loading="lazy" />
				{:else}
					<span class="skill-icon placeholder"></span>
				{/if}
				<span class="skill-name">{s.name}</span>
				{#if s.levels}<span class="lv">{s.levels} lv</span>{/if}
			</h3>
			{#if s.tooltip}<p class="card-tip">{s.tooltip}</p>{/if}
		</article>
	{/each}
</div>

<style>
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr));
		gap: 12px;
	}
	.card h3 {
		margin: 0 0 8px;
		font-size: 14px;
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 9px;
	}
	.skill-icon {
		width: 28px;
		height: 28px;
		object-fit: cover;
		border-radius: var(--radius-2);
		flex-shrink: 0;
	}
	.skill-icon.placeholder {
		display: inline-block;
		background: var(--surface-raised);
	}
	.skill-name {
		flex: 1;
	}
	.lv {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 550;
		color: var(--accent);
		background: var(--accent-soft);
		border-radius: 99px;
		padding: 2px 8px;
		white-space: nowrap;
	}
	.card-tip {
		margin: 0;
		font-size: 12.5px;
		color: var(--text-dim);
		white-space: pre-line;
	}
</style>
