import { dbConfigured, getPlayers, getReplaysList } from '$lib/server/db';
import type { PlayerProfile } from '$lib/players';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async () => {
	if (!dbConfigured()) return { players: [] as PlayerProfile[], replayCount: 0, latest: '' };
	const [players, replays] = await Promise.all([getPlayers(), getReplaysList()]);
	return {
		players: players as unknown as PlayerProfile[],
		replayCount: replays.filter((r) => r.players > 0).length,
		latest: replays.at(-1)?.playedAt?.slice(0, 10) ?? ''
	};
};
