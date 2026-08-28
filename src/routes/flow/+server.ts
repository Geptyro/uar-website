import { redirect } from '@sveltejs/kit';
import { groupOfTrigger, groupHref } from '$lib/groups';
import type { RequestHandler } from './$types';

/* Mission flow folded into Triggers. Entity pages still link a trigger as
   /flow?t=<id>: send that to the page of the group the trigger is in, and
   anything else to the index. A redirect needs a server, not a prerender. */
export const prerender = false;

export const GET: RequestHandler = ({ url }) => {
	const t = url.searchParams.get('t');
	const g = t ? groupOfTrigger.get(t) : undefined;
	redirect(308, g ? `${groupHref(g)}#${t}` : '/triggers');
};
