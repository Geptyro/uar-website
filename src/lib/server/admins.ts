/**
 * Who maintains the site, as far as it needs to know.
 *
 * `SITE_ADMINS` is a comma-separated list of Battle.net account ids (the OAuth
 * `sub`) or battletags. It gates the moderation actions on community builds
 * (hide, unhide, delete someone else's) and is where a "new build published"
 * notification goes. An env var rather than a flag on the account document,
 * because there is exactly one maintainer and the list has to hold before
 * that account has ever signed in on a fresh deployment.
 */

import type { Session } from './session.ts';

export function siteAdmins(): string[] {
	return (process.env.SITE_ADMINS ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
}

export function isAdmin(session: Session | null | undefined): boolean {
	if (!session) return false;
	const admins = siteAdmins();
	return admins.includes(session.sub) || admins.includes(session.battletag);
}
