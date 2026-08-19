import { error } from '@sveltejs/kit';
import { guideIds, guides } from '$lib/guides';
import type { EntryGenerator, PageLoad } from './$types';

/** Only the classes someone has written a guide for. */
export const entries: EntryGenerator = () => guideIds.map((id) => ({ id }));

/* A universal load may return a component, and this one does: the guide is a
   page of its own with a map in it, loaded here and nowhere else, so the
   overview never pays for it. */
export const load: PageLoad = async ({ params }) => {
	const entry = guides[params.id];
	if (!entry) error(404, `No guide for "${params.id}" yet`);
	const { default: Guide } = await entry.load();
	return { Guide, summary: entry.summary, checked: entry.checked };
};
