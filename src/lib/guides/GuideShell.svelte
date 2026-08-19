<script lang="ts">
	/**
	 * The frame every class guide is written in: one vocabulary of parts —
	 * jobs, cards, points, limbs, an ordered build, a shop table — styled once
	 * here, so a guide is markup and words and nothing else. A new guide reuses
	 * these class names; a new part is added here, not in a guide.
	 *
	 * `:global` under `.guide`, because the markup is the guides' own and this
	 * component never sees it: Svelte's scoping cannot reach it, and a scoped
	 * copy in every guide is what this replaces.
	 */
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="guide">{@render children()}</div>

<style>
	:global(.guide .lead) {
		max-width: 62ch;
	}

	/* ---------- the top: jobs beside the map ---------- */
	:global(.guide .top) {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 28px;
		align-items: start;
		max-width: 1040px;
	}
	@media (max-width: 780px) {
		:global(.guide .top) {
			grid-template-columns: 1fr;
			gap: 20px;
		}
	}

	:global(.guide .jobs) {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	/* a guide with no map beside its jobs lays them out two abreast instead */
	:global(.guide .jobs.grid) {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		max-width: 1040px;
	}
	@media (max-width: 700px) {
		:global(.guide .jobs.grid) {
			grid-template-columns: 1fr;
		}
	}
	:global(.guide .job) {
		background: var(--surface);
		border: 1px solid var(--border);
		border-left: 3px solid var(--step, var(--border));
		border-radius: var(--radius-3);
		box-shadow: var(--shadow-1);
		padding: 10px 14px 11px;
	}
	:global(.guide .j-k) {
		display: block;
		font-family: var(--font-mono);
		font-size: 9.5px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-faint);
		margin-bottom: 3px;
	}
	:global(.guide .job > b) {
		display: block;
		font-size: 14px;
		font-weight: 650;
		letter-spacing: -0.01em;
	}
	:global(.guide .job .k) {
		font-style: normal;
		font-weight: 750;
		color: var(--step, var(--text));
	}
	:global(.guide .j-d) {
		display: block;
		margin-top: 4px;
		font-size: 12px;
		line-height: 1.5;
		color: var(--text-dim);
	}
	:global(.guide .c-item) {
		--step: var(--item);
	}
	:global(.guide .c-mos) {
		--step: var(--mos);
	}
	:global(.guide .c-bad) {
		--step: var(--hostile);
	}
	:global(.guide .c-ok) {
		--step: var(--accent);
	}
	:global(.guide kbd) {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 650;
		color: var(--text);
		background: var(--surface);
		border: 1px solid var(--border-strong);
		border-bottom-width: 2px;
		border-radius: 4px;
		padding: 0 5px;
	}

	/* ---------- detail cards (the quick guide's) ---------- */
	:global(.guide .cards) {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
		gap: 12px;
		align-items: start;
	}
	:global(.guide .card.d) {
		padding: 13px 15px 14px;
		min-width: 0;
	}
	:global(.guide .card.d h3) {
		margin: 0 0 9px;
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-faint);
		font-weight: 500;
	}
	:global(.guide .sub) {
		margin: 18px 0 8px;
		font-size: 13px;
		font-weight: 650;
	}
	:global(.guide .pts) {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	:global(.guide .pts.top-gap) {
		margin-top: 11px;
	}
	:global(.guide .pts li) {
		position: relative;
		padding-left: 14px;
		margin-bottom: 6px;
		font-size: 12.5px;
		line-height: 1.5;
		color: var(--text-dim);
	}
	:global(.guide .pts li:last-child) {
		margin-bottom: 0;
	}
	:global(.guide .pts li::before) {
		content: '';
		position: absolute;
		left: 0;
		top: 8px;
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: var(--accent);
	}
	:global(.guide .pts b) {
		color: var(--text);
		font-weight: 650;
	}
	:global(.guide .pts li.fine-li) {
		font-size: 11.5px;
		color: var(--text-faint);
	}
	/* rows led by the ability's own button instead of a bullet */
	:global(.guide .pts.icons li) {
		padding-left: 0;
		display: flex;
		gap: 9px;
		align-items: flex-start;
	}
	:global(.guide .pts.icons li::before) {
		display: none;
	}
	:global(.guide .pts.icons img) {
		width: 26px;
		height: 26px;
		object-fit: cover;
		border-radius: var(--radius-2);
		flex: none;
		margin-top: 1px;
	}

	:global(.guide .limbs) {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 9px;
	}
	:global(.guide .limb) {
		border-left: 2px solid var(--border);
		padding-left: 9px;
		min-width: 0;
	}
	:global(.guide .limb.good) {
		border-left-color: var(--mos);
	}
	:global(.guide .limb.bad) {
		border-left-color: var(--hostile);
	}
	:global(.guide .limb-k) {
		display: block;
		font-family: var(--font-mono);
		font-size: 9.5px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-faint);
	}
	:global(.guide .limb b) {
		display: block;
		margin-top: 2px;
		font-size: 17px;
		font-weight: 650;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.01em;
	}
	:global(.guide .limb-d) {
		display: block;
		margin-top: 3px;
		font-size: 11px;
		line-height: 1.4;
		color: var(--text-faint);
	}
	:global(.guide .fine) {
		margin: 7px 0 0;
		font-size: 11px;
		line-height: 1.45;
		color: var(--text-faint);
	}
	:global(.guide .fine.credit) {
		margin-top: 22px;
		max-width: 70ch;
	}
	:global(.guide .glink) {
		display: inline-block;
		margin-top: 9px;
		font-family: var(--font-mono);
		font-size: 10.5px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		text-decoration: none;
		color: var(--accent);
	}
	:global(.guide .glink:hover) {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	:global(.guide .order) {
		margin: 0;
		padding: 0 0 0 20px;
		font-size: 12.5px;
		line-height: 1.55;
		color: var(--text-dim);
	}
	:global(.guide .order li) {
		margin-bottom: 4px;
	}
	:global(.guide .order b) {
		color: var(--text);
		font-weight: 650;
	}
	:global(.guide .why) {
		display: block;
		font-size: 11px;
		color: var(--text-faint);
	}

	/* ---------- the shop table ---------- */
	:global(.guide .shop td.key),
	:global(.guide .shop th.key) {
		width: 1%;
		white-space: nowrap;
	}
	:global(.guide .shop td.namecell) {
		position: relative;
		white-space: nowrap;
		padding-left: calc(12px + 30px + 8px);
	}
	:global(.guide .shop .row-icon) {
		position: absolute;
		left: 12px;
		top: 50%;
		transform: translateY(-50%);
		width: 30px;
		height: 30px;
		object-fit: cover;
		border-radius: 4px;
	}
	:global(.guide .shop .row-icon.placeholder) {
		background: var(--surface-raised);
	}
	:global(.guide .shop .uname) {
		font-weight: 550;
	}
	:global(.guide .shop td.effect) {
		font-size: 12px;
		color: var(--text-dim);
		min-width: 240px;
		overflow-wrap: anywhere;
	}
</style>
