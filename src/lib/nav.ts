/**
 * The site's destinations, in one list.
 *
 * The sidebar renders it and the command palette searches it, which is the
 * whole reason it left the layout: a page the sidebar could reach but the
 * palette could not know about is the failure mode this prevents.
 *
 * The icons are inline SVG strings rather than components because that is what
 * `NavItem`'s icon snippet renders with `{@html}` — they are ours, not visitor
 * input. Feather-style strokes throughout, the same visual language as the
 * account cog.
 */

import { CAREER_TABS, careerHref } from './careerTabs';

const icon = (paths: string) =>
	`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export interface NavDestination {
	href: string;
	label: string;
	/**
	 * Words the palette should match that the label does not carry — an
	 * in-game term, a synonym, the thing a newcomer would type. Never shown.
	 */
	alias?: string[];
}

export interface NavItemDef extends NavDestination {
	icon: string;
}

export const changelogIcon = icon(
	'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'
);

/** The sidebar's main list, top to bottom. */
export const navItems: NavItemDef[] = [
	{
		href: '/',
		label: 'Overview',
		alias: ['home', 'front page'],
		icon: icon(
			'<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'
		)
	},
	{
		href: '/guide',
		label: 'Quick guide',
		alias: ['how to play', 'beginner', 'new player', 'jam', 'unjam', 'fire team', 'tutorial'],
		icon: icon(
			'<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'
		)
	},
	{
		href: '/career',
		label: 'Career',
		alias: ['progression', 'unlocks', 'ranks', 'rank tracks', 'rank sets', 'xp'],
		icon: icon(
			'<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>'
		)
	},
	{
		href: '/players',
		label: 'Players',
		alias: ['leaderboard', 'ladder', 'stats', 'profiles'],
		icon: icon('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>')
	},
	{
		href: '/clans',
		label: 'Clans',
		alias: ['teams', 'tags'],
		icon: icon(
			'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
		)
	},
	{
		href: '/replays',
		label: 'Replays',
		alias: ['games', 'matches', 'archive'],
		icon: icon('<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>')
	},
	{
		href: '/triggers',
		label: 'Triggers',
		alias: ['missions', 'mechanics', 'mule', 'objectives', 'script', 'mission flow', 'mission order'],
		icon: icon(
			'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'
		)
	},
	{
		href: '/map',
		label: 'Map',
		alias: ['regions', 'ao thalim', 'minimap', 'places'],
		icon: icon(
			'<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>'
		)
	},
	{
		href: '/companion',
		label: 'Companion app',
		alias: ['tray', 'desktop app', 'upload replays'],
		icon: icon(
			'<rect x=\'2\' y=\'3\' width=\'20\' height=\'14\' rx=\'2\'/><line x1=\'8\' y1=\'21\' x2=\'16\' y2=\'21\'/><line x1=\'12\' y1=\'17\' x2=\'12\' y2=\'21\'/>'
		)
	},
	{
		href: '/entities',
		label: 'Entities',
		alias: ['units', 'items', 'undead', 'weapons', 'database'],
		icon: icon(
			'<circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/>'
		)
	},
	{
		href: '/chat',
		label: 'Chat',
		alias: ['talk', 'messages', 'room', 'lfg'],
		icon: icon(
			'<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>'
		)
	},
	{
		href: '/feedback',
		label: 'Feedback',
		alias: ['bug report', 'suggestion', 'contact'],
		icon: icon('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>')
	}
];

/**
 * Pages the sidebar reaches some other way — the MOS heading, the changelog
 * row under the list, the account chip in the top bar. The palette has no
 * chrome to inherit them from, so they are named here.
 */
export const extraDestinations: NavDestination[] = [
	{ href: '/mos', label: 'Compare all classes', alias: ['mos', 'classes', 'compare'] },
	/* The career tabs past the first: one sidebar line, but four things someone
	   types for. The ranks share the section's own URL, so they ride on it. */
	...CAREER_TABS.filter((t) => t.segment).map((t) => ({
		href: careerHref(t.segment),
		label: t.label,
		alias: t.alias
	})),
	{ href: '/changelog', label: 'Changelog', alias: ['releases', 'what is new', 'updates'] },
	{ href: '/account', label: 'Account', alias: ['settings', 'battle.net', 'sign in', 'theme'] }
];
