/**
 * What a player's chip says on hover: who they are, their career XP,
 * what they play and who with. Read from the profile the players pages are
 * served from (cached, one doc per player), for the handful of players a
 * text names; built as escaped HTML here so the renderer can hand it to the
 * hover card whole, the way it hands a description.
 */
import { getAvatarsByToon, getPlayerSummary } from './db';
import { mosById } from '$lib/mos';
import { ANON_PORTRAIT } from '$lib/portrait';
import type { Teammate } from '$lib/players';

export interface PlayerCard {
	toon: string;
	name: string;
	clan: string;
	avatar: string | null;
	/** The hover card's body, escaped HTML. */
	html: string;
}

const esc = (s: string) =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A row of the card: a picture and a name, and how many games behind it. A
 * class with no picture shows its initial; a player always has one (the stock
 * portrait when nothing is on record). */
const entry = (icon: string | null, name: string, games: number, round = false) =>
	`<span class="pc-entry${round ? ' round' : ''}">${
		icon ? `<img src="${esc(icon)}" alt="">` : `<i>${esc(name.slice(0, 1).toUpperCase())}</i>`
	}<span>${esc(name)}</span><small>×${games}</small></span>`;

export async function playerCards(toons: string[]): Promise<Record<string, PlayerCard>> {
	const out: Record<string, PlayerCard> = {};
	if (!toons.length) return out;
	const avatars = await getAvatarsByToon();
	await Promise.all(
		[...new Set(toons)].map(async (toon) => {
			const p = (await getPlayerSummary(toon)) as
				| {
						name?: string;
						clan?: string;
						careerXp?: number;
						historyCount?: number;
						classGames?: Record<string, number>;
						teammates?: Teammate[];
				  }
				| null;
			if (!p) return;
			const name = p.name ?? toon;
			const top = Object.entries(p.classGames ?? {})
				.sort((a, b) => b[1] - a[1])
				.slice(0, 3)
				.map(([id, games]) => {
					const m = mosById.get(id);
					return entry(m?.icon ?? null, m?.name ?? id, games);
				});
			const withWhom = [...(p.teammates ?? [])]
				.sort((a, b) => b.games - a.games)
				.slice(0, 3)
				.map((t) => entry(t.avatarUrl ?? avatars[t.toon] ?? ANON_PORTRAIT, t.name || t.toon, t.games, true));
			const games = p.historyCount ?? 0;
			const html =
				`<div class="pc-line"><b>${(p.careerXp ?? 0).toLocaleString('en')} XP</b> career · ${games} ${games === 1 ? 'game' : 'games'} on record</div>` +
				(top.length || withWhom.length
					? `<div class="pc-cols">` +
						`<div class="pc-col"><div class="pc-sect">Plays</div><div class="pc-list">${top.join('') || '<span class="pc-none">nothing yet</span>'}</div></div>` +
						`<div class="pc-col"><div class="pc-sect">Plays with</div><div class="pc-list">${withWhom.join('') || '<span class="pc-none">nobody yet</span>'}</div></div>` +
						`</div>`
					: '');
			out[toon] = { toon, name, clan: p.clan ?? '', avatar: avatars[toon] ?? null, html };
		})
	);
	return out;
}
