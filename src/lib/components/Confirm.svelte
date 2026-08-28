<script lang="ts">
	/**
	 * The one modal every page with a delete needs: a question, a line about
	 * what goes with it, No and Yes. One instance on a page answers every
	 * question that page has; `ask` resolves true or false and the box shuts.
	 * Cancel stands first so Enter, or a tap on the button focus lands on,
	 * is the safe answer.
	 */
	import { Button } from 'sveltekit-commons';
	import Modal from './Modal.svelte';
	import type { Question } from '$lib/confirm';

	let q = $state<Question>({ title: '' });
	let open = $state(false);
	let resolve: ((ok: boolean) => void) | null = null;

	export function ask(question: Question): Promise<boolean> {
		resolve?.(false);
		q = question;
		open = true;
		return new Promise((r) => (resolve = r));
	}

	function settle(ok: boolean) {
		open = false;
		const r = resolve;
		resolve = null;
		r?.(ok);
	}
</script>

<Modal bind:open title={q.title} width={400} onclose={() => settle(false)}>
	{#if q.message}<p>{q.message}</p>{/if}
	{#snippet footer()}
		<Button type="button" variant="ghost" onclick={() => settle(false)}>{q.no ?? 'Cancel'}</Button>
		<Button type="button" variant={q.danger === false ? 'solid' : 'danger'} onclick={() => settle(true)}
			>{q.yes ?? 'Delete'}</Button
		>
	{/snippet}
</Modal>
