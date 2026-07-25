import { error } from '@sveltejs/kit';
import { players, playerByToon } from '$lib/players';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => players.map((p) => ({ toon: p.toon }));

export const load: PageLoad = ({ params }) => {
	const player = playerByToon.get(params.toon);
	if (!player) error(404, `No player profile for "${params.toon}"`);
	return { player };
};
