import { error } from '@sveltejs/kit';
import { months } from '$lib/changelog-data';
import type { EntryGenerator, PageServerLoad } from './$types';

/**
 * One month of releases. Every month that has one gets a page, the newest
 * included even while the front page still shows it: that is what makes the
 * address stable. The folder is a parameter so no month is spelled out in the
 * route table; the loader turns away anything else, so it is not a catch-all.
 */
export const entries: EntryGenerator = () =>
	months.filter((m) => m.month).map((m) => ({ month: m.month }));

export const load: PageServerLoad = ({ params }) => {
	const month = months.find((m) => m.month && m.month === params.month);
	if (!month) error(404, `No releases in ${params.month}`);
	return { month, others: months.filter((m) => m !== month) };
};
